using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Kiosk;

/// <summary>
/// Covers the fix for a real pre-existing gap: kiosk clock-ins never updated
/// <c>Person.StatusShiftWork</c> (it went straight to <c>ShiftWorkContext</c> without running
/// <see cref="ShiftEventService.ApplyStatusAndGeofenceAsync"/>), which would have made kiosk-clocked
/// employees invisible on the Active Sites dashboard. Uses the real <see cref="PeopleService"/> and
/// <see cref="ShiftEventService"/> (not mocks) against an in-memory context so the fix is verified
/// end-to-end rather than just asserting a mock was called.
/// </summary>
public class KioskServiceGeofenceTests : IDisposable
{
    private readonly ShiftWorkContext _context;
    private readonly KioskService _kioskService;

    private const string SiteCoordinates = "40.758000,-73.985500";
    private const string NearCoordinates = "40.758010,-73.985510";
    private const string FarCoordinates = "40.770000,-73.990000";

    public KioskServiceGeofenceTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ShiftWorkContext(options);

        var peopleService = new PeopleService(_context, NullLogger<PeopleService>.Instance);
        var shiftEventService = new ShiftEventService(
            _context,
            new Mock<AutoMapper.IMapper>().Object,
            peopleService,
            new Mock<ICompanySettingsService>().Object);

        _kioskService = new KioskService(_context, shiftEventService);
    }

    private async Task SeedCompanyLocationAndPerson(string companyId, int personId, int locationId, string geoCoordinates)
    {
        _context.Companies.Add(new Company
        {
            CompanyId = companyId,
            Name = companyId,
            Email = "x@example.com",
            PhoneNumber = string.Empty,
            Address = string.Empty,
            TimeZone = "UTC",
        });

        _context.Locations.Add(new Location
        {
            LocationId = locationId,
            CompanyId = companyId,
            Name = "Kiosk Site",
            Address = string.Empty,
            City = string.Empty,
            State = string.Empty,
            Country = "US",
            ZipCode = "00000",
            GeoCoordinates = geoCoordinates,
            RatioMax = 150,
            Status = "Active",
            TimeZone = "UTC",
        });

        _context.Persons.Add(new Person
        {
            PersonId = personId,
            CompanyId = companyId,
            Name = "Kiosk Employee",
            Email = $"person{personId}@example.com",
            Status = "Active",
        });

        await _context.SaveChangesAsync();
    }

    [Fact]
    public async Task ClockFromKiosk_ClockIn_UpdatesPersonStatusShiftWork()
    {
        const string companyId = "kiosk-status";
        const int personId = 1;
        const int locationId = 1;
        await SeedCompanyLocationAndPerson(companyId, personId, locationId, SiteCoordinates);

        await _kioskService.ClockFromKioskAsync(companyId, new KioskClockRequest
        {
            PersonId = personId,
            EventType = "clockin",
            LocationId = locationId,
            GeoLocation = NearCoordinates,
        });

        var person = await _context.Persons.FindAsync(personId);
        Assert.NotNull(person);
        Assert.StartsWith("OnShift", person!.StatusShiftWork);
    }

    [Fact]
    public async Task ClockFromKiosk_PersistsLocationIdAndGeofenceStatus()
    {
        const string companyId = "kiosk-geofence";
        const int personId = 2;
        const int locationId = 2;
        await SeedCompanyLocationAndPerson(companyId, personId, locationId, SiteCoordinates);

        var response = await _kioskService.ClockFromKioskAsync(companyId, new KioskClockRequest
        {
            PersonId = personId,
            EventType = "clockin",
            LocationId = locationId,
            GeoLocation = FarCoordinates,
        });

        var shiftEvent = await _context.ShiftEvents.FindAsync(response.EventLogId);
        Assert.NotNull(shiftEvent);
        Assert.Equal(locationId, shiftEvent!.LocationId);
        Assert.Equal("Outside", shiftEvent.GeofenceStatus);
    }

    public void Dispose() => _context.Dispose();
}
