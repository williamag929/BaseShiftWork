using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class LineupQueryServiceTests
{
    private const string Co = LineupTestData.CompanyId;
    private static readonly DateOnly Day = new(2026, 10, 1);
    // Shift times are floating wall-clock digits labelled UTC, so these seeds read as 11:00-19:00 on the day.
    private static DateTime U(int d, int h) => new(2026, 10, d, h, 0, 0, DateTimeKind.Utc);

    private static async Task<(ShiftWorkContext, LineupQueryService)> ArrangeAsync()
    {
        var ctx = LineupTestData.NewContext();
        ctx.Companies.Add(LineupTestData.Company());
        ctx.Locations.AddRange(
            LineupTestData.Location(7, "Main St", settings: """{"defaultShift":{"start":"07:00","end":"15:30","areaId":12}}"""),
            LineupTestData.Location(8, "Secret Site"),
            LineupTestData.Location(9, "Closed", status: "Inactive"),
            LineupTestData.Location(70, "Foreign", companyId: "other-co"));
        ctx.Persons.AddRange(
            new Person { PersonId = 1, Name = "OnCard", CompanyId = Co, Email = "1@x", Status = "Active" },
            new Person { PersonId = 2, Name = "Elsewhere", CompanyId = Co, Email = "2@x", Status = "Active" },
            new Person { PersonId = 3, Name = "Bench", CompanyId = Co, Email = "3@x", Status = "Active" },
            new Person { PersonId = 4, Name = "OffDay", CompanyId = Co, Email = "4@x", Status = "Active" },
            new Person { PersonId = 5, Name = "Foreign", CompanyId = "other-co", Email = "5@x", Status = "Active" });
        ctx.ScheduleShifts.AddRange(
            new ScheduleShift { ScheduleShiftId = 501, CompanyId = Co, PersonId = 1, LocationId = 7, AreaId = 12, StartDate = U(1, 11), EndDate = U(1, 19), Status = "Published" },
            new ScheduleShift { ScheduleShiftId = 502, CompanyId = Co, PersonId = 2, LocationId = 8, AreaId = 13, StartDate = U(1, 11), EndDate = U(1, 19), Status = "Published" },
            new ScheduleShift { ScheduleShiftId = 503, CompanyId = Co, PersonId = 3, LocationId = 7, AreaId = 12, StartDate = U(3, 11), EndDate = U(3, 19), Status = "Published" });
        ctx.TimeOffRequests.Add(new TimeOffRequest { CompanyId = Co, PersonId = 4, Status = "Approved", StartDate = new DateTime(2026, 10, 1), EndDate = new DateTime(2026, 10, 1) });
        var crew = new Crew { CrewId = 2, Name = "Alpha", CompanyId = Co };
        ctx.Crews.Add(crew);
        ctx.PersonCrews.AddRange(new PersonCrew { PersonId = 3, CrewId = 2 }, new PersonCrew { PersonId = 1, CrewId = 2 });
        await ctx.SaveChangesAsync();
        var svc = new LineupQueryService(ctx, new CompanyTimeZoneService(ctx), new AvailabilityService(ctx));
        return (ctx, svc);
    }

    private static LineupAccess Foreman() => new("cu", true, false, new HashSet<int> { 7 });
    private static LineupAccess Boss() => new("cu", true, true, new HashSet<int>());

    [Fact]
    public async Task Foreman_sees_only_scoped_active_locations_with_their_shifts()
    {
        var (ctx, svc) = await ArrangeAsync();
        var r = await svc.GetAsync(Co, Day, Foreman());
        var loc = Assert.Single(r.Locations);
        Assert.Equal(7, loc.LocationId);
        Assert.Equal("07:00", loc.DefaultShift!.Start);
        Assert.Equal(12, loc.DefaultShift.AreaId);
        var shift = Assert.Single(loc.Shifts);
        Assert.Equal(501, shift.ShiftId);
        Assert.Equal("OnCard", shift.Name);
        Assert.Equal(U(1, 11), shift.Start);   // stored wall-clock value, unchanged
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task All_locations_user_sees_every_active_site_but_not_inactive_or_foreign()
    {
        var (ctx, svc) = await ArrangeAsync();
        var r = await svc.GetAsync(Co, Day, Boss());
        Assert.Equal(new[] { 7, 8 }, r.Locations.Select(l => l.LocationId).OrderBy(x => x));
        Assert.Null(r.Locations.Single(l => l.LocationId == 8).DefaultShift);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Bench_unavailable_and_crews_are_computed_without_leaking_site_names()
    {
        var (ctx, svc) = await ArrangeAsync();
        var r = await svc.GetAsync(Co, Day, Foreman());

        Assert.Equal(new[] { 3 }, r.Bench.Select(p => p.PersonId));
        Assert.Equal(new[] { 2 }, r.Bench.Single().CrewIds);

        var byId = r.Unavailable.ToDictionary(u => u.PersonId);
        Assert.False(byId.ContainsKey(1));                  // on a visible card
        Assert.Equal("Assigned to another site", byId[2].Reason);
        Assert.DoesNotContain("Secret", byId[2].Reason);
        Assert.Equal("Time off", byId[4].Reason);
        Assert.DoesNotContain(r.Unavailable, u => u.PersonId == 5);   // tenant isolation

        var crew = Assert.Single(r.Crews);
        Assert.Equal(new[] { 1, 3 }, crew.MemberIds.OrderBy(x => x));
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Envelope_has_date_zone_and_can_edit()
    {
        var (ctx, svc) = await ArrangeAsync();
        var r = await svc.GetAsync(Co, Day, new LineupAccess("cu", false, true, new HashSet<int>()));
        Assert.Equal("2026-10-01", r.Date);
        Assert.Equal("America/New_York", r.TimeZone);
        Assert.False(r.CanEdit);
        await ctx.DisposeAsync();
    }
}
