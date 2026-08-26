using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Locations;

public class LocationServiceActiveSiteStatusTests : IDisposable
{
    private readonly ShiftWorkContext _context;
    private readonly LocationService _service;
    private const string CompanyId = "active-sites-co";

    public LocationServiceActiveSiteStatusTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ShiftWorkContext(options);
        _service = new LocationService(_context, NullLogger<LocationService>.Instance);

        _context.Companies.Add(new Company
        {
            CompanyId = CompanyId,
            Name = CompanyId,
            Email = "x@example.com",
            PhoneNumber = string.Empty,
            Address = string.Empty,
            TimeZone = "UTC",
        });

        _context.Locations.Add(new Location
        {
            LocationId = 1,
            CompanyId = CompanyId,
            Name = "Site A",
            Address = "123 Main St",
            City = "", State = "", Country = "US", ZipCode = "00000",
            GeoCoordinates = "40.75,-73.98",
            RatioMax = 150,
            Status = "Active",
            TimeZone = "UTC",
        });
        _context.Locations.Add(new Location
        {
            LocationId = 2,
            CompanyId = CompanyId,
            Name = "Site B (inactive)",
            Address = "456 Side St",
            City = "", State = "", Country = "US", ZipCode = "00000",
            GeoCoordinates = "40.76,-73.97",
            RatioMax = 150,
            Status = "Inactive",
            TimeZone = "UTC",
        });

        _context.Roles.Add(new Role { RoleId = 1, Name = "Guard", Description = "Security guard", CompanyId = CompanyId, Status = "Active" });

        _context.SaveChanges();
    }

#pragma warning disable CS0618 // Person.RoleId still used for job-title display, see LocationService.GetActiveSiteStatusAsync
    private void SeedOnShiftPerson(int personId, int? locationId, string geofenceStatus, string timing = "OnTime", DateTime? reviewedAt = null)
    {
        _context.Persons.Add(new Person
        {
            PersonId = personId,
            CompanyId = CompanyId,
            Name = $"Person {personId}",
            Email = $"person{personId}@example.com",
            Status = "Active",
            StatusShiftWork = $"OnShift:{timing}",
            RoleId = 1,
        });
        _context.ShiftEvents.Add(new ShiftEvent
        {
            EventLogId = Guid.NewGuid(),
            CompanyId = CompanyId,
            PersonId = personId,
            EventType = "clockin",
            EventDate = DateTime.UtcNow,
            LocationId = locationId,
            GeofenceStatus = geofenceStatus,
            GeofenceReviewedAt = reviewedAt,
        });
        _context.SaveChanges();
    }
#pragma warning restore CS0618

    [Fact]
    public async Task GetActiveSiteStatus_GroupsOnShiftPeopleByLocation()
    {
        SeedOnShiftPerson(personId: 1, locationId: 1, geofenceStatus: "Inside");
        SeedOnShiftPerson(personId: 2, locationId: 1, geofenceStatus: "Outside");

        // OffShift person should never appear.
        _context.Persons.Add(new Person
        {
            PersonId = 3, CompanyId = CompanyId, Name = "Off Shift", Email = "off@example.com",
            Status = "Active", StatusShiftWork = "OffShift",
        });
        await _context.SaveChangesAsync();

        var result = await _service.GetActiveSiteStatusAsync(CompanyId);

        var siteA = Assert.Single(result, s => s.LocationId == 1);
        Assert.Equal(2, siteA.OnShiftCount);
        Assert.Equal(2, siteA.Roster.Count);
        Assert.Contains(siteA.Roster, r => r.PersonId == 1 && r.GeofenceStatus == "Inside" && r.RoleName == "Guard");
        Assert.Contains(siteA.Roster, r => r.PersonId == 2 && r.GeofenceStatus == "Outside" && !r.GeofenceReviewed);
        Assert.DoesNotContain(result.SelectMany(s => s.Roster), r => r.PersonId == 3);
    }

    [Fact]
    public async Task GetActiveSiteStatus_ExcludesInactiveLocationsFromTheSiteList()
    {
        var result = await _service.GetActiveSiteStatusAsync(CompanyId);

        Assert.Contains(result, s => s.LocationId == 1);
        Assert.DoesNotContain(result, s => s.LocationId == 2);
    }

    [Fact]
    public async Task GetActiveSiteStatus_GroupsEventsWithNoLocationIdAsUnassigned()
    {
        SeedOnShiftPerson(personId: 4, locationId: null, geofenceStatus: "Unknown");

        var result = await _service.GetActiveSiteStatusAsync(CompanyId);

        var unassigned = Assert.Single(result, s => s.Name == "Unassigned");
        Assert.Contains(unassigned.Roster, r => r.PersonId == 4);
    }

    public void Dispose() => _context.Dispose();
}
