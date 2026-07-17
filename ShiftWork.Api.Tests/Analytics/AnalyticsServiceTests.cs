using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Caching.Memory;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Analytics;

public class AnalyticsServiceTests : IDisposable
{
    private readonly ShiftWorkContext _context;
    private readonly AnalyticsService _sut;

    private const int CompanyA = 1;
    private const int CompanyB = 2;
    private static readonly DateTime From = new(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime To = new(2026, 7, 31, 23, 59, 59, DateTimeKind.Utc);

    public AnalyticsServiceTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new ShiftWorkContext(options);
        _sut = new AnalyticsService(_context, new MemoryCache(new MemoryCacheOptions()));
    }

    private static AnalyticsQueryDto Query(string groupBy = "day", int? personId = null, int? locationId = null) => new()
    {
        From = From,
        To = To,
        GroupBy = groupBy,
        PersonId = personId,
        LocationId = locationId,
    };

    private void SeedPerson(int companyId, int personId, string name)
        => _context.Persons.Add(new Person { PersonId = personId, CompanyId = companyId.ToString(), Name = name, Email = $"{name}@x.com", Status = "Active" });

    private void SeedLocation(int companyId, int locationId, string name)
        => _context.Locations.Add(new Location
        {
            LocationId = locationId, CompanyId = companyId.ToString(), Name = name,
            Address = "", City = "", State = "", Country = "", ZipCode = "", TimeZone = "UTC",
            GeoCoordinates = "", Status = "active",
        });

    private void SeedShift(int companyId, int personId, int locationId, DateTime start, DateTime end, int? breakMin = 0, string status = "Published")
        => _context.ScheduleShifts.Add(new ScheduleShift
        {
            CompanyId = companyId.ToString(), PersonId = personId, LocationId = locationId, AreaId = 0,
            StartDate = start, EndDate = end, BreakDuration = breakMin, Status = status,
        });

    private void SeedClock(int companyId, int personId, string type, DateTime at)
        => _context.ShiftEvents.Add(new ShiftEvent { EventLogId = Guid.NewGuid(), CompanyId = companyId.ToString(), PersonId = personId, EventType = type, EventDate = at });

    // ── Worked hours from clock pairs ───────────────────────────────────────

    [Fact]
    public async Task HoursSummary_WorkedHours_FromClockInOutPair_MinusBreak()
    {
        SeedPerson(CompanyA, 10, "Ana");
        SeedClock(CompanyA, 10, "clockin", new DateTime(2026, 7, 5, 9, 0, 0, DateTimeKind.Utc));
        SeedClock(CompanyA, 10, "clockout", new DateTime(2026, 7, 5, 17, 0, 0, DateTimeKind.Utc));
        await _context.SaveChangesAsync();

        var result = await _sut.GetHoursSummaryAsync(CompanyA, Query());

        // 8 hours span minus 0.5h default break = 7.5
        Assert.Equal(7.5, result.Totals["worked"]);
        var worked = result.Series.Single(s => s.Key == "worked");
        Assert.Equal("2026-07-05", worked.Points.Single().X);
        Assert.Equal(7.5, worked.Points.Single().Y);
    }

    [Fact]
    public async Task HoursSummary_UnclosedShift_ExcludedFromWorked_AndFlagged()
    {
        SeedPerson(CompanyA, 10, "Ana");
        SeedClock(CompanyA, 10, "clockin", new DateTime(2026, 7, 5, 9, 0, 0, DateTimeKind.Utc)); // no clockout
        await _context.SaveChangesAsync();

        var result = await _sut.GetHoursSummaryAsync(CompanyA, Query());

        Assert.Equal(0, result.Totals["worked"]);
        Assert.Equal(1, result.Totals["unclosedShifts"]);
    }

    // ── Tenant isolation ────────────────────────────────────────────────────

    [Fact]
    public async Task HoursSummary_IsScopedByCompany_TenantCannotSeeOther()
    {
        SeedPerson(CompanyA, 10, "Ana");
        SeedPerson(CompanyB, 20, "Bob");
        SeedClock(CompanyA, 10, "clockin", new DateTime(2026, 7, 5, 9, 0, 0, DateTimeKind.Utc));
        SeedClock(CompanyA, 10, "clockout", new DateTime(2026, 7, 5, 17, 0, 0, DateTimeKind.Utc));
        SeedClock(CompanyB, 20, "clockin", new DateTime(2026, 7, 5, 9, 0, 0, DateTimeKind.Utc));
        SeedClock(CompanyB, 20, "clockout", new DateTime(2026, 7, 5, 15, 0, 0, DateTimeKind.Utc));
        await _context.SaveChangesAsync();

        var a = await _sut.GetHoursSummaryAsync(CompanyA, Query());
        var b = await _sut.GetHoursSummaryAsync(CompanyB, Query());

        Assert.Equal(7.5, a.Totals["worked"]); // A only
        Assert.Equal(5.5, b.Totals["worked"]); // B only (6h - 0.5)
    }

    // ── Date boundaries ─────────────────────────────────────────────────────

