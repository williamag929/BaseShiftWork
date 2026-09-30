using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Kiosk;

public class KioskSettingsPersistenceTests : IDisposable
{
    private const string CompanyId = "settings-co";
    private readonly ShiftWorkContext _context;

    public KioskSettingsPersistenceTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ShiftWorkContext(options);
        _context.Companies.Add(new Company
        {
            CompanyId = CompanyId, Name = CompanyId, Email = "x@example.com",
            PhoneNumber = string.Empty, Address = string.Empty, TimeZone = "UTC",
        });
        _context.SaveChanges();
    }

    public void Dispose() => _context.Dispose();

    private static Location NewLocation(int id = 1) => new()
    {
        LocationId = id, CompanyId = CompanyId, Name = "Site", Address = "1 Main",
        City = "", State = "", Country = "US", ZipCode = "00000",
        GeoCoordinates = "{}", RatioMax = 100, Status = "Active", TimeZone = "UTC",
    };

    [Fact]
    public void NewLocation_DefaultsToStrict()
    {
        var location = NewLocation();
        Assert.True(location.RequirePin);
        Assert.True(location.RequirePhoto);
    }

    [Fact]
    public void NewPerson_IsNotPhotoExempt()
    {
        Assert.False(new Person().PhotoExempt);
    }

    [Fact]
    public async Task LocationService_Update_PersistsBothFlags()
    {
        _context.Locations.Add(NewLocation());
        await _context.SaveChangesAsync();
        var service = new LocationService(_context, NullLogger<LocationService>.Instance);

        var edited = NewLocation();
        edited.RequirePin = false;
        edited.RequirePhoto = false;
        await service.Update(edited);

        var saved = await _context.Locations.AsNoTracking().SingleAsync(l => l.LocationId == 1);
        Assert.False(saved.RequirePin);
        Assert.False(saved.RequirePhoto);
    }

    [Fact]
    public async Task PeopleService_Update_PersistsPhotoExempt()
    {
        _context.Persons.Add(new Person
        {
            PersonId = 5, CompanyId = CompanyId, Name = "Ana", Email = "ana@example.com", Status = "Active",
        });
        await _context.SaveChangesAsync();
        var service = new PeopleService(_context, NullLogger<PeopleService>.Instance);

        await service.Update(new Person
        {
            PersonId = 5, CompanyId = CompanyId, Name = "Ana", Email = "ana@example.com",
            Status = "Active", PhotoExempt = true,
        });

        var saved = await _context.Persons.AsNoTracking().SingleAsync(p => p.PersonId == 5);
        Assert.True(saved.PhotoExempt);
    }
}
