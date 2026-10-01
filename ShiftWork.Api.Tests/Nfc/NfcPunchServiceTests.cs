using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Nfc;

public class NfcPunchServiceTests : IDisposable
{
    private const string CompanyId = "nfc-co";
    private const string TagKey = "north-tower-key-0000001";
    private const string OtherCompanyTagKey = "other-company-key-00001";
    private const string SiteCoordinates = "40.758000,-73.985500";
    private const string NearCoordinates = "40.758010,-73.985510";
    private const string FarCoordinates = "40.770000,-73.990000";

    private readonly ShiftWorkContext _context;
    private readonly Mock<IPeopleService> _people = new();
    private readonly Dictionary<int, string> _status = new();

    public NfcPunchServiceTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ShiftWorkContext(options);

        _context.Persons.Add(new Person { PersonId = 1, CompanyId = CompanyId, Name = "Ana", Email = "a@x.com", Status = "Active" });
        _context.Persons.Add(new Person { PersonId = 2, CompanyId = CompanyId, Name = "Ben", Email = "b@x.com", Status = "Active" });
        _context.Persons.Add(new Person { PersonId = 3, CompanyId = "other-co", Name = "Cy", Email = "c@x.com", Status = "Active" });
        AddLocation(10, CompanyId, TagKey);
        AddLocation(20, "other-co", OtherCompanyTagKey);
        _context.SaveChanges();