    [Fact]
    public async Task HoursSummary_ExcludesEventsOutsideRange()
    {
        SeedPerson(CompanyA, 10, "Ana");
        // June 30 pair — before range, must be excluded
        SeedClock(CompanyA, 10, "clockin", new DateTime(2026, 6, 30, 9, 0, 0, DateTimeKind.Utc));
        SeedClock(CompanyA, 10, "clockout", new DateTime(2026, 6, 30, 17, 0, 0, DateTimeKind.Utc));
        await _context.SaveChangesAsync();

        var result = await _sut.GetHoursSummaryAsync(CompanyA, Query());

        Assert.Equal(0, result.Totals["worked"]);
    }

    // ── Schedule coverage ───────────────────────────────────────────────────

    [Fact]
    public async Task ScheduleCoverage_CountsOpenVsFilled()
    {
        SeedPerson(CompanyA, 10, "Ana");
        SeedLocation(CompanyA, 100, "HQ");
        SeedShift(CompanyA, 10, 100, new DateTime(2026, 7, 5, 9, 0, 0, DateTimeKind.Utc), new DateTime(2026, 7, 5, 17, 0, 0, DateTimeKind.Utc)); // filled
        SeedShift(CompanyA, 0, 100, new DateTime(2026, 7, 6, 9, 0, 0, DateTimeKind.Utc), new DateTime(2026, 7, 6, 17, 0, 0, DateTimeKind.Utc), status: "Open"); // open
        await _context.SaveChangesAsync();

        var result = await _sut.GetScheduleCoverageAsync(CompanyA, Query());

        Assert.Equal(2, result.Totals["totalShifts"]);
        Assert.Equal(1, result.Totals["openShifts"]);
        Assert.Equal(50, result.Totals["coveragePct"]);
    }

    // ── Attendance (grace-based on-time/late/no-show) ───────────────────────

    [Fact]
    public async Task Attendance_ClassifiesOnTimeLateAndNoShow()
    {
        _context.CompanySettings.Add(new CompanySettings { CompanyId = CompanyA.ToString(), GracePeriodLateClockIn = 5, DefaultLanguage = "en" });
        SeedPerson(CompanyA, 10, "OnTime");
        SeedPerson(CompanyA, 11, "Late");
        SeedPerson(CompanyA, 12, "NoShow");
        var start = new DateTime(2026, 7, 5, 9, 0, 0, DateTimeKind.Utc);
        var end = new DateTime(2026, 7, 5, 17, 0, 0, DateTimeKind.Utc);
        SeedShift(CompanyA, 10, 100, start, end);
        SeedShift(CompanyA, 11, 100, start, end);
        SeedShift(CompanyA, 12, 100, start, end);
        // On-time: clockin 09:03 (within 5-min grace)
        SeedClock(CompanyA, 10, "clockin", start.AddMinutes(3));
        SeedClock(CompanyA, 10, "clockout", end);
        // Late: clockin 09:20
        SeedClock(CompanyA, 11, "clockin", start.AddMinutes(20));
        SeedClock(CompanyA, 11, "clockout", end);
        // NoShow: no clock events
        await _context.SaveChangesAsync();

        var result = await _sut.GetAttendanceAsync(CompanyA, Query());

        Assert.Equal(1, result.Totals["onTime"]);
        Assert.Equal(1, result.Totals["late"]);
        Assert.Equal(1, result.Totals["noShow"]);
        Assert.Equal(33.33, result.Totals["onTimePct"]);
    }

    // ── Coverage grouped by location dimension ──────────────────────────────

    [Fact]
    public async Task Coverage_GroupByLocation_UsesLocationLabels()
    {
        SeedPerson(CompanyA, 10, "Ana");
        SeedLocation(CompanyA, 100, "HQ");
        SeedShift(CompanyA, 10, 100, new DateTime(2026, 7, 5, 9, 0, 0, DateTimeKind.Utc), new DateTime(2026, 7, 5, 17, 0, 0, DateTimeKind.Utc));
        await _context.SaveChangesAsync();

        var result = await _sut.GetScheduleCoverageAsync(CompanyA, Query(groupBy: "location"));

        Assert.Equal("location", result.Dimension);
        var filled = result.Series.Single(s => s.Key == "filled");
        Assert.Equal("HQ", filled.Points.Single().X);
    }

    // ── KPIs (delta vs previous period) ─────────────────────────────────────

    [Fact]
    public async Task Kpis_WorkedHours_ComputesDeltaVsPreviousPeriod()
    {
        SeedPerson(CompanyA, 10, "Ana");
        // Current period (July): 7.5 worked
        SeedClock(CompanyA, 10, "clockin", new DateTime(2026, 7, 5, 9, 0, 0, DateTimeKind.Utc));
        SeedClock(CompanyA, 10, "clockout", new DateTime(2026, 7, 5, 17, 0, 0, DateTimeKind.Utc));
        // Previous equal-length window is [From - span, From] → early June; add a 3.5h pair there
        SeedClock(CompanyA, 10, "clockin", new DateTime(2026, 6, 10, 9, 0, 0, DateTimeKind.Utc));
        SeedClock(CompanyA, 10, "clockout", new DateTime(2026, 6, 10, 13, 0, 0, DateTimeKind.Utc));
        await _context.SaveChangesAsync();

        var result = await _sut.GetKpisAsync(CompanyA, Query());

        var worked = result.Kpis.Single(k => k.Key == "worked");
        Assert.Equal(7.5, worked.Value);
        Assert.Equal(3.5, worked.PreviousValue);
    }

    public void Dispose() => _context.Dispose();
}
