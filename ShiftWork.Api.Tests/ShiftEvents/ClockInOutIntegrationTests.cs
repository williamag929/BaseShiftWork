using System.Security.Claims;
using AutoMapper;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.ShiftEvents;

/// <summary>
/// End-to-end tests of the clock-in / clock-out path with the real services wired together
/// (ShiftEventService + PeopleService + KioskService + the real AutoMapper profile) over an
/// in-memory database: mobile punches through ShiftEventsController, kiosk punches through
/// KioskService (PIN enforcement on), PIN verification through AuthController, and CompanyId
/// isolation between two tenants that share the same database.
/// </summary>
public class ClockInOutIntegrationTests : IDisposable
{
    private const string CoA = "company-a";
    private const string CoB = "company-b";
    private const string AnaPin = "4321";

    private const int AnaId = 1;      // company A, has a PIN
    private const int BenId = 2;      // company A, no PIN
    private const int CarlaId = 3;    // company B
    private const int PinSiteA = 10;  // company A, RequirePin
    private const int OpenSiteA = 11; // company A, no PIN
    private const int SiteB = 20;     // company B

    private readonly ShiftWorkContext _context;
    private readonly IMapper _mapper;
    private readonly ShiftEventService _shiftEvents;

    public ClockInOutIntegrationTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ShiftWorkContext(options);
        _mapper = new MapperConfiguration(cfg => cfg.AddProfile<MappingProfiles>()).CreateMapper();

        var people = new PeopleService(_context, NullLogger<PeopleService>.Instance, new Mock<IPlanEnforcementService>().Object);
        _shiftEvents = new ShiftEventService(_context, _mapper, people, new Mock<ICompanySettingsService>().Object);

