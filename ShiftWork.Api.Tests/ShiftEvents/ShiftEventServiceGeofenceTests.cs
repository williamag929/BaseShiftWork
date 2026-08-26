using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Moq;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.ShiftEvents;

public class ShiftEventServiceGeofenceTests : IDisposable
{
    private readonly ShiftWorkContext _context;
    private readonly Mock<IMapper> _mapperMock = new();
    private readonly Mock<IPeopleService> _peopleServiceMock = new();
    private readonly Mock<ICompanySettingsService> _settingsServiceMock = new();

    // Times Square-ish coordinates; "near" is a few meters away, "far" is well outside any
    // reasonable jobsite radius.
    private const string SiteCoordinates = "40.758000,-73.985500";
    private const string NearCoordinates = "40.758010,-73.985510"; // ~1-2m away
    private const string FarCoordinates = "40.770000,-73.990000"; // >1km away

    public ShiftEventServiceGeofenceTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _context = new ShiftWorkContext(options);

        _mapperMock
            .Setup(m => m.Map<ShiftEvent>(It.IsAny<ShiftEventDto>()))
            .Returns((ShiftEventDto dto) => new ShiftEvent
            {
                EventLogId = dto.EventLogId == Guid.Empty ? Guid.NewGuid() : dto.EventLogId,
                EventDate = dto.EventDate,
                EventType = dto.EventType,
                CompanyId = dto.CompanyId,
                PersonId = dto.PersonId,
                EventObject = dto.EventObject,
                Description = dto.Description,
                KioskDevice = dto.KioskDevice,
                GeoLocation = dto.GeoLocation,
                PhotoUrl = dto.PhotoUrl,
                LocationId = dto.LocationId,
            });

        _peopleServiceMock
            .Setup(p => p.GetPersonStatusShiftWork(It.IsAny<int>()))
            .ReturnsAsync("OffShift");

