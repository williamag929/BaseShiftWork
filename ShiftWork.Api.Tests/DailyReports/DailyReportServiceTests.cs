using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.DailyReports;

public class DailyReportServiceTests : IDisposable
{
    private readonly ShiftWorkContext _context;
    private readonly DailyReportService _sut;

    private const string CompanyA = "company-a";
    private const string CompanyB = "company-b";
    private const int LocationId = 1;

    public DailyReportServiceTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        _context = new ShiftWorkContext(options);

        var weatherMock = new Mock<IWeatherService>();
        weatherMock.Setup(w => w.GetCurrentWeatherAsync(It.IsAny<double>(), It.IsAny<double>()))
                   .ReturnsAsync((WeatherSnapshot?)null);

        _sut = new DailyReportService(_context, weatherMock.Object, NullLogger<DailyReportService>.Instance);
    }

    // ── GetOrCreateAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task GetOrCreateAsync_CreatesReport_WhenNoneExists()
    {
        var date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));

        var report = await _sut.GetOrCreateAsync(CompanyA, LocationId, date);

        Assert.NotNull(report);
        Assert.Equal(CompanyA, report.CompanyId);
        Assert.Equal(LocationId, report.LocationId);
        Assert.Equal(date, report.ReportDate);
        Assert.Equal("Draft", report.Status);
    }

    [Fact]
    public async Task GetOrCreateAsync_ReturnsExistingReport_WhenAlreadyExists()
    {
        var date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2));

        var first = await _sut.GetOrCreateAsync(CompanyA, LocationId, date);
        var second = await _sut.GetOrCreateAsync(CompanyA, LocationId, date);

        Assert.Equal(first.ReportId, second.ReportId);

        var count = await _context.LocationDailyReports
            .CountAsync(r => r.CompanyId == CompanyA && r.LocationId == LocationId && r.ReportDate == date);
        Assert.Equal(1, count);
    }

    // ── UpdateAsync ───────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_UpdatesStatusAndNotes()
    {
        var date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-3));
        var report = await _sut.GetOrCreateAsync(CompanyA, LocationId, date);

        var updated = await _sut.UpdateAsync(report.ReportId, CompanyA, "Shift notes here", "Submitted", 10);

        Assert.NotNull(updated);
        Assert.Equal("Submitted", updated!.Status);
        Assert.Equal("Shift notes here", updated.Notes);
        Assert.Equal(10, updated.SubmittedByPersonId);
    }

    [Fact]
    public async Task UpdateAsync_ReturnsNull_ForWrongCompany()
    {
        var date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-4));
        var report = await _sut.GetOrCreateAsync(CompanyA, LocationId, date);

        var result = await _sut.UpdateAsync(report.ReportId, CompanyB, "notes", "Submitted", 10);

        Assert.Null(result);
    }

    // ── AddMediaAsync / RemoveMediaAsync ──────────────────────────────────────

    [Fact]
    public async Task AddMediaAsync_AttachesMediaToReport()
    {
        var date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-5));
        var report = await _sut.GetOrCreateAsync(CompanyA, LocationId, date);

        var media = await _sut.AddMediaAsync(report.ReportId, CompanyA, 3, "Photo", "reports/test/photo.jpg", null);

        Assert.NotEqual(Guid.Empty, media.MediaId);
        Assert.Equal(report.ReportId, media.ReportId);
        Assert.Equal("Photo", media.MediaType);
    }

    public void Dispose() => _context.Dispose();
}
