using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Kiosk;

public class KioskServiceClockTests : IDisposable
{
    private const string CompanyId = "clock-co";
    private const string RightPin = "1234";
    private readonly ShiftWorkContext _context;

    public KioskServiceClockTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ShiftWorkContext(options);

        _context.Persons.Add(new Person
        {
            PersonId = 1, CompanyId = CompanyId, Name = "Ana", Email = "a@x.com", Status = "Active",
            Pin = BCrypt.Net.BCrypt.HashPassword(RightPin),
        });
        _context.Persons.Add(new Person
        {
            PersonId = 2, CompanyId = CompanyId, Name = "Ben", Email = "b@x.com", Status = "Active",
        });
        AddLocation(10, CompanyId, requirePin: true);
        AddLocation(11, CompanyId, requirePin: false);
        AddLocation(12, "other-co", requirePin: false);
        _context.SaveChanges();
    }

    public void Dispose() => _context.Dispose();

    private void AddLocation(int id, string companyId, bool requirePin) =>
        _context.Locations.Add(new Location
        {
            LocationId = id, CompanyId = companyId, Name = "Site", Address = "1 Main",
            City = "", State = "", Country = "US", ZipCode = "00000", GeoCoordinates = "{}",
            RatioMax = 100, Status = "Active", TimeZone = "UTC", RequirePin = requirePin,
        });

    private KioskService Sut(bool enforcePin)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["KioskSettings:EnforcePinOnClock"] = enforcePin ? "true" : "false",
            })
            .Build();
        return new KioskService(_context, new Mock<IShiftEventService>().Object, config);
    }

    private static KioskClockRequest Request(int personId = 1, int locationId = 11, Guid? id = null) => new()
    {
        PersonId = personId, EventType = "ClockIn", LocationId = locationId, EventLogId = id, KioskDevice = "k1",
    };

    // ── idempotency ──────────────────────────────────────────────────────────

    [Fact]
    public async Task RepeatedEventLogId_ReturnsTheOriginalEvent_AndStoresOnlyOne()
    {
        var id = Guid.NewGuid();
        var sut = Sut(enforcePin: false);

        var first = await sut.ClockFromKioskAsync(CompanyId, Request(id: id));
        var second = await sut.ClockFromKioskAsync(CompanyId, Request(id: id));

        Assert.Equal(id, first.EventLogId);
        Assert.Equal(id, second.EventLogId);
        Assert.Equal(first.EventDate, second.EventDate);
        Assert.Equal(1, await _context.ShiftEvents.CountAsync(e => e.EventLogId == id));
    }

    [Fact]
    public async Task EventLogId_ReusedForADifferentPerson_IsRejectedWith409()
    {
        var id = Guid.NewGuid();
        var sut = Sut(enforcePin: false);
        await sut.ClockFromKioskAsync(CompanyId, Request(personId: 1, id: id));

        var ex = await Assert.ThrowsAsync<KioskPunchRejectedException>(
            () => sut.ClockFromKioskAsync(CompanyId, Request(personId: 2, id: id)));

        Assert.Equal(409, ex.StatusCode);
    }

    [Fact]
    public async Task WithoutAnEventLogId_TheServerGeneratesOne()
    {
        var result = await Sut(false).ClockFromKioskAsync(CompanyId, Request());
        Assert.NotEqual(Guid.Empty, result.EventLogId);
    }

    // ── event date window ────────────────────────────────────────────────────

    [Fact]
    public async Task ClientEventDate_IsStored_WhenInsideTheWindow()
    {
        var tapped = DateTime.UtcNow.AddHours(-3);
        var request = Request();
        request.EventDate = tapped;

        var result = await Sut(false).ClockFromKioskAsync(CompanyId, request);

        Assert.Equal(tapped, result.EventDate);
    }

    [Fact]
    public async Task EventDate_MoreThan7DaysOld_IsRejected()
    {
        var request = Request();
        request.EventDate = DateTime.UtcNow.AddDays(-8);
        await Assert.ThrowsAsync<ArgumentException>(() => Sut(false).ClockFromKioskAsync(CompanyId, request));
    }

    [Fact]
    public async Task EventDate_InTheFuture_IsRejected()
    {
        var request = Request();
        request.EventDate = DateTime.UtcNow.AddMinutes(10);
        await Assert.ThrowsAsync<ArgumentException>(() => Sut(false).ClockFromKioskAsync(CompanyId, request));
    }

    [Fact]
    public async Task EventDate_2MinutesAhead_IsAccepted_AsClockSkew()
    {
        var request = Request();
        request.EventDate = DateTime.UtcNow.AddMinutes(2);
        var result = await Sut(false).ClockFromKioskAsync(CompanyId, request);
        Assert.NotEqual(Guid.Empty, result.EventLogId);
    }

    // ── PIN enforcement ──────────────────────────────────────────────────────

    [Fact]
    public async Task PinSite_WithEnforcement_RejectsAMissingPin()
    {
        var ex = await Assert.ThrowsAsync<KioskPunchRejectedException>(
            () => Sut(true).ClockFromKioskAsync(CompanyId, Request(locationId: 10)));
        Assert.Equal(403, ex.StatusCode);
    }

    [Fact]
    public async Task PinSite_WithEnforcement_RejectsAWrongPin()
    {
        var request = Request(locationId: 10);
        request.Pin = "0000";
        var ex = await Assert.ThrowsAsync<KioskPunchRejectedException>(
            () => Sut(true).ClockFromKioskAsync(CompanyId, request));
        Assert.Equal(403, ex.StatusCode);
    }

    [Fact]
    public async Task PinSite_WithEnforcement_AcceptsTheRightPin()
    {
        var request = Request(locationId: 10);
        request.Pin = RightPin;
        var result = await Sut(true).ClockFromKioskAsync(CompanyId, request);
        Assert.Equal("Ana", result.PersonName);
    }

    [Fact]
    public async Task PinSite_WithEnforcement_RejectsAPersonWhoHasNoPinSet()
    {
        var request = Request(personId: 2, locationId: 10);
        request.Pin = RightPin;
        await Assert.ThrowsAsync<KioskPunchRejectedException>(() => Sut(true).ClockFromKioskAsync(CompanyId, request));
    }

    [Fact]
    public async Task NoPinSite_WithEnforcement_AcceptsAPunchWithoutAPin()
    {
        var result = await Sut(true).ClockFromKioskAsync(CompanyId, Request(locationId: 11));
        Assert.Equal("Ana", result.PersonName);
    }

    [Fact]
    public async Task PinSite_WithoutEnforcement_AcceptsAPunchWithoutAPin_ForOldTablets()
    {
        var result = await Sut(false).ClockFromKioskAsync(CompanyId, Request(locationId: 10));
        Assert.Equal("Ana", result.PersonName);
    }

    [Fact]
    public async Task WithEnforcement_AMissingLocationId_IsTreatedAsPinRequired()
    {
        var request = Request();
        request.LocationId = null;
        var ex = await Assert.ThrowsAsync<KioskPunchRejectedException>(
            () => Sut(true).ClockFromKioskAsync(CompanyId, request));
        Assert.Equal(403, ex.StatusCode);
    }

    [Fact]
    public async Task WithEnforcement_ALocationFromAnotherCompany_IsRejected()
    {
        await Assert.ThrowsAsync<ArgumentException>(
            () => Sut(true).ClockFromKioskAsync(CompanyId, Request(locationId: 12)));
    }
}
