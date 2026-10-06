using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Moq;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.ShiftEvents;

public class ShiftEventServiceNfcRequiredTests : IDisposable
{
    private const string CompanyId = "nfc-rule-co";
    private const int PersonId = 7;
    private const int NfcSiteId = 1;
    private const int NormalSiteId = 2;
    private static readonly DateTime ShiftDay = new(2026, 1, 15, 12, 0, 0, DateTimeKind.Utc);
    private readonly ShiftWorkContext _context;

    public ShiftEventServiceNfcRequiredTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ShiftWorkContext(options);
        AddLocation(NfcSiteId, requireNfc: true);
        AddLocation(NormalSiteId, requireNfc: false);
        _context.SaveChanges();
    }

    public void Dispose() => _context.Dispose();

    private void AddLocation(int id, bool requireNfc) => _context.Locations.Add(new Location
    {
        LocationId = id, CompanyId = CompanyId, Name = id == NfcSiteId ? "North Tower" : "Depot",
        Address = "", City = "", State = "", Country = "US", ZipCode = "00000",
        GeoCoordinates = "40.758000,-73.985500", RatioMax = 150, Status = "Active", TimeZone = "UTC",
        RequireNfc = requireNfc,
    });

    private void AddTodaysShift(int locationId) => _context.ScheduleShifts.Add(new ScheduleShift
    {
        ScheduleShiftId = 1, ScheduleId = 1, CompanyId = CompanyId, PersonId = PersonId,
        LocationId = locationId, AreaId = 1,
        StartDate = ShiftDay.Date.AddHours(9), EndDate = ShiftDay.Date.AddHours(17), Status = "open",
    });

    private ShiftEventService Sut() => new(
        _context, new Mock<IMapper>().Object, new Mock<IPeopleService>().Object, new Mock<ICompanySettingsService>().Object);

    private static ShiftEventDto Punch(string eventType = "clockin", int? locationId = null) => new()
    {
        EventLogId = Guid.NewGuid(), CompanyId = CompanyId, PersonId = PersonId,
        EventType = eventType, EventDate = ShiftDay, LocationId = locationId,
    };

    [Fact]
    public async Task ExplicitNfcSite_Throws_WithTheSiteName()
    {
        var ex = await Assert.ThrowsAsync<NfcRequiredException>(() => Sut().EnsureNfcNotRequiredAsync(Punch(locationId: NfcSiteId)));
        Assert.Equal("NFC_REQUIRED", NfcRequiredException.Code);
        Assert.Contains("North Tower", ex.Message);
    }

    [Fact]
    public async Task ExplicitSiteOfAnotherCompany_IsIgnored()
    {
        const int otherCompanySiteId = 3;
        _context.Locations.Add(new Location
        {
            LocationId = otherCompanySiteId, CompanyId = "other-co", Name = "Other Tenant Site",
            Address = "", City = "", State = "", Country = "US", ZipCode = "00000",
            GeoCoordinates = "40.758000,-73.985500", RatioMax = 150, Status = "Active", TimeZone = "UTC",
            RequireNfc = true,
        });
        await _context.SaveChangesAsync();

        await Sut().EnsureNfcNotRequiredAsync(Punch(locationId: otherCompanySiteId));
    }

    [Fact]
    public async Task ClockOut_AtAnNfcSite_AlsoThrows()
    {
        await Assert.ThrowsAsync<NfcRequiredException>(() => Sut().EnsureNfcNotRequiredAsync(Punch("clockout", NfcSiteId)));
    }

    [Fact]
    public async Task ExplicitNormalSite_IsAllowed()
    {
        await Sut().EnsureNfcNotRequiredAsync(Punch(locationId: NormalSiteId));
    }

    [Fact]
    public async Task NoLocationId_UsesTodaysScheduledSite()
    {
        AddTodaysShift(NfcSiteId);
        await _context.SaveChangesAsync();

        await Assert.ThrowsAsync<NfcRequiredException>(() => Sut().EnsureNfcNotRequiredAsync(Punch()));
    }

    [Fact]
    public async Task NoLocationAndNoSchedule_IsAllowed()
    {
        await Sut().EnsureNfcNotRequiredAsync(Punch());
    }

    [Fact]
    public async Task NonClockEvents_AreNotChecked()
    {
        await Sut().EnsureNfcNotRequiredAsync(Punch("break_start", NfcSiteId));
    }
}
