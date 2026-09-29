using Microsoft.EntityFrameworkCore;
using Moq;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Kiosk;

public class KioskServiceSettingsTests : IDisposable
{
    private const string CompanyId = "cfg-co";
    private readonly ShiftWorkContext _context;
    private readonly KioskService _sut;

    public KioskServiceSettingsTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ShiftWorkContext(options);
        _sut = new KioskService(_context, new Mock<IShiftEventService>().Object);
    }

    public void Dispose() => _context.Dispose();

    private void SeedLocation(int id, string companyId, bool requirePin, bool requirePhoto)
    {
        _context.Locations.Add(new Location
        {
            LocationId = id, CompanyId = companyId, Name = "Site", Address = "1 Main",
            City = "", State = "", Country = "US", ZipCode = "00000", GeoCoordinates = "{}",
            RatioMax = 100, Status = "Active", TimeZone = "UTC",
            RequirePin = requirePin, RequirePhoto = requirePhoto,
        });
        _context.SaveChanges();
    }

    [Fact]
    public async Task GetKioskConfig_ReturnsTheLocationFlags()
    {
        SeedLocation(1, CompanyId, requirePin: false, requirePhoto: true);

        var config = await _sut.GetKioskConfigAsync(CompanyId, 1);

        Assert.NotNull(config);
        Assert.False(config!.RequirePin);
        Assert.True(config.RequirePhoto);
        Assert.True(config.QuestionsOnClockOutOnly);
    }

    [Fact]
    public async Task GetKioskConfig_ReturnsNull_ForUnknownLocation()
    {
        Assert.Null(await _sut.GetKioskConfigAsync(CompanyId, 999));
    }

    [Fact]
    public async Task GetKioskConfig_ReturnsNull_ForAnotherCompanysLocation()
    {
        SeedLocation(2, "other-co", requirePin: false, requirePhoto: false);
        Assert.Null(await _sut.GetKioskConfigAsync(CompanyId, 2));
    }

    [Fact]
    public async Task GetKioskEmployees_IncludesPhotoExempt()
    {
        _context.Persons.Add(new Person { PersonId = 1, CompanyId = CompanyId, Name = "Ana", Email = "a@x.com", Status = "Active", PhotoExempt = true });
        _context.Persons.Add(new Person { PersonId = 2, CompanyId = CompanyId, Name = "Ben", Email = "b@x.com", Status = "Active" });
        await _context.SaveChangesAsync();

        var employees = await _sut.GetKioskEmployeesAsync(CompanyId);

        Assert.True(employees.Single(e => e.PersonId == 1).PhotoExempt);
        Assert.False(employees.Single(e => e.PersonId == 2).PhotoExempt);
    }
}
