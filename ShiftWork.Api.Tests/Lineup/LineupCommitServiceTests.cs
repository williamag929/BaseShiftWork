using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using ShiftWork.Api.Tests.TestHelpers;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

internal static class CommitTestFactory
{
    public static readonly DateTimeOffset Now = new(2026, 9, 29, 12, 0, 0, TimeSpan.Zero);

    public static LineupCommitService Create(ShiftWorkContext ctx, Func<IScheduleService, IScheduleService>? wrapSchedules = null, IMemoryCache? cache = null)
    {
        var settings = new CompanySettingsService(ctx);
        IScheduleService schedules = new ScheduleService(ctx, NullLogger<ScheduleService>.Instance);
        if (wrapSchedules != null) schedules = wrapSchedules(schedules);
        return new LineupCommitService(
            ctx,
            new CompanyTimeZoneService(ctx),
            schedules,
            new ScheduleValidationService(ctx, settings),
            new AvailabilityService(ctx),
            settings,
            FakePush.Create(ctx),
            new FakeTimeProvider(Now),
            cache ?? new MemoryCache(new MemoryCacheOptions()),
            NullLogger<LineupCommitService>.Instance);
    }
}

// Fails once, like a SaveChanges error would: it first TRACKS an entity in the shared context (an added Schedule for Add,
// a removed Schedule for Delete) and then throws, so the service's DetachPending is what keeps the next item clean.
internal sealed class ThrowOnceScheduleService : IScheduleService
{
    private readonly ShiftWorkContext _ctx;
    private readonly IScheduleService _inner;
    private readonly bool _onAdd;
    private bool _thrown;

    public ThrowOnceScheduleService(ShiftWorkContext ctx, IScheduleService inner, bool onAdd = true)
    {
        _ctx = ctx; _inner = inner; _onAdd = onAdd;
    }

    public Task<Schedule> Add(Schedule schedule)
    {
        if (_onAdd && !_thrown)
        {
            _thrown = true;
            _ctx.Schedules.Add(schedule);
            throw new InvalidOperationException("boom");
        }
        return _inner.Add(schedule);
    }

    public async Task<bool> Delete(int scheduleId)
    {
        if (!_onAdd && !_thrown)
        {
            _thrown = true;
            var tracked = await _ctx.Schedules.FindAsync(scheduleId);
            _ctx.Schedules.Remove(tracked!);
            throw new InvalidOperationException("boom");
        }
        return await _inner.Delete(scheduleId);
    }

    public Task<IEnumerable<Schedule>> GetAll(string companyId) => _inner.GetAll(companyId);
    public Task<Schedule> Get(string companyId, int scheduleId) => _inner.Get(companyId, scheduleId);
    public Task<IEnumerable<Schedule>> GetSchedules(string companyId, int? personId, int? locationId, DateTime? startDate, DateTime? endDate, string searchQuery) =>
        _inner.GetSchedules(companyId, personId, locationId, startDate, endDate, searchQuery);
    public Task<(IEnumerable<Schedule> Items, int TotalCount)> GetSchedulesPaged(string companyId, int? personId, int? locationId, DateTime? startDate, DateTime? endDate, string searchQuery, int page, int pageSize, bool includeVoided = false) =>
        _inner.GetSchedulesPaged(companyId, personId, locationId, startDate, endDate, searchQuery, page, pageSize, includeVoided);
    public Task<Schedule> Update(Schedule schedule) => _inner.Update(schedule);
    public Task<Schedule> VoidSchedule(int scheduleId, string voidedBy) => _inner.VoidSchedule(scheduleId, voidedBy);
}

public class LineupCommitServiceTests
{
    private const string Co = LineupTestData.CompanyId;
    private static readonly DateOnly Day = new(2026, 10, 1);

    // Schedule times are floating wall-clock stored with Kind=Utc (Ruling 3): 07:00 is stored as 07:00Z.
    private static DateTime U(int m, int d, int h, int min = 0) => new(2026, m, d, h, min, 0, DateTimeKind.Utc);