        _people.Setup(p => p.GetPersonStatusShiftWork(It.IsAny<int>()))
            .ReturnsAsync((int id) => _status.TryGetValue(id, out var s) ? s : "OffShift");
        _people.Setup(p => p.UpdatePersonStatusShiftWork(It.IsAny<int>(), It.IsAny<string>()))
            .Callback((int id, string s) => _status[id] = s)
            .ReturnsAsync((Person?)null);
    }

    public void Dispose() => _context.Dispose();

    private void AddLocation(int id, string companyId, string tagKey) => _context.Locations.Add(new Location
    {
        LocationId = id, CompanyId = companyId, Name = id == 10 ? "North Tower" : "Elsewhere",
        Address = "", City = "", State = "", Country = "US", ZipCode = "00000",
        GeoCoordinates = SiteCoordinates, RatioMax = 150, Status = "Active", TimeZone = "UTC",
        RequireNfc = true, NfcTagKey = tagKey,
    });

    private NfcPunchService Sut()
    {
        var mapper = new Mock<IMapper>();
        mapper.Setup(m => m.Map<ShiftEvent>(It.IsAny<ShiftEventDto>()))
            .Returns((ShiftEventDto dto) => new ShiftEvent
            {
                EventLogId = dto.EventLogId, EventDate = dto.EventDate, EventType = dto.EventType,
                CompanyId = dto.CompanyId, PersonId = dto.PersonId, EventObject = dto.EventObject,
                Description = dto.Description, KioskDevice = dto.KioskDevice, GeoLocation = dto.GeoLocation,
                PhotoUrl = dto.PhotoUrl, LocationId = dto.LocationId,
            });
        var shiftEvents = new ShiftEventService(_context, mapper.Object, _people.Object, new Mock<ICompanySettingsService>().Object);
        return new NfcPunchService(_context, shiftEvents, _people.Object, new MemoryCache(new MemoryCacheOptions()));
    }

    private static NfcPunchRequest Tap(string tagKey = TagKey, Guid? id = null, string? geo = NearCoordinates, DateTime? at = null) => new()
    {
        TagKey = tagKey, EventLogId = id ?? Guid.NewGuid(), EventDate = at, GeoLocation = geo, Device = "Pixel 8",
    };

    [Fact]
    public async Task FirstTap_ClocksIn_AtTheTaggedSite_EvenThoughTheSiteRequiresNfc()
    {
        var result = await Sut().PunchAsync(CompanyId, 1, Tap());

        Assert.Equal("clockin", result.EventType);
        Assert.Equal(10, result.LocationId);
        Assert.Equal("North Tower", result.LocationName);
        Assert.Equal("Inside", result.GeofenceStatus);
        Assert.False(result.Repeated);
        var stored = await _context.ShiftEvents.SingleAsync();
        Assert.Equal(NfcPunchService.TapDescription, stored.Description);
        Assert.Equal("Pixel 8", stored.KioskDevice);
        Assert.Equal(10, stored.LocationId);
        Assert.NotNull((await _context.Locations.FindAsync(10))!.NfcLastTappedAt);
    }

    [Fact]
    public async Task Tap_WhenOnShift_ClocksOut()
    {
        _status[1] = "OnShift:NoSchedule";
        var result = await Sut().PunchAsync(CompanyId, 1, Tap());
        Assert.Equal("clockout", result.EventType);
    }

    [Fact]
    public async Task SecondTapWithinAMinute_IsRepeated_AndRecordsNothing()
    {
        var sut = Sut();
        var first = await sut.PunchAsync(CompanyId, 1, Tap());
        var second = await sut.PunchAsync(CompanyId, 1, Tap());

        Assert.True(second.Repeated);
        Assert.Equal(first.EventLogId, second.EventLogId);
        Assert.Equal("clockin", second.EventType);
        Assert.Equal(1, await _context.ShiftEvents.CountAsync());
    }

    [Fact]
    public async Task TapAfterTheRepeatWindow_ClocksOut()
    {
        var sut = Sut();
        await sut.PunchAsync(CompanyId, 1, Tap());
        var stored = await _context.ShiftEvents.SingleAsync();
        stored.CreatedAt = DateTime.UtcNow.AddMinutes(-2);
        await _context.SaveChangesAsync();

        var result = await sut.PunchAsync(CompanyId, 1, Tap());

        Assert.False(result.Repeated);
        Assert.Equal("clockout", result.EventType);
        Assert.Equal(2, await _context.ShiftEvents.CountAsync());
    }

    [Fact]
    public async Task AnotherPersonTappingRightAfter_IsNotTreatedAsARepeat()
    {
        var sut = Sut();
        await sut.PunchAsync(CompanyId, 1, Tap());
        var ben = await sut.PunchAsync(CompanyId, 2, Tap());

        Assert.False(ben.Repeated);
        Assert.Equal(2, await _context.ShiftEvents.CountAsync());
    }

    [Fact]
    public async Task SameEventLogId_ReturnsOriginal_AndStoresOne()
    {
        var id = Guid.NewGuid();
        var sut = Sut();
        var first = await sut.PunchAsync(CompanyId, 1, Tap(id: id));
        var retry = await sut.PunchAsync(CompanyId, 1, Tap(id: id));

        Assert.Equal(first.EventLogId, retry.EventLogId);
        Assert.Equal(first.EventType, retry.EventType);
        Assert.Equal("North Tower", retry.LocationName);
        Assert.Equal(1, await _context.ShiftEvents.CountAsync());
    }

    [Fact]
    public async Task EventLogId_UsedByAnotherPerson_Is409()
    {
        var id = Guid.NewGuid();
        var sut = Sut();
        await sut.PunchAsync(CompanyId, 1, Tap(id: id));

        var ex = await Assert.ThrowsAsync<NfcPunchRejectedException>(() => sut.PunchAsync(CompanyId, 2, Tap(id: id)));
        Assert.Equal(409, ex.StatusCode);
        Assert.Equal("EVENT_ID_CONFLICT", ex.Code);
    }

    [Theory]
    [InlineData("unknown-key-00000000000")]
    [InlineData(OtherCompanyTagKey)]
    public async Task UnknownOrOtherCompanyTag_Is404_AndRecordsNothing(string tagKey)
    {
        var ex = await Assert.ThrowsAsync<NfcPunchRejectedException>(() => Sut().PunchAsync(CompanyId, 1, Tap(tagKey)));
        Assert.Equal(404, ex.StatusCode);
        Assert.Equal("TAG_NOT_FOUND", ex.Code);
        Assert.Equal(0, await _context.ShiftEvents.CountAsync());
    }

    [Fact]
    public async Task RegeneratedTag_OldKeyStopsWorking()
    {
        (await _context.Locations.FindAsync(10))!.NfcTagKey = "brand-new-key-000000001";
        await _context.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<NfcPunchRejectedException>(() => Sut().PunchAsync(CompanyId, 1, Tap()));
        Assert.Equal(404, ex.StatusCode);
    }

    [Fact]
    public async Task PersonOfAnotherCompany_Is403()
    {
        var ex = await Assert.ThrowsAsync<NfcPunchRejectedException>(() => Sut().PunchAsync(CompanyId, 3, Tap()));
        Assert.Equal(403, ex.StatusCode);
        Assert.Equal("NOT_AN_EMPLOYEE", ex.Code);
    }

    [Fact]
    public async Task MissingTagKey_Is400()
    {
        var ex = await Assert.ThrowsAsync<NfcPunchRejectedException>(() => Sut().PunchAsync(CompanyId, 1, Tap(" ")));
        Assert.Equal(400, ex.StatusCode);
        Assert.Equal("TAG_MISSING", ex.Code);
    }

    [Fact]
    public async Task EmptyEventLogId_Is400()
    {
        var ex = await Assert.ThrowsAsync<NfcPunchRejectedException>(() => Sut().PunchAsync(CompanyId, 1, Tap(id: Guid.Empty)));
        Assert.Equal("EVENT_ID_MISSING", ex.Code);
    }

    [Fact]
    public async Task EventDateOlderThan7Days_Is400()
    {
        var ex = await Assert.ThrowsAsync<NfcPunchRejectedException>(
            () => Sut().PunchAsync(CompanyId, 1, Tap(at: DateTime.UtcNow.AddDays(-8))));
        Assert.Equal(400, ex.StatusCode);
        Assert.Equal("EVENT_DATE_INVALID", ex.Code);
    }

    [Fact]
    public async Task TapTime_InsideTheWindow_IsStored()
    {
        var tapped = DateTime.UtcNow.AddMinutes(-3);
        var result = await Sut().PunchAsync(CompanyId, 1, Tap(at: tapped));
        Assert.Equal(tapped, result.EventDate);
    }

    [Fact]
    public async Task TapFarFromTheSite_IsRecorded_AsOutside()
    {
        var result = await Sut().PunchAsync(CompanyId, 1, Tap(geo: FarCoordinates));
        Assert.Equal("Outside", result.GeofenceStatus);
        Assert.Equal(1, await _context.ShiftEvents.CountAsync());
    }

    [Fact]
    public async Task TapWithoutGps_IsRecorded_AsUnknown()
    {
        var result = await Sut().PunchAsync(CompanyId, 1, Tap(geo: null));
        Assert.Equal("Unknown", result.GeofenceStatus);
        Assert.Equal(1, await _context.ShiftEvents.CountAsync());
    }
}
