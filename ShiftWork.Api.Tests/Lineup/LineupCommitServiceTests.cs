using Microsoft.EntityFrameworkCore;
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

    public static LineupCommitService Create(ShiftWorkContext ctx)
    {
        var settings = new CompanySettingsService(ctx);
        return new LineupCommitService(
            ctx,
            new CompanyTimeZoneService(ctx),
            new ScheduleShiftService(ctx, NullLogger<ScheduleShiftService>.Instance),
            new ScheduleValidationService(ctx, settings),
            settings,
            FakePush.Create(ctx),
            new FakeTimeProvider(Now),
            NullLogger<LineupCommitService>.Instance);
    }
}

public class LineupCommitServiceTests
{
    private const string Co = LineupTestData.CompanyId;
    private static readonly DateOnly Day = new(2026, 10, 1);

    // Shift times are floating wall-clock stored with Kind=Utc (Ruling 3): 07:00 is stored as 07:00Z.
    private static DateTime U(int m, int d, int h, int min = 0) => new(2026, m, d, h, min, 0, DateTimeKind.Utc);

    private static LineupAccess Boss() => new("cu", true, true, new HashSet<int>());
    private static LineupAccess OnlySite7() => new("cu", true, false, new HashSet<int> { 7 });

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

    [Fact]
    public async Task Creates_shift_from_default_and_a_single_day_lineup_schedule()
    {
        await using var ctx = await SeedAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 7), Boss());

        var res = Assert.Single(r.Results);
        Assert.Equal("created", res.Status);
        var shift = await ctx.ScheduleShifts.SingleAsync();
        Assert.Equal(U(10, 1, 7), shift.StartDate);
        Assert.Equal(U(10, 1, 15, 30), shift.EndDate);
        Assert.Equal(12, shift.AreaId);
        Assert.Equal("unpublished", shift.Status);
        Assert.Equal(res.ShiftId, shift.ScheduleShiftId);
        var schedule = await ctx.Schedules.SingleAsync();
        Assert.Equal(schedule.ScheduleId, shift.ScheduleId);
        Assert.Equal("Lineup 2026-10-01", schedule.Name);
        Assert.Equal("lineup", schedule.Type);
        Assert.Equal("1", schedule.PersonId);
    }

    [Fact]
    public async Task Auto_approve_publishes()
    {
        await using var ctx = await SeedAsync(autoApprove: true);
        await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 7), Boss());
        Assert.Equal("Published", (await ctx.ScheduleShifts.SingleAsync()).Status);
    }

    [Fact]
    public async Task Explicit_times_and_area_override_the_default()
    {
        await using var ctx = await SeedAsync();
        await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 7, "08:00", "12:00", 12), Boss());
        var shift = await ctx.ScheduleShifts.SingleAsync();
        Assert.Equal(U(10, 1, 8), shift.StartDate);
        Assert.Equal(U(10, 1, 12), shift.EndDate);
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
        Assert.Equal(1, await ctx.ScheduleShifts.CountAsync());
    }

    [Fact]
    public async Task Reuses_a_covering_schedule_instead_of_creating_one()
    {
        await using var ctx = await SeedAsync();
        ctx.Schedules.Add(new Schedule { ScheduleId = 900, Name = "Week", CompanyId = Co, PersonId = "1", LocationId = 7,
            StartDate = U(9, 28, 0), EndDate = U(10, 5, 0), Status = "Published" });
        await ctx.SaveChangesAsync();
        await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 7), Boss());
        Assert.Equal(900, (await ctx.ScheduleShifts.SingleAsync()).ScheduleId);
        Assert.Equal(1, await ctx.Schedules.CountAsync());
    }

    [Fact]
    public async Task No_default_and_no_times_is_rejected()
    {
        await using var ctx = await SeedAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 8), Boss());
        var res = r.Results.Single();
        Assert.Equal("rejected", res.Status);
        Assert.Contains("No shift time set for this location", res.Errors);
        Assert.Empty(ctx.ScheduleShifts);
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
        Assert.Equal(2, (await ctx.ScheduleShifts.SingleAsync()).PersonId);
    }

    [Theory]
    [InlineData(3)]   // inactive
    [InlineData(5)]   // other company
    [InlineData(99)]  // unknown
    public async Task Inactive_foreign_or_unknown_people_are_rejected(int personId)
    {
        await using var ctx = await SeedAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(personId, 7), Boss());
        Assert.Equal("rejected", r.Results.Single().Status);
        Assert.Empty(ctx.ScheduleShifts);
    }

    [Fact] // Review Focus 4
    public async Task Overlap_is_never_overridable_by_accept_warnings()
    {
        await using var ctx = await SeedAsync();
        ctx.ScheduleShifts.Add(new ScheduleShift { CompanyId = Co, PersonId = 2, LocationId = 9, AreaId = 14,
            StartDate = U(10, 1, 7), EndDate = U(10, 1, 15, 30), Status = "Published" });
        await ctx.SaveChangesAsync();

        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(2, 7, accept: true), Boss());
        var res = r.Results.Single();
        Assert.Equal("rejected", res.Status);
        Assert.NotEmpty(res.Errors);
        Assert.Equal(1, await ctx.ScheduleShifts.CountAsync());
    }

    [Fact]
    public async Task Warning_needs_confirmation_then_accept_warnings_creates()
    {
        // Person 1 already worked Sep 30 and the company allows 1 consecutive day, so Oct 1 is a warning
        // (8h rest is satisfied: Sep 30 15:30 -> Oct 1 07:00 is 15.5h).
        await using var ctx = await SeedAsync(maxConsecutiveDays: 1);
        ctx.ScheduleShifts.Add(new ScheduleShift { ScheduleShiftId = 605, CompanyId = Co, PersonId = 1, LocationId = 7, AreaId = 12,
            StartDate = U(9, 30, 7), EndDate = U(9, 30, 15, 30), Status = "Published" });
        await ctx.SaveChangesAsync();
        var svc = CommitTestFactory.Create(ctx);

        var first = (await svc.CommitAsync(Co, Day, Assign(1, 7), Boss())).Results.Single();
        Assert.Equal("needs-confirmation", first.Status);
        Assert.NotEmpty(first.Warnings);
        Assert.Equal(1, await ctx.ScheduleShifts.CountAsync());

        var second = (await svc.CommitAsync(Co, Day, Assign(1, 7, accept: true), Boss())).Results.Single();
        Assert.Equal("created", second.Status);
        Assert.Equal(2, await ctx.ScheduleShifts.CountAsync());
    }

    [Fact] // Review Focus 3
    public async Task Moving_a_person_between_sites_in_one_commit_succeeds()
    {
        await using var ctx = await SeedAsync();
        ctx.ScheduleShifts.Add(new ScheduleShift { ScheduleShiftId = 601, CompanyId = Co, PersonId = 2, LocationId = 9, AreaId = 14,
            StartDate = U(10, 1, 7), EndDate = U(10, 1, 15, 30), Status = "Published" });
        await ctx.SaveChangesAsync();

        var req = new LineupCommitRequest("2026-10-01", new() { new LineupAssignmentDto(2, 7, null, null, null, false) }, new() { 601 });
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, req, Boss());

        Assert.Equal(new[] { "removed", "created" }, r.Results.Select(x => x.Status));
        var remaining = await ctx.ScheduleShifts.SingleAsync();
        Assert.Equal(7, remaining.LocationId);
    }

    [Fact]
    public async Task Past_or_started_shift_cannot_be_removed()
    {
        await using var ctx = await SeedAsync();
        // Wall 06:00 in New York on Sep 29 = 10:00Z, which is 2h before "now" (12:00Z).
        ctx.ScheduleShifts.Add(new ScheduleShift { ScheduleShiftId = 602, CompanyId = Co, PersonId = 1, LocationId = 7, AreaId = 12,
            StartDate = U(9, 29, 6), EndDate = U(9, 29, 14), Status = "Published" });
        await ctx.SaveChangesAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, new("2026-10-01", null, new() { 602 }), Boss());
        Assert.Equal("rejected", r.Results.Single().Status);
        Assert.Contains("Only future shifts can be removed.", r.Results.Single().Errors);
        Assert.Equal(1, await ctx.ScheduleShifts.CountAsync());
    }

    [Fact]
    public async Task Removal_respects_scope_and_tenant()
    {
        await using var ctx = await SeedAsync();
        ctx.ScheduleShifts.AddRange(
            new ScheduleShift { ScheduleShiftId = 603, CompanyId = Co, PersonId = 1, LocationId = 9, AreaId = 14,
                StartDate = U(10, 1, 11), EndDate = U(10, 1, 19), Status = "Published" },
            new ScheduleShift { ScheduleShiftId = 604, CompanyId = "other-co", PersonId = 5, LocationId = 70, AreaId = 1,
                StartDate = U(10, 1, 11), EndDate = U(10, 1, 19), Status = "Published" });
        await ctx.SaveChangesAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, new("2026-10-01", null, new() { 603, 604, 9999 }), OnlySite7());
        Assert.All(r.Results, x => Assert.Equal("rejected", x.Status));
        Assert.All(r.Results, x => Assert.Contains("Shift not found.", x.Errors));
        Assert.Equal(2, await ctx.ScheduleShifts.CountAsync());
    }

    [Fact]
    public async Task Bad_time_text_is_rejected_not_thrown()
    {
        await using var ctx = await SeedAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 7, "seven", "15:30"), Boss());
        Assert.Equal("rejected", r.Results.Single().Status);
    }
}