    private static LineupAccess Boss() => new("cu", true, true, new HashSet<int>());
    private static LineupAccess OnlySite7() => new("cu", true, false, new HashSet<int> { 7 });

    private static Schedule Sched(int id, int person, int? location, DateTime start, DateTime end,
        string status = "Published", string company = Co, int? area = null) => new()
    {
        ScheduleId = id, Name = "Existing", CompanyId = company, PersonId = person.ToString(), LocationId = location,
        AreaId = area, StartDate = start, EndDate = end, Status = status, Type = "Shift"
    };

    // The daily/weekly-hours checks in ScheduleValidationService use EF.Functions.DateDiffMinute, which the
    // InMemory provider cannot translate, so the seed switches those two limits off. Everything else keeps
    // the real defaults (overlap disallowed, 8h rest, 6 consecutive days).
    private static async Task<ShiftWorkContext> SeedAsync(bool autoApprove = false, int? maxConsecutiveDays = null)
    {
        var ctx = LineupTestData.NewContext();
        ctx.Companies.Add(LineupTestData.Company());
        ctx.Locations.AddRange(
            LineupTestData.Location(7, "Main St", settings: """{"defaultShift":{"start":"07:00","end":"15:30","areaId":12}}"""),
            LineupTestData.Location(8, "No Default"),
            LineupTestData.Location(9, "Second", settings: """{"defaultShift":{"start":"07:00","end":"15:30","areaId":14}}"""));
        ctx.Areas.AddRange(
            new Area { AreaId = 12, Name = "A12", CompanyId = Co, LocationId = 7 },
            new Area { AreaId = 13, Name = "A13", CompanyId = Co, LocationId = 8 },
            new Area { AreaId = 14, Name = "A14", CompanyId = Co, LocationId = 9 });
        ctx.Persons.AddRange(
            new Person { PersonId = 1, Name = "One", CompanyId = Co, Email = "1@x", Status = "Active" },
            new Person { PersonId = 2, Name = "Two", CompanyId = Co, Email = "2@x", Status = "Active" },
            new Person { PersonId = 3, Name = "Gone", CompanyId = Co, Email = "3@x", Status = "Inactive" },
            new Person { PersonId = 5, Name = "Foreign", CompanyId = "other-co", Email = "5@x", Status = "Active" });
        var settings = new CompanySettings
        {
            CompanyId = Co, AutoApproveShifts = autoApprove,
            MaximumDailyHours = null, MaximumWeeklyHours = null
        };
        if (maxConsecutiveDays.HasValue) settings.MaximumConsecutiveWorkDays = maxConsecutiveDays;
        ctx.CompanySettings.Add(settings);
        await ctx.SaveChangesAsync();
        return ctx;
    }

    private static LineupCommitRequest Assign(int person, int location, string? start = null, string? end = null,
        int? area = null, bool accept = false) =>
        new("2026-10-01", new() { new LineupAssignmentDto(person, location, area, start, end, accept) }, null);

    private static LineupCommitRequest Remove(params int[] ids) => new("2026-10-01", null, ids.ToList());