        _peopleServiceMock
            .Setup(p => p.UpdatePersonStatusShiftWork(It.IsAny<int>(), It.IsAny<string>()))
            .ReturnsAsync((Person?)null);
    }

    private ShiftEventService CreateService() =>
        new(_context, _mapperMock.Object, _peopleServiceMock.Object, _settingsServiceMock.Object);

    private async Task SeedCompanyLocationAndShift(
        string companyId, int personId, int locationId, string geoCoordinates, int radiusMeters,
        string scheduleStartIso = "2026-01-15T09:00:00Z", string scheduleEndIso = "2026-01-15T17:00:00Z")
    {
        _context.Companies.Add(new Company
        {
            CompanyId = companyId,
            Name = $"Company {companyId}",
            Email = $"{companyId}@example.com",
            PhoneNumber = string.Empty,
            Address = string.Empty,
            TimeZone = "UTC",
        });

        _context.Locations.Add(new Location
        {
            LocationId = locationId,
            CompanyId = companyId,
            Name = "Main Site",
            Address = string.Empty,
            City = string.Empty,
            State = string.Empty,
            Country = "US",
            ZipCode = "00000",
            GeoCoordinates = geoCoordinates,
            RatioMax = radiusMeters,
            Status = "Active",
            TimeZone = "UTC",
        });

        _context.ScheduleShifts.Add(new ScheduleShift
        {
            ScheduleShiftId = personId,
            ScheduleId = 1,
            CompanyId = companyId,
            PersonId = personId,
            LocationId = locationId,
            AreaId = 1,
            StartDate = DateTime.Parse(scheduleStartIso, null, System.Globalization.DateTimeStyles.AdjustToUniversal),
            EndDate = DateTime.Parse(scheduleEndIso, null, System.Globalization.DateTimeStyles.AdjustToUniversal),
            Status = "open",
        });

        await _context.SaveChangesAsync();
    }

    [Fact]
    public async Task CreateShiftEvent_ClockIn_WithinRadius_MarksInside()
    {
        const string companyId = "geo-inside";
        const int personId = 1;
        const int locationId = 1;
        await SeedCompanyLocationAndShift(companyId, personId, locationId, SiteCoordinates, radiusMeters: 150);

        var service = CreateService();
        var dto = new ShiftEventDto
        {
            EventLogId = Guid.NewGuid(),
            CompanyId = companyId,
            PersonId = personId,
            EventType = "clockin",
            EventDate = DateTime.Parse("2026-01-15T09:00:00Z", null, System.Globalization.DateTimeStyles.AdjustToUniversal),
            GeoLocation = NearCoordinates,
        };

        var created = await service.CreateShiftEventAsync(dto);

        Assert.Equal("Inside", created.GeofenceStatus);
        Assert.Equal(locationId, created.LocationId);
        Assert.NotNull(created.GeofenceDistanceMeters);
        Assert.True(created.GeofenceDistanceMeters < 150);
    }

    [Fact]
    public async Task CreateShiftEvent_ClockIn_OutsideRadius_MarksOutsideWithDistance()
    {
        const string companyId = "geo-outside";
        const int personId = 2;
        const int locationId = 2;
        await SeedCompanyLocationAndShift(companyId, personId, locationId, SiteCoordinates, radiusMeters: 150);

        var service = CreateService();
        var dto = new ShiftEventDto
        {
            EventLogId = Guid.NewGuid(),
            CompanyId = companyId,
            PersonId = personId,
            EventType = "clockin",
            EventDate = DateTime.Parse("2026-01-15T09:00:00Z", null, System.Globalization.DateTimeStyles.AdjustToUniversal),
            GeoLocation = FarCoordinates,
        };

        var created = await service.CreateShiftEventAsync(dto);

        Assert.Equal("Outside", created.GeofenceStatus);
        Assert.Equal(locationId, created.LocationId);
        Assert.True(created.GeofenceDistanceMeters > 150);
    }

    [Fact]
    public async Task CreateShiftEvent_ClockIn_MissingDeviceGps_MarksUnknown()
    {
        const string companyId = "geo-no-gps";
        const int personId = 3;
        const int locationId = 3;
        await SeedCompanyLocationAndShift(companyId, personId, locationId, SiteCoordinates, radiusMeters: 150);

        var service = CreateService();
        var dto = new ShiftEventDto
        {
            EventLogId = Guid.NewGuid(),
            CompanyId = companyId,
            PersonId = personId,
            EventType = "clockin",
            EventDate = DateTime.Parse("2026-01-15T09:00:00Z", null, System.Globalization.DateTimeStyles.AdjustToUniversal),
            GeoLocation = null,
        };

        var created = await service.CreateShiftEventAsync(dto);

        Assert.Equal("Unknown", created.GeofenceStatus);
        Assert.Null(created.GeofenceDistanceMeters);
    }

    [Fact]
    public async Task CreateShiftEvent_ClockIn_NoResolvableLocation_MarksUnknownAndLeavesLocationNull()
    {
        // No schedule seeded at all → NoSchedule status, no location to check against.
        const string companyId = "geo-no-schedule";
        _context.Companies.Add(new Company
        {
            CompanyId = companyId,
            Name = companyId,
            Email = "x@example.com",
            PhoneNumber = string.Empty,
            Address = string.Empty,
            TimeZone = "UTC",
        });
        await _context.SaveChangesAsync();

        var service = CreateService();
        var dto = new ShiftEventDto
        {
            EventLogId = Guid.NewGuid(),
            CompanyId = companyId,
            PersonId = 999,
            EventType = "clockin",
            EventDate = DateTime.Parse("2026-01-15T09:00:00Z", null, System.Globalization.DateTimeStyles.AdjustToUniversal),
            GeoLocation = NearCoordinates,
        };

        var created = await service.CreateShiftEventAsync(dto);

        Assert.Equal("Unknown", created.GeofenceStatus);
        Assert.Null(created.LocationId);
        _peopleServiceMock.Verify(p => p.UpdatePersonStatusShiftWork(999, "OnShift:NoSchedule"), Times.Once);
    }

    [Fact]
    public async Task CreateShiftEvent_ExplicitLocationId_OverridesScheduleLocationForGeofence()
    {
        // Kiosk-style call: explicit LocationId pointing at a different site than the schedule's.
        const string companyId = "geo-explicit";
        const int personId = 4;
        const int scheduledLocationId = 4;
        const int kioskLocationId = 40;

        await SeedCompanyLocationAndShift(companyId, personId, scheduledLocationId, FarCoordinates, radiusMeters: 150);

        _context.Locations.Add(new Location
        {
            LocationId = kioskLocationId,
            CompanyId = companyId,
            Name = "Kiosk Site",
            Address = string.Empty,
            City = string.Empty,
            State = string.Empty,
            Country = "US",
            ZipCode = "00000",
            GeoCoordinates = SiteCoordinates,
            RatioMax = 150,
            Status = "Active",
            TimeZone = "UTC",
        });
        await _context.SaveChangesAsync();

        var service = CreateService();
        var dto = new ShiftEventDto
        {
            EventLogId = Guid.NewGuid(),
            CompanyId = companyId,
            PersonId = personId,
            EventType = "clockin",
            EventDate = DateTime.Parse("2026-01-15T09:00:00Z", null, System.Globalization.DateTimeStyles.AdjustToUniversal),
            GeoLocation = NearCoordinates,
            LocationId = kioskLocationId,
        };

        var created = await service.CreateShiftEventAsync(dto);

        Assert.Equal(kioskLocationId, created.LocationId);
        Assert.Equal("Inside", created.GeofenceStatus);
    }

    [Fact]
    public async Task ReviewGeofenceFlag_SetsReviewedFields()
    {
        const string companyId = "geo-review";
        const int personId = 5;
        const int locationId = 5;
        await SeedCompanyLocationAndShift(companyId, personId, locationId, SiteCoordinates, radiusMeters: 150);

        var service = CreateService();
        var dto = new ShiftEventDto
        {
            EventLogId = Guid.NewGuid(),
            CompanyId = companyId,
            PersonId = personId,
            EventType = "clockin",
            EventDate = DateTime.Parse("2026-01-15T09:00:00Z", null, System.Globalization.DateTimeStyles.AdjustToUniversal),
            GeoLocation = FarCoordinates,
        };
        var created = await service.CreateShiftEventAsync(dto);
        Assert.Equal("Outside", created.GeofenceStatus);

        var reviewed = await service.ReviewGeofenceFlagAsync(companyId, created.EventLogId, reviewerPersonId: 777);

        Assert.NotNull(reviewed);
        Assert.NotNull(reviewed!.GeofenceReviewedAt);
        Assert.Equal(777, reviewed.GeofenceReviewedByPersonId);
        // Reviewing doesn't change the underlying status — still flagged as Outside.
        Assert.Equal("Outside", reviewed.GeofenceStatus);
    }

    public void Dispose() => _context.Dispose();
}
