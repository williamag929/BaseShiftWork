using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class AvailabilityServiceTests
{
    private const string Co = LineupTestData.CompanyId;
    private static readonly TimeZoneInfo Ny = LineupTime.Resolve("America/New_York");
    private static readonly DateOnly Day = new(2026, 10, 1);

    private static async Task<(ShiftWork.Api.Data.ShiftWorkContext, AvailabilityService)> Arrange(
        Action<ShiftWork.Api.Data.ShiftWorkContext> seed)
    {
        var ctx = LineupTestData.NewContext();
        ctx.Persons.AddRange(
            new Person { PersonId = 1, Name = "Free", CompanyId = Co, Email = "1@x.com", Status = "Active" },
            new Person { PersonId = 2, Name = "Busy", CompanyId = Co, Email = "2@x.com", Status = "Active" },
            new Person { PersonId = 3, Name = "Gone", CompanyId = Co, Email = "3@x.com", Status = "Inactive" },
            new Person { PersonId = 4, Name = "Other", CompanyId = "other-co", Email = "4@x.com", Status = "Active" });
        seed(ctx);
        await ctx.SaveChangesAsync();
        return (ctx, new AvailabilityService(ctx));
    }

    // Shift times are wall-clock digits written with Kind=Utc (repo convention).
    private static ScheduleShift Shift(int person, DateTime s, DateTime e, string status = "Published", int loc = 10) =>
        new() { CompanyId = Co, PersonId = person, LocationId = loc, StartDate = s, EndDate = e, Status = status };

    private static DateTime U(int y, int m, int d, int h, int min = 0) => new(y, m, d, h, min, 0, DateTimeKind.Utc);

    private static Schedule Sched(int person, DateTime s, DateTime e, string status = "Published", int? loc = 10, string company = Co) =>
        new() { Name = "Shift", CompanyId = company, PersonId = person.ToString(), LocationId = loc, StartDate = s, EndDate = e, Status = status, Type = "Shift" };

    private static TimeOffRequest Off(int person, DateTime start, DateTime end, TimeSpan? ps = null, TimeSpan? pe = null) =>
        new() { CompanyId = Co, PersonId = person, Status = "Approved", StartDate = start, EndDate = end, IsPartialDay = ps != null, PartialStartTime = ps, PartialEndTime = pe };

    private static ShiftEvent Sick(int person, DateTime at) =>
        new() { EventLogId = Guid.NewGuid(), CompanyId = Co, PersonId = person, EventType = "sick", EventDate = at };

    [Fact]
    public async Task Only_active_people_in_the_company_are_candidates()
    {
        var (ctx, svc) = await Arrange(_ => { });
        var (s, e) = LineupTime.WallDayWindow(Day);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Equal(new[] { 1, 2 }, r.Available.Select(p => p.PersonId).OrderBy(x => x));
        Assert.Empty(r.Unavailable);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Shift_in_window_makes_person_unavailable_with_location()
    {
        var (ctx, svc) = await Arrange(c => c.ScheduleShifts.Add(Shift(2, U(2026, 10, 1, 12), U(2026, 10, 1, 20))));
        var (s, e) = LineupTime.WallDayWindow(Day);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        var busy = Assert.Single(r.Unavailable);
        Assert.Equal(2, busy.Person.PersonId);
        Assert.Equal(UnavailableReason.Shift, busy.Reason);
        Assert.Equal(10, busy.LocationId);
        Assert.DoesNotContain(r.Available, p => p.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Shift_started_previous_evening_and_running_past_midnight_blocks_the_day()
    {
        // wall 2026-09-30 22:00 -> 2026-10-01 06:00
        var (ctx, svc) = await Arrange(c => c.ScheduleShifts.Add(Shift(2, U(2026, 9, 30, 22), U(2026, 10, 1, 6))));
        var (s, e) = LineupTime.WallDayWindow(Day);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Contains(r.Unavailable, u => u.Person.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Void_shift_does_not_block()
    {
        var (ctx, svc) = await Arrange(c => c.ScheduleShifts.Add(Shift(2, U(2026, 10, 1, 12), U(2026, 10, 1, 20), "void")));
        var (s, e) = LineupTime.WallDayWindow(Day);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Contains(r.Available, p => p.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Shift_ending_exactly_when_window_starts_does_not_block()
    {
        var (ctx, svc) = await Arrange(c => c.ScheduleShifts.Add(Shift(2, U(2026, 9, 30, 16), U(2026, 10, 1, 0))));
        var (s, e) = LineupTime.WallDayWindow(Day);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Contains(r.Available, p => p.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Single_day_approved_time_off_blocks_that_day_only()
    {
        var off = new TimeOffRequest
        {
            CompanyId = Co, PersonId = 2, Status = "Approved",
            StartDate = new DateTime(2026, 10, 1), EndDate = new DateTime(2026, 10, 1)
        };
        var (ctx, svc) = await Arrange(c => c.TimeOffRequests.Add(off));

        var (s, e) = LineupTime.WallDayWindow(Day);
        var blocked = await svc.GetForWindowAsync(Co, s, e, Ny);
        var u = Assert.Single(blocked.Unavailable);
        Assert.Equal(UnavailableReason.TimeOff, u.Reason);

        var (ns, ne) = LineupTime.WallDayWindow(Day.AddDays(1));
        var next = await svc.GetForWindowAsync(Co, ns, ne, Ny);
        Assert.Contains(next.Available, p => p.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Theory]
    [InlineData("Pending")]
    [InlineData("Denied")]
    [InlineData("Cancelled")]
    public async Task Non_approved_time_off_does_not_block(string status)
    {
        var (ctx, svc) = await Arrange(c => c.TimeOffRequests.Add(new TimeOffRequest
        {
            CompanyId = Co, PersonId = 2, Status = status,
            StartDate = new DateTime(2026, 10, 1), EndDate = new DateTime(2026, 10, 1)
        }));
        var (s, e) = LineupTime.WallDayWindow(Day);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Contains(r.Available, p => p.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Theory]
    [InlineData("sick", true)]
    [InlineData("timeoff", true)]
    [InlineData("clockin", false)]
    public async Task Sick_and_timeoff_events_in_window_block(string type, bool blocks)
    {
        // EventDate is a real UTC instant; 15:00Z is 11:00 in New York on Oct 1.
        var (ctx, svc) = await Arrange(c => c.ShiftEvents.Add(new ShiftEvent
        {
            EventLogId = Guid.NewGuid(), CompanyId = Co, PersonId = 2, EventType = type,
            EventDate = U(2026, 10, 1, 15)
        }));
        var (s, e) = LineupTime.WallDayWindow(Day);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Equal(blocks, r.Unavailable.Any(u => u.Person.PersonId == 2 && u.Reason == UnavailableReason.TimeOff));
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Sick_event_on_previous_local_evening_does_not_block()
    {
        // 02:00Z on Oct 1 is 22:00 on Sep 30 in New York.
        var (ctx, svc) = await Arrange(c => c.ShiftEvents.Add(new ShiftEvent
        {
            EventLogId = Guid.NewGuid(), CompanyId = Co, PersonId = 2, EventType = "sick",
            EventDate = U(2026, 10, 1, 2)
        }));
        var (s, e) = LineupTime.WallDayWindow(Day);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Contains(r.Available, p => p.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Shift_reason_wins_over_time_off()
    {
        var (ctx, svc) = await Arrange(c =>
        {
            c.ScheduleShifts.Add(Shift(2, U(2026, 10, 1, 12), U(2026, 10, 1, 20)));
            c.TimeOffRequests.Add(new TimeOffRequest
            {
                CompanyId = Co, PersonId = 2, Status = "Approved",
                StartDate = new DateTime(2026, 10, 1), EndDate = new DateTime(2026, 10, 1)
            });
        });
        var (s, e) = LineupTime.WallDayWindow(Day);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Equal(UnavailableReason.Shift, Assert.Single(r.Unavailable).Reason);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Schedule_overlap_blocks_with_location_and_schedule_reason()
    {
        var (ctx, svc) = await Arrange(c => c.Schedules.Add(Sched(2, U(2026, 10, 1, 7), U(2026, 10, 1, 15, 30), loc: 7)));
        var (s, e) = LineupTime.WallDayWindow(Day);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        var busy = Assert.Single(r.Unavailable);
        Assert.Equal(2, busy.Person.PersonId);
        Assert.Equal(UnavailableReason.Schedule, busy.Reason);
        Assert.Equal(7, busy.LocationId);
        Assert.Equal(U(2026, 10, 1, 7), busy.StartUtc);
        Assert.DoesNotContain(r.Available, p => p.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Theory]
    [InlineData("void")]
    [InlineData("VOID")]
    public async Task Void_schedule_does_not_block(string status)
    {
        var (ctx, svc) = await Arrange(c => c.Schedules.Add(Sched(2, U(2026, 10, 1, 7), U(2026, 10, 1, 15), status)));
        var (s, e) = LineupTime.WallDayWindow(Day);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Contains(r.Available, p => p.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Schedule_of_another_person_or_company_does_not_block()
    {
        var (ctx, svc) = await Arrange(c =>
        {
            c.Schedules.Add(Sched(1, U(2026, 10, 1, 7), U(2026, 10, 1, 15)));                    // another person
            c.Schedules.Add(Sched(2, U(2026, 10, 1, 7), U(2026, 10, 1, 15), company: "other-co")); // another company
        });
        var (s, e) = LineupTime.WallDayWindow(Day);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Contains(r.Available, p => p.PersonId == 2);
        Assert.Contains(r.Unavailable, u => u.Person.PersonId == 1);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Schedule_ending_exactly_when_window_starts_does_not_block()
    {
        var (ctx, svc) = await Arrange(c => c.Schedules.Add(Sched(2, U(2026, 9, 30, 16), U(2026, 10, 1, 0))));
        var (s, e) = LineupTime.WallDayWindow(Day);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Contains(r.Available, p => p.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Schedule_beats_Shift_beats_TimeOff()
    {
        var (ctx, svc) = await Arrange(c =>
        {
            // person 1: all three; person 2: shift + time off
            c.Schedules.Add(Sched(1, U(2026, 10, 1, 7), U(2026, 10, 1, 15)));
            c.ScheduleShifts.Add(Shift(1, U(2026, 10, 1, 7), U(2026, 10, 1, 15)));
            c.TimeOffRequests.Add(Off(1, new DateTime(2026, 10, 1), new DateTime(2026, 10, 1)));
            c.ScheduleShifts.Add(Shift(2, U(2026, 10, 1, 7), U(2026, 10, 1, 15)));
            c.TimeOffRequests.Add(Off(2, new DateTime(2026, 10, 1), new DateTime(2026, 10, 1)));
        });
        var (s, e) = LineupTime.WallDayWindow(Day);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Equal(UnavailableReason.Schedule, r.Unavailable.Single(u => u.Person.PersonId == 1).Reason);
        Assert.Equal(UnavailableReason.Shift, r.Unavailable.Single(u => u.Person.PersonId == 2).Reason);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Partial_day_time_off_blocks_only_when_the_window_overlaps_its_range()
    {
        var (ctx, svc) = await Arrange(c => c.TimeOffRequests.Add(
            Off(2, new DateTime(2026, 10, 1), new DateTime(2026, 10, 1), TimeSpan.FromHours(13), TimeSpan.FromHours(15))));

        var overlapping = await svc.GetForWindowAsync(Co, U(2026, 10, 1, 7), U(2026, 10, 1, 15, 30), Ny);
        Assert.Equal(UnavailableReason.TimeOff, Assert.Single(overlapping.Unavailable).Reason);

        var before = await svc.GetForWindowAsync(Co, U(2026, 10, 1, 7), U(2026, 10, 1, 12), Ny);
        Assert.Contains(before.Available, p => p.PersonId == 2);

        var (ds, de) = LineupTime.WallDayWindow(Day);
        var fullDay = await svc.GetForWindowAsync(Co, ds, de, Ny);
        Assert.Contains(fullDay.Unavailable, u => u.Person.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Partial_day_flag_without_times_blocks_like_a_full_day()
    {
        var (ctx, svc) = await Arrange(c => c.TimeOffRequests.Add(new TimeOffRequest
        {
            CompanyId = Co, PersonId = 2, Status = "Approved", IsPartialDay = true,
            StartDate = new DateTime(2026, 10, 1), EndDate = new DateTime(2026, 10, 1)
        }));
        var r = await svc.GetForWindowAsync(Co, U(2026, 10, 1, 7), U(2026, 10, 1, 12), Ny);
        Assert.Contains(r.Unavailable, u => u.Person.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Multi_day_time_off_spanning_the_window_edge_blocks()
    {
        var (ctx, svc) = await Arrange(c => c.TimeOffRequests.Add(Off(2, new DateTime(2026, 9, 28), new DateTime(2026, 10, 1))));
        var (s, e) = LineupTime.WallDayWindow(Day);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Contains(r.Unavailable, u => u.Person.PersonId == 2 && u.Reason == UnavailableReason.TimeOff);

        var (ns, ne) = LineupTime.WallDayWindow(Day.AddDays(1));
        var next = await svc.GetForWindowAsync(Co, ns, ne, Ny);
        Assert.Contains(next.Available, p => p.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Early_morning_sick_event_blocks_a_later_shift_window_that_day()
    {
        // 09:30Z on Oct 1 is 05:30 in New York; the shift window starts at 07:00 wall.
        var (ctx, svc) = await Arrange(c => c.ShiftEvents.Add(Sick(2, U(2026, 10, 1, 9, 30))));
        var r = await svc.GetForWindowAsync(Co, U(2026, 10, 1, 7), U(2026, 10, 1, 15, 30), Ny);
        Assert.Contains(r.Unavailable, u => u.Person.PersonId == 2 && u.Reason == UnavailableReason.TimeOff);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Sick_event_the_previous_local_evening_does_not_block_a_shift_window()
    {
        // 02:00Z on Oct 1 is 22:00 on Sep 30 in New York.
        var (ctx, svc) = await Arrange(c => c.ShiftEvents.Add(Sick(2, U(2026, 10, 1, 2))));
        var r = await svc.GetForWindowAsync(Co, U(2026, 10, 1, 7), U(2026, 10, 1, 15, 30), Ny);
        Assert.Contains(r.Available, p => p.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task GetTimeOffPersonIds_combines_time_off_and_events()
    {
        var (ctx, svc) = await Arrange(c =>
        {
            c.TimeOffRequests.Add(Off(1, new DateTime(2026, 10, 1), new DateTime(2026, 10, 1)));
            c.ShiftEvents.Add(Sick(2, U(2026, 10, 1, 15)));
        });
        var ids = await svc.GetTimeOffPersonIdsAsync(Co, U(2026, 10, 1, 7), U(2026, 10, 1, 15, 30), Ny);
        Assert.Equal(new[] { 1, 2 }, ids.OrderBy(x => x));
        await ctx.DisposeAsync();
    }

    [Theory]
    [InlineData(2026, 11, 1)]   // fall-back day (25h)
    [InlineData(2026, 3, 8)]    // spring-forward day (23h)
    public async Task Dst_transition_days_do_not_throw_and_still_block_with_an_event(int y, int m, int d)
    {
        // 15:00Z is mid-day in New York on both dates.
        var (ctx, svc) = await Arrange(c => c.ShiftEvents.Add(Sick(2, U(y, m, d, 15))));
        var (s, e) = LineupTime.WallDayWindow(new DateOnly(y, m, d));
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Contains(r.Unavailable, u => u.Person.PersonId == 2 && u.Reason == UnavailableReason.TimeOff);
        await ctx.DisposeAsync();
    }
}