    [Fact]
    public async Task Creates_a_schedule_row_from_the_site_default_and_no_schedule_shift()
    {
        await using var ctx = await SeedAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 7), Boss());

        var res = Assert.Single(r.Results);
        Assert.Equal("created", res.Status);
        var s = await ctx.Schedules.SingleAsync();
        Assert.Equal(U(10, 1, 7), s.StartDate);
        Assert.Equal(U(10, 1, 15, 30), s.EndDate);
        Assert.Equal("Shift", s.Type);
        Assert.Equal("Lineup 2026-10-01", s.Name);
        Assert.Equal("1", s.PersonId);
        Assert.Equal(7, s.LocationId);
        Assert.Equal(12, s.AreaId);
        Assert.Equal("unpublished", s.Status);
        Assert.Equal(Co, s.CompanyId);
        Assert.Equal("America/New_York", s.TimeZone);
        Assert.Equal("cu", s.CreatedBy);
        Assert.Equal(CommitTestFactory.Now.UtcDateTime, s.CreatedAt);
        Assert.Equal(s.ScheduleId, res.ShiftId);
        Assert.Empty(ctx.ScheduleShifts);
    }

    [Fact]
    public async Task Auto_approve_publishes()
    {
        await using var ctx = await SeedAsync(autoApprove: true);
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 7), Boss());
        Assert.Equal("created", r.Results.Single().Status);
        Assert.Equal("Published", (await ctx.Schedules.SingleAsync()).Status);
        Assert.Empty(ctx.ScheduleShifts);
    }

    [Fact]
    public async Task Explicit_times_and_area_override_the_default()
    {
        await using var ctx = await SeedAsync();
        await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 7, "08:00", "12:00", 12), Boss());
        var s = await ctx.Schedules.SingleAsync();
        Assert.Equal(U(10, 1, 8), s.StartDate);
        Assert.Equal(U(10, 1, 12), s.EndDate);
    }

    [Fact]
    public async Task Repeating_the_same_assignment_is_unchanged_not_a_duplicate()
    {
        await using var ctx = await SeedAsync();
        var svc = CommitTestFactory.Create(ctx);
        var first = await svc.CommitAsync(Co, Day, Assign(1, 7), Boss());
        var second = await svc.CommitAsync(Co, Day, Assign(1, 7), Boss());
        Assert.Equal("unchanged", second.Results.Single().Status);
        Assert.Equal(first.Results.Single().ShiftId, second.Results.Single().ShiftId);
        Assert.Equal(1, await ctx.Schedules.CountAsync());
    }

    [Fact]
    public async Task No_default_and_no_times_is_rejected()
    {
        await using var ctx = await SeedAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 8), Boss());
        var res = r.Results.Single();
        Assert.Equal("rejected", res.Status);
        Assert.Equal(new[] { "No shift time set for this location" }, res.Errors);
        Assert.Empty(ctx.Schedules);
    }

    [Fact]
    public async Task Out_of_scope_assignment_is_rejected_while_the_rest_proceed()
    {
        await using var ctx = await SeedAsync();
        var req = new LineupCommitRequest("2026-10-01", new()
        {
            new LineupAssignmentDto(1, 9, null, null, null, false),   // site 9 not in scope
            new LineupAssignmentDto(2, 7, null, null, null, false),
        }, null);
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, req, OnlySite7());
        Assert.Equal(new[] { "rejected", "created" }, r.Results.Select(x => x.Status));
        Assert.Equal(new[] { "You can't edit this job site." }, r.Results[0].Errors);
        Assert.Equal("2", (await ctx.Schedules.SingleAsync()).PersonId);
    }

    [Theory]
    [InlineData(3)]   // inactive
    [InlineData(5)]   // other company
    [InlineData(99)]  // unknown
    public async Task Inactive_foreign_or_unknown_people_are_rejected(int personId)
    {
        await using var ctx = await SeedAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(personId, 7), Boss());
        var res = r.Results.Single();
        Assert.Equal("rejected", res.Status);
        Assert.Equal(new[] { "Person not available." }, res.Errors);
        Assert.Empty(ctx.Schedules);
    }

    [Theory]
    [InlineData("seven", "15:30")]
    [InlineData("07:00", "07:00")]   // start == end
    [InlineData("07:00", null)]      // only one of the two given
    public async Task Bad_or_equal_times_are_rejected_not_thrown(string? start, string? end)
    {
        await using var ctx = await SeedAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 7, start, end), Boss());
        var res = r.Results.Single();
        Assert.Equal("rejected", res.Status);
        Assert.Equal(new[] { "Invalid shift time." }, res.Errors);
        Assert.Empty(ctx.Schedules);
    }

    [Fact] // Review Focus 4
    public async Task Overlap_with_a_schedule_at_another_site_is_never_overridable()
    {
        await using var ctx = await SeedAsync();
        ctx.Schedules.Add(Sched(610, 2, 9, U(10, 1, 7), U(10, 1, 15, 30), area: 14));
        await ctx.SaveChangesAsync();

        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(2, 7, accept: true), Boss());
        var res = r.Results.Single();
        Assert.Equal("rejected", res.Status);
        Assert.Equal(new[] { "This shift overlaps with an existing shift" }, res.Errors);
        Assert.Equal(1, await ctx.Schedules.CountAsync());
    }

    [Fact]
    public async Task Approved_time_off_is_rejected_even_with_accept_warnings()
    {
        await using var ctx = await SeedAsync();
        ctx.TimeOffRequests.Add(new TimeOffRequest
        {
            CompanyId = Co, PersonId = 2, Status = "Approved",
            StartDate = new DateTime(2026, 10, 1), EndDate = new DateTime(2026, 10, 1)
        });
        await ctx.SaveChangesAsync();

        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(2, 7, accept: true), Boss());
        var res = r.Results.Single();
        Assert.Equal("rejected", res.Status);
        Assert.Equal(new[] { "Time off" }, res.Errors);
        Assert.Empty(ctx.Schedules);
    }

    [Fact]
    public async Task A_sick_event_on_the_same_day_is_rejected_as_time_off()
    {
        await using var ctx = await SeedAsync();
        // Real instant 09:30Z = 05:30 in New York on Oct 1, before the 07:00 shift.
        ctx.ShiftEvents.Add(new ShiftEvent
        {
            EventLogId = Guid.NewGuid(), CompanyId = Co, PersonId = 2, EventType = "sick", EventDate = U(10, 1, 9, 30)
        });
        await ctx.SaveChangesAsync();

        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(2, 7, accept: true), Boss());
        var res = r.Results.Single();
        Assert.Equal("rejected", res.Status);
        Assert.Equal(new[] { "Time off" }, res.Errors);
        Assert.Empty(ctx.Schedules);
    }

    [Fact]
    public async Task Warning_needs_confirmation_then_accept_warnings_creates()
    {
        // Person 1 already worked Sep 30 and the company allows 1 consecutive day, so Oct 1 is a warning
        // (8h rest is satisfied: Sep 30 15:30 -> Oct 1 07:00 is 15.5h).
        await using var ctx = await SeedAsync(maxConsecutiveDays: 1);
        ctx.Schedules.Add(Sched(605, 1, 7, U(9, 30, 7), U(9, 30, 15, 30), area: 12));
        await ctx.SaveChangesAsync();
        var svc = CommitTestFactory.Create(ctx);

        var first = (await svc.CommitAsync(Co, Day, Assign(1, 7), Boss())).Results.Single();
        Assert.Equal("needs-confirmation", first.Status);
        Assert.Single(first.Warnings);
        Assert.Contains("consecutive work days", first.Warnings[0]);
        Assert.Equal(1, await ctx.Schedules.CountAsync());

        var second = (await svc.CommitAsync(Co, Day, Assign(1, 7, accept: true), Boss())).Results.Single();
        Assert.Equal("created", second.Status);
        Assert.Equal(2, await ctx.Schedules.CountAsync());
    }

    [Fact] // Review Focus 3
    public async Task Moving_a_person_between_sites_in_one_commit_succeeds()
    {
        await using var ctx = await SeedAsync();
        ctx.Schedules.Add(Sched(601, 2, 9, U(10, 1, 7), U(10, 1, 15, 30), area: 14));
        await ctx.SaveChangesAsync();

        var req = new LineupCommitRequest("2026-10-01", new() { new LineupAssignmentDto(2, 7, null, null, null, false) }, new() { 601 });
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, req, Boss());

        Assert.Equal(new[] { "removed", "created" }, r.Results.Select(x => x.Status));
        Assert.Equal(601, r.Results[0].ShiftId);
        Assert.Equal(2, r.Results[0].PersonId);
        Assert.Equal(9, r.Results[0].LocationId);
        var remaining = await ctx.Schedules.SingleAsync();
        Assert.Equal(7, remaining.LocationId);
        Assert.Equal("2", remaining.PersonId);
    }

    [Fact]
    public async Task A_future_schedule_in_scope_can_be_removed()
    {
        await using var ctx = await SeedAsync();
        ctx.Schedules.Add(Sched(606, 1, 7, U(10, 1, 7), U(10, 1, 15, 30), area: 12));
        await ctx.SaveChangesAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Remove(606), OnlySite7());
        var res = r.Results.Single();
        Assert.Equal("removed", res.Status);
        Assert.Equal(1, res.PersonId);
        Assert.Empty(ctx.Schedules);
    }

    [Theory]
    [InlineData("void")]
    [InlineData("VOID")]
    public async Task A_void_schedule_is_never_removed_whatever_the_case(string status)
    {
        await using var ctx = await SeedAsync();
        ctx.Schedules.Add(Sched(700, 1, 7, U(10, 1, 7), U(10, 1, 15, 30), status: status, area: 12));
        await ctx.SaveChangesAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Remove(700), Boss());
        var res = r.Results.Single();
        Assert.Equal("rejected", res.Status);
        Assert.Equal(new[] { "Shift not found." }, res.Errors);
        Assert.Equal(1, await ctx.Schedules.CountAsync());
    }

    [Theory]
    [InlineData("")]
    [InlineData("Not/AZone")]
    public async Task Removal_falls_back_to_the_company_zone_when_the_site_zone_is_blank_or_invalid(string tz)
    {
        await using var ctx = await SeedAsync();
        ctx.Locations.Add(LineupTestData.Location(10, "BadTz", tz: tz));
        // Wall 10:00 on Sep 29: in the company zone (New York) that is 14:00Z, after "now" (12:00Z); read as UTC it would be 10:00Z, already started.
        ctx.Schedules.Add(Sched(701, 1, 10, U(9, 29, 10), U(9, 29, 14)));
        await ctx.SaveChangesAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Remove(701), Boss());
        Assert.Equal("removed", r.Results.Single().Status);
        Assert.Empty(ctx.Schedules);
    }

    [Theory]
    [InlineData("")]
    [InlineData("Not/AZone")]
    public async Task Assignment_stamps_the_company_zone_when_the_site_zone_is_blank_or_invalid(string tz)
    {
        await using var ctx = await SeedAsync();
        ctx.Locations.Add(LineupTestData.Location(10, "BadTz", tz: tz, settings: """{"defaultShift":{"start":"07:00","end":"15:30","areaId":15}}"""));
        ctx.Areas.Add(new Area { AreaId = 15, Name = "A15", CompanyId = Co, LocationId = 10 });
        await ctx.SaveChangesAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 10), Boss());
        Assert.Equal("created", r.Results.Single().Status);
        Assert.Equal("America/New_York", (await ctx.Schedules.SingleAsync()).TimeZone);
    }

    [Fact]
    public async Task Successful_add_and_delete_invalidate_the_grid_cache_keys()
    {
        await using var ctx = await SeedAsync();
        ctx.Schedules.Add(Sched(702, 1, 7, U(10, 1, 7), U(10, 1, 15, 30), area: 12));
        await ctx.SaveChangesAsync();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var svc = CommitTestFactory.Create(ctx, cache: cache);

        cache.Set($"schedules_{Co}", "stale");
        cache.Set($"schedule_{Co}_702", "stale");
        await svc.CommitAsync(Co, Day, Remove(702), Boss());
        Assert.False(cache.TryGetValue($"schedules_{Co}", out _));
        Assert.False(cache.TryGetValue($"schedule_{Co}_702", out _));

        cache.Set($"schedules_{Co}", "stale");
        var r = await svc.CommitAsync(Co, Day, Assign(2, 7), Boss());
        Assert.Equal("created", r.Results.Single().Status);
        Assert.False(cache.TryGetValue($"schedules_{Co}", out _));
    }

    [Fact]
    public async Task Rejected_removal_leaves_the_grid_cache_alone()
    {
        await using var ctx = await SeedAsync();
        var cache = new MemoryCache(new MemoryCacheOptions());
        cache.Set($"schedules_{Co}", "fresh");
        await CommitTestFactory.Create(ctx, cache: cache).CommitAsync(Co, Day, Remove(9999), Boss());
        Assert.True(cache.TryGetValue($"schedules_{Co}", out _));
    }

    [Fact]
    public async Task Past_or_started_schedule_cannot_be_removed()
    {
        await using var ctx = await SeedAsync();
        // Wall 06:00 in New York on Sep 29 = 10:00Z, which is 2h before "now" (12:00Z).
        ctx.Schedules.Add(Sched(602, 1, 7, U(9, 29, 6), U(9, 29, 14), area: 12));
        await ctx.SaveChangesAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Remove(602), Boss());
        var res = r.Results.Single();
        Assert.Equal("rejected", res.Status);
        Assert.Equal(new[] { "Only future shifts can be removed." }, res.Errors);
        Assert.Equal(1, await ctx.Schedules.CountAsync());
    }

    [Fact]
    public async Task Removal_respects_scope_tenant_and_site_less_schedules()
    {
        await using var ctx = await SeedAsync();
        ctx.Schedules.AddRange(
            Sched(603, 1, 9, U(10, 1, 11), U(10, 1, 19), area: 14),                              // site not in scope
            Sched(604, 5, 70, U(10, 1, 11), U(10, 1, 19), company: "other-co"),                  // other tenant
            Sched(607, 1, null, U(10, 1, 11), U(10, 1, 19)));                                    // no site
        await ctx.SaveChangesAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Remove(603, 604, 607, 9999), OnlySite7());
        Assert.Equal(4, r.Results.Count);
        Assert.All(r.Results, x => Assert.Equal("rejected", x.Status));
        Assert.All(r.Results, x => Assert.Equal(new[] { "Shift not found." }, x.Errors));
        Assert.Equal(3, await ctx.Schedules.CountAsync());
    }

    [Fact]
    public async Task A_failing_assignment_does_not_poison_the_rest()
    {
        await using var ctx = await SeedAsync();
        var req = new LineupCommitRequest("2026-10-01", new()
        {
            new LineupAssignmentDto(1, 7, null, null, null, false),   // Add tracks the Schedule, then throws
            new LineupAssignmentDto(2, 7, null, null, null, false),
        }, null);
        var r = await CommitTestFactory.Create(ctx, inner => new ThrowOnceScheduleService(ctx, inner))
            .CommitAsync(Co, Day, req, Boss());

        Assert.Equal(new[] { "rejected", "created" }, r.Results.Select(x => x.Status));
        Assert.Equal(new[] { "Could not assign this person." }, r.Results[0].Errors);
        // Without DetachPending the failed candidate would still be tracked and the second SaveChanges would persist it.
        var only = await ctx.Schedules.SingleAsync();
        Assert.Equal("2", only.PersonId);
        Assert.DoesNotContain(ctx.ChangeTracker.Entries<Schedule>(), e => e.Entity.PersonId == "1");
    }

    [Fact]
    public async Task A_failing_removal_does_not_poison_the_rest()
    {
        await using var ctx = await SeedAsync();
        ctx.Schedules.Add(Sched(608, 1, 7, U(10, 1, 7), U(10, 1, 15, 30), area: 12));
        await ctx.SaveChangesAsync();
        var req = new LineupCommitRequest("2026-10-01", new() { new LineupAssignmentDto(2, 7, null, null, null, false) }, new() { 608 });
        var r = await CommitTestFactory.Create(ctx, inner => new ThrowOnceScheduleService(ctx, inner, onAdd: false))
            .CommitAsync(Co, Day, req, Boss());

        Assert.Equal(new[] { "rejected", "created" }, r.Results.Select(x => x.Status));
        Assert.Equal(new[] { "Could not remove this shift." }, r.Results[0].Errors);
        // The half-done removal was detached, so the later SaveChanges must not delete schedule 608.
        Assert.Equal(new[] { "1", "2" }, (await ctx.Schedules.OrderBy(s => s.ScheduleId).ToListAsync()).Select(s => s.PersonId).OrderBy(x => x).ToArray());
    }
}
