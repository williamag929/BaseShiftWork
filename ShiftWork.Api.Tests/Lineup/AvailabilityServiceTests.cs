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

    private static DateTime U(int y, int m, int d, int h) => new(y, m, d, h, 0, 0, DateTimeKind.Utc);

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
}