        AddCompany(CoA);
        AddCompany(CoB);
        AddPerson(AnaId, CoA, "Ana", BCrypt.Net.BCrypt.HashPassword(AnaPin));
        AddPerson(BenId, CoA, "Ben", pinHash: null);
        AddPerson(CarlaId, CoB, "Carla", BCrypt.Net.BCrypt.HashPassword(AnaPin));
        AddLocation(PinSiteA, CoA, requirePin: true);
        AddLocation(OpenSiteA, CoA, requirePin: false);
        AddLocation(SiteB, CoB, requirePin: false);
        _context.SaveChanges();
    }

    public void Dispose() => _context.Dispose();

    // ── Seed helpers ─────────────────────────────────────────────────────────

    private void AddCompany(string id) => _context.Companies.Add(new Company
    {
        CompanyId = id, Name = id, Email = $"{id}@example.com",
        PhoneNumber = string.Empty, Address = string.Empty, TimeZone = "UTC",
    });

    private void AddPerson(int id, string companyId, string name, string? pinHash) => _context.Persons.Add(new Person
    {
        PersonId = id, CompanyId = companyId, Name = name, Email = $"{name.ToLowerInvariant()}@example.com",
        Status = "Active", Pin = pinHash,
    });

    private void AddLocation(int id, string companyId, bool requirePin) => _context.Locations.Add(new Location
    {
        LocationId = id, CompanyId = companyId, Name = $"Site {id}", Address = "1 Main",
        City = "", State = "", Country = "US", ZipCode = "00000", GeoCoordinates = "{}",
        RatioMax = 100, Status = "Active", TimeZone = "UTC", RequirePin = requirePin,
    });

    private void AddTodayShift(int personId, string companyId, int locationId, DateTime startUtc) =>
        _context.ScheduleShifts.Add(new ScheduleShift
        {
            ScheduleShiftId = personId * 100 + locationId, ScheduleId = 1, CompanyId = companyId,
            PersonId = personId, LocationId = locationId, AreaId = 1,
            StartDate = startUtc, EndDate = startUtc.AddHours(8), Status = "published",
        });

    private ShiftEventsController MobileController(int? callerPersonId = null)
    {
        var claims = callerPersonId.HasValue ? new[] { new Claim("personId", callerPersonId.Value.ToString()) } : Array.Empty<Claim>();
        return new ShiftEventsController(_shiftEvents, NullLogger<ShiftEventsController>.Instance, _mapper)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")) },
            },
        };
    }

    private KioskService Kiosk(bool enforcePin = true)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["KioskSettings:EnforcePinOnClock"] = enforcePin ? "true" : "false",
            })
            .Build();
        return new KioskService(_context, _shiftEvents, config);
    }

    private AuthController Auth() => new(
        _context, _mapper, NullLogger<AuthController>.Instance, new Mock<ISandboxService>().Object,
        new ConfigurationBuilder().Build(), new Mock<INotificationService>().Object);

    private static ShiftEventDto Punch(string companyId, int personId, string type, DateTime? at = null) => new()
    {
        EventLogId = Guid.NewGuid(), CompanyId = companyId, PersonId = personId, EventType = type,
        EventDate = at ?? DateTime.UtcNow,
    };

    private static KioskClockRequest KioskPunch(int personId, string type, int locationId, string? pin = null, Guid? id = null) => new()
    {
        PersonId = personId, EventType = type, LocationId = locationId, Pin = pin, EventLogId = id, KioskDevice = "ipad-1",
    };

    private async Task<string?> StatusOf(int personId) =>
        (await _context.Persons.AsNoTracking().FirstAsync(p => p.PersonId == personId)).StatusShiftWork;

    private Task<int> EventCount(int personId) =>
        _context.ShiftEvents.CountAsync(e => e.PersonId == personId);

    // ── Mobile clock-in / clock-out ──────────────────────────────────────────

    [Fact]
    public async Task Mobile_ClockInThenClockOut_StoresBothEvents_AndTogglesStatus()
    {
        var shiftStart = DateTime.UtcNow.Date.AddHours(9); // fixed time of day: never crosses midnight
        AddTodayShift(AnaId, CoA, OpenSiteA, shiftStart);
        await _context.SaveChangesAsync();
        var api = MobileController(callerPersonId: AnaId);

        var clockIn = await api.CreateShiftEvent(CoA, Punch(CoA, AnaId, "clockin", shiftStart.AddMinutes(2)));
        Assert.IsType<CreatedAtActionResult>(clockIn.Result);
        Assert.Equal("OnShift:OnTime", await StatusOf(AnaId));

        var clockOut = await api.CreateShiftEvent(CoA, Punch(CoA, AnaId, "clockout", shiftStart.AddHours(8)));
        Assert.IsType<CreatedAtActionResult>(clockOut.Result);
        Assert.Equal("OffShift", await StatusOf(AnaId));

        var events = await _context.ShiftEvents.Where(e => e.PersonId == AnaId).OrderBy(e => e.EventDate).ToListAsync();
        Assert.Equal(new[] { "clockin", "clockout" }, events.Select(e => e.EventType));
        Assert.All(events, e => Assert.Equal(CoA, e.CompanyId));
        Assert.All(events, e => Assert.Equal(OpenSiteA, e.LocationId)); // resolved from the schedule
    }

    [Fact]
    public async Task Mobile_ClockInWithoutASchedule_IsAccepted_AsNoSchedule()
    {
        var result = await MobileController(AnaId).CreateShiftEvent(CoA, Punch(CoA, AnaId, "clockin"));

        Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal("OnShift:NoSchedule", await StatusOf(AnaId));
    }

    [Fact]
    public async Task Mobile_SecondClockIn_Is409_AndNotStored()
    {
        var api = MobileController(AnaId);
        await api.CreateShiftEvent(CoA, Punch(CoA, AnaId, "clockin"));

        var second = await api.CreateShiftEvent(CoA, Punch(CoA, AnaId, "clockin"));

        Assert.IsType<ConflictObjectResult>(second.Result);
        Assert.Equal(1, await EventCount(AnaId));
    }

    [Fact]
    public async Task Mobile_ClockOutWithoutClockIn_Is409_AndNotStored()
    {
        var result = await MobileController(AnaId).CreateShiftEvent(CoA, Punch(CoA, AnaId, "clockout"));

        Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Equal(0, await EventCount(AnaId));
    }

    // ── Kiosk clock-in / clock-out (PIN enforced) ────────────────────────────

    [Fact]
    public async Task Kiosk_PinSite_RightPin_ClocksIn_AndUpdatesStatus()
    {
        var result = await Kiosk().ClockFromKioskAsync(CoA, KioskPunch(AnaId, "clockin", PinSiteA, AnaPin));

        Assert.Equal("Ana", result.PersonName);
        var stored = await _context.ShiftEvents.SingleAsync(e => e.EventLogId == result.EventLogId);
        Assert.Equal(CoA, stored.CompanyId);
        Assert.Equal(PinSiteA, stored.LocationId);
        Assert.Equal("ipad-1", stored.KioskDevice);
        Assert.StartsWith("OnShift", await StatusOf(AnaId));
    }

    [Fact]
    public async Task Kiosk_PinSite_WrongPin_Is403_StoresNothing_AndKeepsStatus()
    {
        var ex = await Assert.ThrowsAsync<KioskPunchRejectedException>(
            () => Kiosk().ClockFromKioskAsync(CoA, KioskPunch(AnaId, "clockin", PinSiteA, "0000")));

        Assert.Equal(403, ex.StatusCode);
        Assert.Equal(0, await EventCount(AnaId));
        Assert.Null(await StatusOf(AnaId));
    }

    [Fact]
    public async Task Kiosk_ClockIn_ThenMobile_ClockOut_ClosesTheShift()
    {
        await Kiosk().ClockFromKioskAsync(CoA, KioskPunch(AnaId, "clockin", PinSiteA, AnaPin));

        var clockOut = await MobileController(AnaId).CreateShiftEvent(CoA, Punch(CoA, AnaId, "clockout"));

        Assert.IsType<CreatedAtActionResult>(clockOut.Result);
        Assert.Equal("OffShift", await StatusOf(AnaId));
        Assert.Equal(2, await EventCount(AnaId));
    }

    [Fact]
    public async Task Kiosk_ClockOut_AfterKioskClockIn_SetsOffShift()
    {
        var kiosk = Kiosk();
        await kiosk.ClockFromKioskAsync(CoA, KioskPunch(BenId, "clockin", OpenSiteA));
        await kiosk.ClockFromKioskAsync(CoA, KioskPunch(BenId, "clockout", OpenSiteA));

        Assert.Equal("OffShift", await StatusOf(BenId));
        Assert.Equal(2, await EventCount(BenId));
    }

    // ── PIN verification endpoint (/api/auth/verify-pin) ─────────────────────

    [Fact]
    public async Task VerifyPin_RightPin_IsVerified()
    {
        var result = await Auth().VerifyPin(new PinVerificationRequest { PersonId = AnaId, Pin = AnaPin });
        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Contains("\"verified\":true", System.Text.Json.JsonSerializer.Serialize(ok.Value));
    }

    [Fact]
    public async Task VerifyPin_WrongPin_IsNotVerified()
    {
        var result = await Auth().VerifyPin(new PinVerificationRequest { PersonId = AnaId, Pin = "0000" });
        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Contains("\"verified\":false", System.Text.Json.JsonSerializer.Serialize(ok.Value));
    }

    [Fact]
    public async Task VerifyPin_PersonWithoutPin_Is404()
    {
        var result = await Auth().VerifyPin(new PinVerificationRequest { PersonId = BenId, Pin = AnaPin });
        Assert.IsType<NotFoundObjectResult>(result);
    }

    // ── CompanyId isolation ──────────────────────────────────────────────────

    [Fact]
    public async Task Isolation_BodyCompanyId_IsOverriddenByTheRoute()
    {
        var dto = Punch(CoB, AnaId, "clockin"); // body claims company B, route is company A

        var result = await MobileController(AnaId).CreateShiftEvent(CoA, dto);

        Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(CoA, (await _context.ShiftEvents.SingleAsync()).CompanyId);
    }

    [Fact]
    public async Task Isolation_PunchForAnotherCompanysPerson_Is404_AndTouchesNothing()
    {
        var result = await MobileController().CreateShiftEvent(CoA, Punch(CoA, CarlaId, "clockin"));

        Assert.IsType<NotFoundObjectResult>(result.Result);
        Assert.Equal(0, await EventCount(CarlaId));
        Assert.Null(await StatusOf(CarlaId));
    }

    [Fact]
    public async Task Isolation_AnotherCompanysSiteId_IsNotStoredOnTheEvent()
    {
        var dto = Punch(CoA, AnaId, "clockin");
        dto.LocationId = SiteB;

        await MobileController(AnaId).CreateShiftEvent(CoA, dto);

        var stored = await _context.ShiftEvents.SingleAsync();
        Assert.Null(stored.LocationId);
        Assert.Equal("Unknown", stored.GeofenceStatus);
    }

    [Fact]
    public async Task Isolation_ListEndpoints_OnlyReturnTheRouteCompanysEvents()
    {
        await MobileController().CreateShiftEvent(CoA, Punch(CoA, AnaId, "clockin"));
        await MobileController().CreateShiftEvent(CoB, Punch(CoB, CarlaId, "clockin"));
        var api = MobileController();

        var byCompany = Values(await api.GetShiftEventsByCompanyId(CoB));
        var byType = Values(await api.GetShiftEventsByEventType(CoB, "clockin"));
        var byForeignPerson = Values(await api.GetShiftEventsByPersonId(CoB, AnaId));

        Assert.All(byCompany, e => Assert.Equal(CoB, e.CompanyId));
        Assert.Single(byCompany);
        Assert.All(byType, e => Assert.Equal(CoB, e.CompanyId));
        Assert.Single(byType);
        Assert.Empty(byForeignPerson);
    }

    [Fact]
    public async Task Isolation_GetUpdateDelete_ByIdFromAnotherCompany_Are404_AndChangeNothing()
    {
        var created = await _shiftEvents.CreateShiftEventAsync(Punch(CoA, AnaId, "clockin"));
        var id = created.EventLogId;
        var api = MobileController();

        Assert.IsType<NotFoundResult>((await api.GetShiftEvent(CoB, id)).Result);

        var edit = Punch(CoB, AnaId, "clockin");
        edit.Description = "tampered";
        Assert.IsType<NotFoundResult>((await api.UpdateShiftEvent(CoB, id, edit)).Result);

        Assert.IsType<NotFoundResult>(await api.DeleteShiftEvent(CoB, id));

        var stored = await _context.ShiftEvents.AsNoTracking().SingleAsync(e => e.EventLogId == id);
        Assert.Equal(CoA, stored.CompanyId);
        Assert.NotEqual("tampered", stored.Description);
        Assert.IsType<OkObjectResult>((await api.GetShiftEvent(CoA, id)).Result);
    }

    [Fact]
    public async Task Isolation_Update_CannotMoveAnEventToAnotherCompany_OrReKeyIt()
    {
        var created = await _shiftEvents.CreateShiftEventAsync(Punch(CoA, AnaId, "clockin"));
        var id = created.EventLogId;
        var edit = Punch(CoB, AnaId, "clockin"); // different CompanyId and EventLogId in the body
        edit.EventDate = created.EventDate;
        edit.Description = "fixed typo";

        var result = await MobileController().UpdateShiftEvent(CoA, id, edit);

        Assert.IsType<OkObjectResult>(result.Result);
        var stored = await _context.ShiftEvents.AsNoTracking().SingleAsync();
        Assert.Equal(id, stored.EventLogId);
        Assert.Equal(CoA, stored.CompanyId);
        Assert.Equal("fixed typo", stored.Description);
    }

    [Fact]
    public async Task Isolation_Kiosk_CannotPunchAnotherCompanysPerson()
    {
        await Assert.ThrowsAsync<ArgumentException>(
            () => Kiosk().ClockFromKioskAsync(CoA, KioskPunch(CarlaId, "clockin", OpenSiteA, AnaPin)));
        Assert.Equal(0, await EventCount(CarlaId));
    }

    [Fact]
    public async Task Isolation_Kiosk_CannotUseAnotherCompanysSite()
    {
        await Assert.ThrowsAsync<ArgumentException>(
            () => Kiosk().ClockFromKioskAsync(CoA, KioskPunch(AnaId, "clockin", SiteB, AnaPin)));
        Assert.Equal(0, await EventCount(AnaId));
    }

    [Fact]
    public async Task Isolation_Kiosk_ReplayingAnotherCompanysEventId_Is409()
    {
        var id = Guid.NewGuid();
        await Kiosk().ClockFromKioskAsync(CoA, KioskPunch(AnaId, "clockin", OpenSiteA, id: id));

        var ex = await Assert.ThrowsAsync<KioskPunchRejectedException>(
            () => Kiosk().ClockFromKioskAsync(CoB, KioskPunch(CarlaId, "clockin", SiteB, id: id)));

        Assert.Equal(409, ex.StatusCode);
        Assert.Equal(0, await EventCount(CarlaId));
    }

    private static List<ShiftEventDto> Values(ActionResult<IEnumerable<ShiftEventDto>> result) =>
        Assert.IsAssignableFrom<IEnumerable<ShiftEventDto>>(Assert.IsType<OkObjectResult>(result.Result).Value).ToList();
}
