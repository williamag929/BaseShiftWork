# Mobile Lineup — API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the backend for the phone "lineup" board: `GET lineup?date=` (sites, bench, unavailable, crews, `canEdit`) and `POST lineup/commit` (assign/remove people in one batch), enforced by permissions and per-user location scope.

**Architecture:** A facade over existing scheduling. One `IAvailabilityService` becomes the single source of truth for "who is free in a window" (shifts + approved time off) and is reused by lineup and `replacement-candidates`. `LineupQueryService` builds the board; `LineupCommitService` creates/voids `ScheduleShift` rows through the existing `IScheduleShiftService` and `IScheduleValidationService`. Three new permissions (`lineup.view`, `lineup.edit`, `lineup.all-locations`) plus a `UserLocationScope` table limit which sites a user sees.

**Tech Stack:** .NET (net9.0 target), EF Core 8 / SQL Server, xUnit + EF InMemory + Moq + `FakeTimeProvider`.

**Spec:** `docs/superpowers/specs/2026-09-29-mobile-lineup-design.md` (read it first; this plan implements sections 4–7 and 9–10, with the three amendments below).

**Not in this plan:** Angular admin screens (scope assignment, default shift), and the mobile app. Those get their own plans (spec §11 steps 2–4).

## Spec amendments (recorded in the spec file's "Amendments" section)

- **A. Availability ignores `Schedule` rows.** A person is unavailable only if they have a non-void `ScheduleShift` overlapping the window, or an approved `TimeOffRequest` covering the day. `Schedule` is a container that commit reuses or creates; it is not a busy signal. (Spec §5 listed schedule overlap; §7 reuses a covering schedule, which contradicted it.)
- **B. Person status.** Only `Person.Status == "Active"` people appear on the bench. Inactive people appear nowhere.
- **D. Crew availability is unchanged in this plan.** Spec §5 also moves `CrewsController`'s availability endpoint onto the shared service. That endpoint is not on the lineup path, so it is deferred to a small follow-up; until then it can disagree with lineup.
- **C. Overlap error is final.** `acceptWarnings` only overrides validation *warnings*. Validation *errors* (overlap, rest time, daily hours) are never overridable.

## Global Constraints

- Every query filters by `CompanyId` taken from the route. Never trust a client-supplied company.
- Controllers stay thin; logic lives in services; DTOs never expose EF models (CLAUDE.md).
- Permission keys are `resource.action`, seeded in `PermissionSeedService`, registered one policy per key in `Program.cs`.
- Dates on the wire: `date=YYYY-MM-DD` interpreted in the **company** time zone (`Company.TimeZone`, fallback `CompanySettings.DefaultTimeZone`, fallback `UTC`). Instants on the wire are UTC ISO-8601.
- Active site means `Location.Status == "Active"`.
- Default shift lives in `Location.Settings` JSON as `{"defaultShift":{"start":"HH:mm","end":"HH:mm","areaId":int?}}`.
- Shift status on create: `"Published"` when `CompanySettings.AutoApproveShifts`, else `"unpublished"`. Removal hard-deletes via `IScheduleShiftService.Delete` (as `DELETE schedule-shifts` does); only shifts in scope, in the company, whose `StartDate` is after now (UTC) may be removed. In one commit, removals are processed before assignments so a move between sites does not trip the overlap check.
- Comments only for non-obvious *why*.
- **This plan's code was written without a .NET SDK available and has not been compiled.** Run `dotnet build` after each task and fix signature drift against the real source rather than guessing.

## Review Focus

1. A shift that started the previous evening and runs past midnight makes that person unavailable on the requested date (Task 2).
2. A single-day approved time-off (`StartDate == EndDate`) blocks that day, and does not block the neighbouring days (Task 2).
3. Moving a person between sites in one commit (removal at A + assignment at B) succeeds instead of tripping the overlap check (Task 5).
4. `acceptWarnings: true` never lets an overlap error through (Task 5).
5. DST days (25-hour fall-back day, spring-forward gap time) don't throw and give sane windows (Task 2).

## File Structure

Create (all under `ShiftWork.Api/`):
- `Models/UserLocationScope.cs` — which sites a company user may see/edit.
- `Authorization/UserClaims.cs` — one shared "get user id from principal" helper.
- `Services/LineupTime.cs` — pure time-zone/day-window/shift-window math.
- `Services/CompanyTimeZoneService.cs` — resolves a company's `TimeZoneInfo`.
- `Services/AvailabilityService.cs` — single availability truth.
- `Services/LineupAccessService.cs` — resolves permissions + scope into `LineupAccess`.
- `Services/LocationDefaultShift.cs` — parses `Location.Settings`.
- `DTOs/LineupDtos.cs`, `DTOs/LineupCommitDtos.cs`.
- `Services/LineupQueryService.cs`, `Services/LineupCommitService.cs`.
- `Controllers/LineupController.cs`.
- Migration `AddLineupLocationScope` (generated).

Modify: `Services/PermissionSeedService.cs`, `Program.cs`, `Data/ShiftWorkContext.cs`, `Authorization/PermissionAuthorizationHandler.cs`, `Services/ScheduleShiftService.cs`, `Controllers/ScheduleShiftsController.cs`.

Tests (under `ShiftWork.Api.Tests/Lineup/`): `LineupTestData.cs`, `LineupPermissionSeedTests.cs`, `LineupTimeTests.cs`, `AvailabilityServiceTests.cs`, `LineupAccessServiceTests.cs`, `LocationDefaultShiftTests.cs`, `LineupQueryServiceTests.cs`, `LineupCommitServiceTests.cs`, `LineupControllerTests.cs`, `ReplacementCandidatesTests.cs`.

---

### Task 1: Permissions, policies, location scope table

**Files:**
- Create: `ShiftWork.Api/Models/UserLocationScope.cs`
- Create: `ShiftWork.Api.Tests/Lineup/LineupTestData.cs`
- Test: `ShiftWork.Api.Tests/Lineup/LineupPermissionSeedTests.cs`
- Modify: `ShiftWork.Api/Services/PermissionSeedService.cs` (after `Create("crews.assign", ...)`)
- Modify: `ShiftWork.Api/Program.cs` (after the `crews.assign` `AddPolicy` line)
- Modify: `ShiftWork.Api/Data/ShiftWorkContext.cs` (after `DbSet<PersonCrew>`, and in `OnModelCreating`)
- Modify: `docs/superpowers/specs/2026-09-29-mobile-lineup-design.md` (amendments A–C)

**Interfaces:**
- Produces: `UserLocationScope { int UserLocationScopeId; string CompanyId; string CompanyUserId; int LocationId }`; `ShiftWorkContext.UserLocationScopes`; permission keys `lineup.view`, `lineup.edit`, `lineup.all-locations`; policies `lineup.view`, `lineup.edit`; test helpers `LineupTestData.NewContext()`, `.Company(...)`, `.Location(...)`.

- [ ] **Step 1: Write the failing test and shared helper**

`ShiftWork.Api.Tests/Lineup/LineupTestData.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Tests.Lineup;

internal static class LineupTestData
{
    public const string CompanyId = "lineup-co";

    public static ShiftWorkContext NewContext() =>
        new(new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    // The InMemory provider rejects missing non-nullable strings, so fill them all in one place.
    public static Company Company(string id = CompanyId, string tz = "America/New_York") => new()
    {
        CompanyId = id, Name = id, Email = "c@example.com", PhoneNumber = "", Address = "", TimeZone = tz
    };

    public static Location Location(int id, string name, string status = "Active", string? settings = null,
        string companyId = CompanyId, string tz = "America/New_York") => new()
    {
        LocationId = id, CompanyId = companyId, Name = name, Status = status, Settings = settings,
        Address = "1 Test St", City = "", State = "", Country = "US", ZipCode = "00000",
        GeoCoordinates = "0,0", RatioMax = 150, TimeZone = tz
    };
}
```

`ShiftWork.Api.Tests/Lineup/LineupPermissionSeedTests.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class LineupPermissionSeedTests
{
    [Theory]
    [InlineData("lineup.view")]
    [InlineData("lineup.edit")]
    [InlineData("lineup.all-locations")]
    public async Task Seed_creates_lineup_permission(string key)
    {
        await using var ctx = LineupTestData.NewContext();
        await new PermissionSeedService(ctx).SeedAsync();
        Assert.True(await ctx.Permissions.AnyAsync(p => p.Key == key));
    }

    [Fact]
    public async Task Scope_rows_are_unique_per_company_user_location()
    {
        await using var ctx = LineupTestData.NewContext();
        var entity = ctx.Model.FindEntityType(typeof(ShiftWork.Api.Models.UserLocationScope))!;
        var index = entity.GetIndexes().Single(i => i.IsUnique);
        Assert.Equal(new[] { "CompanyId", "CompanyUserId", "LocationId" },
            index.Properties.Select(p => p.Name).ToArray());
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ShiftWork.Api.Tests && dotnet test --filter LineupPermissionSeedTests`
Expected: build FAIL (`UserLocationScope` not defined).

- [ ] **Step 3: Implement**

`Models/UserLocationScope.cs`:
```csharp
namespace ShiftWork.Api.Models
{
    // No FKs on purpose: matches how CompanyUser/Location are linked elsewhere and keeps deletes cheap.
    public class UserLocationScope
    {
        public int UserLocationScopeId { get; set; }
        public string CompanyId { get; set; } = string.Empty;
        public string CompanyUserId { get; set; } = string.Empty; // CompanyUser.CompanyUserId is a string
        public int LocationId { get; set; }
    }
}
```
In `ShiftWorkContext.cs` add next to the other DbSets:
```csharp
public DbSet<UserLocationScope> UserLocationScopes { get; set; }
```
and inside `OnModelCreating`:
```csharp
modelBuilder.Entity<UserLocationScope>()
    .HasIndex(s => new { s.CompanyId, s.CompanyUserId, s.LocationId })
    .IsUnique();
```
In `PermissionSeedService.cs` after the `crews.assign` line:
```csharp
                // Lineup
                Create("lineup.view", "Lineup - View", "View the daily lineup board"),
                Create("lineup.edit", "Lineup - Edit", "Assign and remove people on the lineup board"),
                Create("lineup.all-locations", "Lineup - All locations", "See every job site, not just assigned ones"),
```
In `Program.cs` after the `crews.assign` policy line:
```csharp
    options.AddPolicy("lineup.view", policy => policy.Requirements.Add(new PermissionRequirement("lineup.view")));
    options.AddPolicy("lineup.edit", policy => policy.Requirements.Add(new PermissionRequirement("lineup.edit")));
    options.AddPolicy("lineup.all-locations", policy => policy.Requirements.Add(new PermissionRequirement("lineup.all-locations")));
```
The spec file already carries an "Amendments" section with A–D (added when this plan was written); confirm it is in the commit.

- [ ] **Step 4: Generate the migration and run tests**

Run:
```bash
cd ShiftWork.Api && dotnet ef migrations add AddLineupLocationScope
cd ../ShiftWork.Api.Tests && dotnet test --filter LineupPermissionSeedTests
```
Expected: migration creates table `UserLocationScopes` with the unique index; tests PASS. Open the generated migration and confirm it contains only that table (no unrelated drift); if it does, stop and report.

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Api ShiftWork.Api.Tests docs/superpowers/specs
git commit -m "feat(lineup): permissions, policies and location scope table"
```

---
### Task 2: Time helpers and the availability service

**Files:**
- Create: `ShiftWork.Api/Services/LineupTime.cs`
- Create: `ShiftWork.Api/Services/CompanyTimeZoneService.cs`
- Create: `ShiftWork.Api/Services/AvailabilityService.cs`
- Test: `ShiftWork.Api.Tests/Lineup/LineupTimeTests.cs`, `ShiftWork.Api.Tests/Lineup/AvailabilityServiceTests.cs`
- Modify: `ShiftWork.Api/Program.cs` (DI, after `IScheduleValidationService` line)

**Interfaces:**
- Consumes: `ShiftWorkContext` (`Persons`, `ScheduleShifts`, `TimeOffRequests`, `Companies`, `CompanySettings`); `Person.PersonId` is `int`, `ScheduleShift.PersonId` is `int`, `TimeOffRequest.PersonId` is `int`.
- Produces:
  - `static class LineupTime`: `TimeZoneInfo Resolve(string? id)`; `DateTime ToUtc(DateOnly date, TimeOnly time, TimeZoneInfo tz)`; `(DateTime StartUtc, DateTime EndUtc) DayWindowUtc(DateOnly date, TimeZoneInfo tz)`; `(DateTime StartUtc, DateTime EndUtc) ShiftWindowUtc(DateOnly date, TimeOnly start, TimeOnly end, TimeZoneInfo tz)`.
  - `interface ICompanyTimeZoneService { Task<TimeZoneInfo> GetAsync(string companyId); }`
  - `enum UnavailableReason { Shift, TimeOff }`; `record UnavailablePerson(Person Person, UnavailableReason Reason, int? LocationId, DateTime? StartUtc, DateTime? EndUtc)`; `record AvailabilityResult(IReadOnlyList<Person> Available, IReadOnlyList<UnavailablePerson> Unavailable)`.
  - `interface IAvailabilityService { Task<AvailabilityResult> GetForWindowAsync(string companyId, DateTime startUtc, DateTime endUtc, TimeZoneInfo tz); }` — the `tz` is needed to decide which local calendar days a time-off row covers.

Rules (amendments A and B): candidates are `Person.Status == "Active"` in the company. A person is `Shift`-unavailable if any `ScheduleShift` in the company with `PersonId` = them, `Status` not `void` (case-insensitive), overlaps `[startUtc, endUtc)`. A person is `TimeOff`-unavailable if an `Approved` `TimeOffRequest` (case-insensitive, non-partial-day) covers any local calendar day touched by the window. Partial-day requests are ignored on purpose (YAGNI; they don't remove someone for the whole day). A person is also `TimeOff`-unavailable if a `ShiftEvent` with `EventType` `sick` or `timeoff` (case-insensitive) has `EventDate` inside `[startUtc, endUtc)` (spec §5 rule 5). Shift beats time-off when both apply.

- [ ] **Step 1: Write the failing time tests**

`LineupTimeTests.cs`:
```csharp
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class LineupTimeTests
{
    private static readonly TimeZoneInfo Ny = LineupTime.Resolve("America/New_York");

    [Fact]
    public void Day_window_for_normal_day_is_24h_in_utc()
    {
        var (s, e) = LineupTime.DayWindowUtc(new DateOnly(2026, 10, 1), Ny);
        Assert.Equal(new DateTime(2026, 10, 1, 4, 0, 0, DateTimeKind.Utc), s);
        Assert.Equal(new DateTime(2026, 10, 2, 4, 0, 0, DateTimeKind.Utc), e);
    }

    [Fact] // Review Focus 5: fall-back day has 25 hours
    public void Day_window_on_fall_back_day_is_25h()
    {
        var (s, e) = LineupTime.DayWindowUtc(new DateOnly(2026, 11, 1), Ny);
        Assert.Equal(new DateTime(2026, 11, 1, 4, 0, 0, DateTimeKind.Utc), s);
        Assert.Equal(new DateTime(2026, 11, 2, 5, 0, 0, DateTimeKind.Utc), e);
    }

    [Fact] // Review Focus 5: 02:30 does not exist on 2026-03-08 in New York
    public void Time_inside_spring_forward_gap_does_not_throw()
    {
        var utc = LineupTime.ToUtc(new DateOnly(2026, 3, 8), new TimeOnly(2, 30), Ny);
        Assert.Equal(new DateTime(2026, 3, 8, 7, 30, 0, DateTimeKind.Utc), utc);
    }

    [Fact]
    public void Overnight_shift_ends_next_day()
    {
        var (s, e) = LineupTime.ShiftWindowUtc(new DateOnly(2026, 10, 1), new TimeOnly(22, 0), new TimeOnly(6, 0), Ny);
        Assert.Equal(new DateTime(2026, 10, 2, 2, 0, 0, DateTimeKind.Utc), s);
        Assert.Equal(new DateTime(2026, 10, 2, 10, 0, 0, DateTimeKind.Utc), e);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Not/AZone")]
    public void Unknown_zone_falls_back_to_utc(string? id) =>
        Assert.Equal(TimeZoneInfo.Utc.Id, LineupTime.Resolve(id).Id);
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd ShiftWork.Api.Tests && dotnet test --filter LineupTimeTests`
Expected: build FAIL (`LineupTime` not defined).

- [ ] **Step 3: Implement `LineupTime` and the tz service**

`Services/LineupTime.cs`:
```csharp
using System;

namespace ShiftWork.Api.Services
{
    public static class LineupTime
    {
        public static TimeZoneInfo Resolve(string? id)
        {
            if (string.IsNullOrWhiteSpace(id)) return TimeZoneInfo.Utc;
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { return TimeZoneInfo.Utc; }
            catch (InvalidTimeZoneException) { return TimeZoneInfo.Utc; }
        }

        public static DateTime ToUtc(DateOnly date, TimeOnly time, TimeZoneInfo tz)
        {
            var local = DateTime.SpecifyKind(date.ToDateTime(time), DateTimeKind.Unspecified);
            // Spring-forward gap: the wall time doesn't exist, so read it as one hour later.
            if (tz.IsInvalidTime(local)) local = local.AddHours(1);
            // Ambiguous (fall-back) times resolve to the standard-time instant by default; fine for scheduling.
            return DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeToUtc(local, tz), DateTimeKind.Utc);
        }

        public static (DateTime StartUtc, DateTime EndUtc) DayWindowUtc(DateOnly date, TimeZoneInfo tz) =>
            (ToUtc(date, TimeOnly.MinValue, tz), ToUtc(date.AddDays(1), TimeOnly.MinValue, tz));

        public static (DateTime StartUtc, DateTime EndUtc) ShiftWindowUtc(DateOnly date, TimeOnly start, TimeOnly end, TimeZoneInfo tz)
        {
            var endDate = end <= start ? date.AddDays(1) : date;
            return (ToUtc(date, start, tz), ToUtc(endDate, end, tz));
        }
    }
}
```
`Services/CompanyTimeZoneService.cs`:
```csharp
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using System;

namespace ShiftWork.Api.Services
{
    public interface ICompanyTimeZoneService
    {
        Task<TimeZoneInfo> GetAsync(string companyId);
    }

    public class CompanyTimeZoneService : ICompanyTimeZoneService
    {
        private readonly ShiftWorkContext _context;
        public CompanyTimeZoneService(ShiftWorkContext context) => _context = context;

        public async Task<TimeZoneInfo> GetAsync(string companyId)
        {
            var companyZone = await _context.Companies
                .Where(c => c.CompanyId == companyId)
                .Select(c => c.TimeZone)
                .FirstOrDefaultAsync();
            if (!string.IsNullOrWhiteSpace(companyZone)) return LineupTime.Resolve(companyZone);

            var settingsZone = await _context.CompanySettings
                .Where(s => s.CompanyId == companyId)
                .Select(s => s.DefaultTimeZone)
                .FirstOrDefaultAsync();
            return LineupTime.Resolve(settingsZone);
        }
    }
}
```
(If `Company.TimeZone` or `CompanySettings.DefaultTimeZone` is not a plain `string?`, adapt the projection; `dotnet build` will say.)

- [ ] **Step 4: Run time tests — expect PASS**

Run: `dotnet test --filter LineupTimeTests`

- [ ] **Step 5: Write the failing availability tests**

`AvailabilityServiceTests.cs`:
```csharp
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class AvailabilityServiceTests
{
    private const string Co = LineupTestData.CompanyId;
    private static readonly TimeZoneInfo Ny = LineupTime.Resolve("America/New_York");
    private static readonly DateOnly Day = new(2026, 10, 1);

    private static async Task<(ShiftWork.Api.Data.ShiftWorkContext, AvailabilityService)> Arrange(
        Action<ShiftWork.Api.Data.ShiftWorkContext> seed)
    {
        var ctx = LineupTestData.NewContext();
        ctx.Persons.AddRange(
            new Person { PersonId = 1, Name = "Free", CompanyId = Co, Email = "1@x.com", Status = "Active" },
            new Person { PersonId = 2, Name = "Busy", CompanyId = Co, Email = "2@x.com", Status = "Active" },
            new Person { PersonId = 3, Name = "Gone", CompanyId = Co, Email = "3@x.com", Status = "Inactive" },
            new Person { PersonId = 4, Name = "Other", CompanyId = "other-co", Email = "4@x.com", Status = "Active" });
        seed(ctx);
        await ctx.SaveChangesAsync();
        return (ctx, new AvailabilityService(ctx));
    }

    private static ScheduleShift Shift(int person, DateTime s, DateTime e, string status = "Published", int loc = 10) =>
        new() { CompanyId = Co, PersonId = person, LocationId = loc, StartDate = s, EndDate = e, Status = status };

    private static DateTime U(int y, int m, int d, int h) => new(y, m, d, h, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Only_active_people_in_the_company_are_candidates()
    {
        var (ctx, svc) = await Arrange(_ => { });
        var (s, e) = LineupTime.DayWindowUtc(Day, Ny);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Equal(new[] { 1, 2 }, r.Available.Select(p => p.PersonId).OrderBy(x => x));
        Assert.Empty(r.Unavailable);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Shift_in_window_makes_person_unavailable_with_location()
    {
        var (ctx, svc) = await Arrange(c => c.ScheduleShifts.Add(Shift(2, U(2026, 10, 1, 12), U(2026, 10, 1, 20))));
        var (s, e) = LineupTime.DayWindowUtc(Day, Ny);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        var busy = Assert.Single(r.Unavailable);
        Assert.Equal(2, busy.Person.PersonId);
        Assert.Equal(UnavailableReason.Shift, busy.Reason);
        Assert.Equal(10, busy.LocationId);
        Assert.DoesNotContain(r.Available, p => p.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Fact] // Review Focus 1
    public async Task Shift_started_previous_evening_and_running_past_midnight_blocks_the_day()
    {
        // 2026-09-30 22:00 NY -> 2026-10-01 06:00 NY  (= 02:00Z .. 10:00Z on Oct 1)
        var (ctx, svc) = await Arrange(c => c.ScheduleShifts.Add(Shift(2, U(2026, 10, 1, 2), U(2026, 10, 1, 10))));
        var (s, e) = LineupTime.DayWindowUtc(Day, Ny);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Contains(r.Unavailable, u => u.Person.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Void_shift_does_not_block()
    {
        var (ctx, svc) = await Arrange(c => c.ScheduleShifts.Add(Shift(2, U(2026, 10, 1, 12), U(2026, 10, 1, 20), "void")));
        var (s, e) = LineupTime.DayWindowUtc(Day, Ny);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Contains(r.Available, p => p.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Shift_ending_exactly_when_window_starts_does_not_block()
    {
        var (ctx, svc) = await Arrange(c => c.ScheduleShifts.Add(Shift(2, U(2026, 9, 30, 20), U(2026, 10, 1, 4))));
        var (s, e) = LineupTime.DayWindowUtc(Day, Ny);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Contains(r.Available, p => p.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Fact] // Review Focus 2
    public async Task Single_day_approved_time_off_blocks_that_day_only()
    {
        var off = new TimeOffRequest
        {
            CompanyId = Co, PersonId = 2, Status = "Approved",
            StartDate = new DateTime(2026, 10, 1), EndDate = new DateTime(2026, 10, 1)
        };
        var (ctx, svc) = await Arrange(c => c.TimeOffRequests.Add(off));

        var (s, e) = LineupTime.DayWindowUtc(Day, Ny);
        var blocked = await svc.GetForWindowAsync(Co, s, e, Ny);
        var u = Assert.Single(blocked.Unavailable);
        Assert.Equal(UnavailableReason.TimeOff, u.Reason);

        var (ns, ne) = LineupTime.DayWindowUtc(Day.AddDays(1), Ny);
        var next = await svc.GetForWindowAsync(Co, ns, ne, Ny);
        Assert.Contains(next.Available, p => p.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Theory]
    [InlineData("Pending")]
    [InlineData("Denied")]
    [InlineData("Cancelled")]
    public async Task Non_approved_time_off_does_not_block(string status)
    {
        var (ctx, svc) = await Arrange(c => c.TimeOffRequests.Add(new TimeOffRequest
        {
            CompanyId = Co, PersonId = 2, Status = status,
            StartDate = new DateTime(2026, 10, 1), EndDate = new DateTime(2026, 10, 1)
        }));
        var (s, e) = LineupTime.DayWindowUtc(Day, Ny);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Contains(r.Available, p => p.PersonId == 2);
        await ctx.DisposeAsync();
    }

    [Theory]
    [InlineData("sick", true)]
    [InlineData("timeoff", true)]
    [InlineData("clockin", false)]
    public async Task Sick_and_timeoff_events_in_window_block(string type, bool blocks)
    {
        var (ctx, svc) = await Arrange(c => c.ShiftEvents.Add(new ShiftEvent
        {
            EventLogId = Guid.NewGuid(), CompanyId = Co, PersonId = 2, EventType = type,
            EventDate = U(2026, 10, 1, 15)
        }));
        var (s, e) = LineupTime.DayWindowUtc(Day, Ny);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Equal(blocks, r.Unavailable.Any(u => u.Person.PersonId == 2 && u.Reason == UnavailableReason.TimeOff));
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Shift_reason_wins_over_time_off()
    {
        var (ctx, svc) = await Arrange(c =>
        {
            c.ScheduleShifts.Add(Shift(2, U(2026, 10, 1, 12), U(2026, 10, 1, 20)));
            c.TimeOffRequests.Add(new TimeOffRequest
            {
                CompanyId = Co, PersonId = 2, Status = "Approved",
                StartDate = new DateTime(2026, 10, 1), EndDate = new DateTime(2026, 10, 1)
            });
        });
        var (s, e) = LineupTime.DayWindowUtc(Day, Ny);
        var r = await svc.GetForWindowAsync(Co, s, e, Ny);
        Assert.Equal(UnavailableReason.Shift, Assert.Single(r.Unavailable).Reason);
        await ctx.DisposeAsync();
    }
}
```

- [ ] **Step 6: Run to verify failure**

Run: `dotnet test --filter AvailabilityServiceTests` — Expected: build FAIL (`AvailabilityService` not defined).

- [ ] **Step 7: Implement `AvailabilityService`**

`Services/AvailabilityService.cs`:
```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public enum UnavailableReason { Shift, TimeOff }

    public record UnavailablePerson(Person Person, UnavailableReason Reason, int? LocationId, DateTime? StartUtc, DateTime? EndUtc);

    public record AvailabilityResult(IReadOnlyList<Person> Available, IReadOnlyList<UnavailablePerson> Unavailable);

    public interface IAvailabilityService
    {
        Task<AvailabilityResult> GetForWindowAsync(string companyId, DateTime startUtc, DateTime endUtc, TimeZoneInfo tz);
    }

    public class AvailabilityService : IAvailabilityService
    {
        private readonly ShiftWorkContext _context;
        public AvailabilityService(ShiftWorkContext context) => _context = context;

        public async Task<AvailabilityResult> GetForWindowAsync(string companyId, DateTime startUtc, DateTime endUtc, TimeZoneInfo tz)
        {
            var people = await _context.Persons
                .Where(p => p.CompanyId == companyId && p.Status == "Active")
                .OrderBy(p => p.Name)
                .ToListAsync();

            var shifts = await _context.ScheduleShifts
                .Where(s => s.CompanyId == companyId
                            && s.Status.ToLower() != "void"
                            && s.StartDate < endUtc && s.EndDate > startUtc)
                .ToListAsync();

            // Local calendar days the window touches (last instant is exclusive).
            var firstDay = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(startUtc, tz));
            var lastDay = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(endUtc.AddTicks(-1), tz));
            var firstDt = firstDay.ToDateTime(TimeOnly.MinValue);
            var lastDt = lastDay.ToDateTime(TimeOnly.MinValue);

            var timeOff = await _context.TimeOffRequests
                .Where(t => t.CompanyId == companyId
                            && t.Status.ToLower() == "approved"
                            && !t.IsPartialDay
                            && t.StartDate.Date <= lastDt && t.EndDate.Date >= firstDt)
                .ToListAsync();

            var offEventPersonIds = (await _context.ShiftEvents
                .Where(ev => ev.CompanyId == companyId
                             && ev.EventType != null
                             && (ev.EventType.ToLower() == "sick" || ev.EventType.ToLower() == "timeoff")
                             && ev.EventDate >= startUtc && ev.EventDate < endUtc)
                .Select(ev => ev.PersonId)
                .Distinct()
                .ToListAsync()).ToHashSet();

            var available = new List<Person>();
            var unavailable = new List<UnavailablePerson>();
            foreach (var p in people)
            {
                var shift = shifts.Where(s => s.PersonId == p.PersonId).OrderBy(s => s.StartDate).FirstOrDefault();
                if (shift != null)
                {
                    unavailable.Add(new UnavailablePerson(p, UnavailableReason.Shift, shift.LocationId, shift.StartDate, shift.EndDate));
                    continue;
                }
                if (offEventPersonIds.Contains(p.PersonId) || timeOff.Any(t => t.PersonId == p.PersonId))
                {
                    unavailable.Add(new UnavailablePerson(p, UnavailableReason.TimeOff, null, null, null));
                    continue;
                }
                available.Add(p);
            }
            return new AvailabilityResult(available, unavailable);
        }
    }
}
```
Register in `Program.cs` after the `IScheduleValidationService` line:
```csharp
builder.Services.AddScoped<ICompanyTimeZoneService, CompanyTimeZoneService>();
builder.Services.AddScoped<IAvailabilityService, AvailabilityService>();
```
Note: `ScheduleShift.StartDate/EndDate` are assumed stored as UTC (verify against `ScheduleShiftsController` create flow; if they turn out to be local, stop and report before continuing).

- [ ] **Step 8: Run tests — expect PASS**

Run: `dotnet test --filter "LineupTimeTests|AvailabilityServiceTests"`

- [ ] **Step 9: Commit**

```bash
git add ShiftWork.Api ShiftWork.Api.Tests
git commit -m "feat(lineup): time helpers and availability service"
```

---
### Task 3: Access resolution and default-shift parsing

**Files:**
- Create: `ShiftWork.Api/Authorization/UserClaims.cs`
- Create: `ShiftWork.Api/Services/LineupAccessService.cs`
- Create: `ShiftWork.Api/Services/LocationDefaultShift.cs`
- Test: `ShiftWork.Api.Tests/Lineup/LineupAccessServiceTests.cs`, `ShiftWork.Api.Tests/Lineup/LocationDefaultShiftTests.cs`
- Modify: `ShiftWork.Api/Authorization/PermissionAuthorizationHandler.cs` (use `UserClaims`)
- Modify: `ShiftWork.Api/Program.cs` (DI)

**Interfaces:**
- Consumes: `CompanyUsers` (`CompanyUserId` string, `Uid`, `Email`, `CompanyId`), `UserRoles` (`CompanyUserId`, `RoleId`, `CompanyId`), `RolePermissions` (`RoleId`, `Permission`), `UserLocationScopes`.
- Produces:
  - `static class UserClaims { string? GetUserId(ClaimsPrincipal user) }` (same claim order the handler uses today).
  - `record LineupAccess(string CompanyUserId, bool CanEdit, bool AllLocations, IReadOnlySet<int> LocationIds) { bool CanSeeLocation(int locationId) }`.
  - `interface ILineupAccessService { Task<LineupAccess?> ResolveAsync(ClaimsPrincipal user, string companyId); }` — returns `null` when the caller has no `CompanyUser` in that company.
  - `record LocationDefaultShift(TimeOnly Start, TimeOnly End, int? AreaId)` with `static LocationDefaultShift? TryParse(string? settingsJson)`.

- [ ] **Step 1: Write the failing tests**

`LocationDefaultShiftTests.cs`:
```csharp
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class LocationDefaultShiftTests
{
    [Fact]
    public void Parses_default_shift_and_ignores_other_keys()
    {
        var d = LocationDefaultShift.TryParse("""{"theme":"x","defaultShift":{"start":"07:00","end":"15:30","areaId":12}}""");
        Assert.NotNull(d);
        Assert.Equal(new TimeOnly(7, 0), d!.Start);
        Assert.Equal(new TimeOnly(15, 30), d.End);
        Assert.Equal(12, d.AreaId);
    }

    [Fact]
    public void Area_is_optional()
    {
        var d = LocationDefaultShift.TryParse("""{"defaultShift":{"start":"22:00","end":"06:00"}}""");
        Assert.Null(d!.AreaId);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("{}")]
    [InlineData("""{"defaultShift":{"start":"7am","end":"15:30"}}""")]
    [InlineData("""{"defaultShift":{"start":"07:00"}}""")]
    public void Missing_or_malformed_returns_null(string? json) =>
        Assert.Null(LocationDefaultShift.TryParse(json));
}
```
`LineupAccessServiceTests.cs`:
```csharp
using System.Security.Claims;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class LineupAccessServiceTests
{
    private const string Co = LineupTestData.CompanyId;

    private static ClaimsPrincipal User(string uid, string? email = null)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, uid) };
        if (email != null) claims.Add(new Claim(ClaimTypes.Email, email));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
    }

    private static async Task GrantAsync(ShiftWorkContext ctx, string companyUserId, params string[] keys)
    {
        var role = new Role { Name = "r-" + companyUserId, Description = "", CompanyId = Co, Status = "Active" };
        ctx.Roles.Add(role);
        foreach (var k in keys)
        {
            var perm = ctx.Permissions.FirstOrDefault(p => p.Key == k) ?? ctx.Permissions.Add(new Permission { Key = k, Name = k }).Entity;
            await ctx.SaveChangesAsync();
            ctx.RolePermissions.Add(new RolePermission { RoleId = role.RoleId, PermissionId = perm.PermissionId });
        }
        await ctx.SaveChangesAsync();
        ctx.UserRoles.Add(new UserRole { CompanyUserId = companyUserId, RoleId = role.RoleId, CompanyId = Co });
        await ctx.SaveChangesAsync();
    }

    private static async Task<ShiftWorkContext> SeedAsync()
    {
        var ctx = LineupTestData.NewContext();
        ctx.CompanyUsers.AddRange(
            new CompanyUser { CompanyUserId = "cu-foreman", Uid = "uid-foreman", Email = "f@x.com", DisplayName = "F", CompanyId = Co },
            new CompanyUser { CompanyUserId = "cu-boss", Uid = "uid-boss", Email = "b@x.com", DisplayName = "B", CompanyId = Co },
            new CompanyUser { CompanyUserId = "cu-other", Uid = "uid-other", Email = "o@x.com", DisplayName = "O", CompanyId = "other-co" });
        ctx.UserLocationScopes.AddRange(
            new UserLocationScope { CompanyId = Co, CompanyUserId = "cu-foreman", LocationId = 7 },
            new UserLocationScope { CompanyId = "other-co", CompanyUserId = "cu-foreman", LocationId = 99 });
        await ctx.SaveChangesAsync();
        await GrantAsync(ctx, "cu-foreman", "lineup.view", "lineup.edit");
        await GrantAsync(ctx, "cu-boss", "lineup.view", "lineup.edit", "lineup.all-locations");
        return ctx;
    }

    [Fact]
    public async Task Foreman_is_scoped_to_assigned_sites_in_this_company_only()
    {
        await using var ctx = await SeedAsync();
        var a = await new LineupAccessService(ctx).ResolveAsync(User("uid-foreman"), Co);
        Assert.NotNull(a);
        Assert.True(a!.CanEdit);
        Assert.False(a.AllLocations);
        Assert.True(a.CanSeeLocation(7));
        Assert.False(a.CanSeeLocation(8));
        Assert.False(a.CanSeeLocation(99));
    }

    [Fact]
    public async Task All_locations_permission_sees_every_site()
    {
        await using var ctx = await SeedAsync();
        var a = await new LineupAccessService(ctx).ResolveAsync(User("uid-boss"), Co);
        Assert.True(a!.AllLocations);
        Assert.True(a.CanSeeLocation(12345));
    }

    [Fact]
    public async Task View_only_user_cannot_edit()
    {
        await using var ctx = await SeedAsync();
        await GrantAsync(ctx, "cu-boss-view", "lineup.view");
        ctx.CompanyUsers.Add(new CompanyUser { CompanyUserId = "cu-boss-view", Uid = "uid-view", Email = "v@x.com", DisplayName = "V", CompanyId = Co });
        await ctx.SaveChangesAsync();
        var a = await new LineupAccessService(ctx).ResolveAsync(User("uid-view"), Co);
        Assert.False(a!.CanEdit);
    }

    [Fact]
    public async Task Email_fallback_matches_invite_accepted_users()
    {
        await using var ctx = await SeedAsync();
        var a = await new LineupAccessService(ctx).ResolveAsync(User("some-person-id", "f@x.com"), Co);
        Assert.Equal("cu-foreman", a!.CompanyUserId);
    }

    [Fact]
    public async Task User_from_another_company_resolves_to_null()
    {
        await using var ctx = await SeedAsync();
        Assert.Null(await new LineupAccessService(ctx).ResolveAsync(User("uid-other"), Co));
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd ShiftWork.Api.Tests && dotnet test --filter "LocationDefaultShiftTests|LineupAccessServiceTests"`
Expected: build FAIL (types not defined).

- [ ] **Step 3: Implement**

`Authorization/UserClaims.cs`:
```csharp
using System.Security.Claims;

namespace ShiftWork.Api.Authorization
{
    public static class UserClaims
    {
        public static string? GetUserId(ClaimsPrincipal user) =>
            user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue("user_id")
            ?? user.FindFirstValue("uid")
            ?? user.FindFirstValue(ClaimTypes.Name)
            ?? user.FindFirstValue("sub");
    }
}
```
In `PermissionAuthorizationHandler.cs`: delete the private `GetUserId` method and change `var uid = GetUserId(context.User);` to `var uid = UserClaims.GetUserId(context.User);`.

`Services/LocationDefaultShift.cs`:
```csharp
using System;
using System.Globalization;
using System.Text.Json;

namespace ShiftWork.Api.Services
{
    public record LocationDefaultShift(TimeOnly Start, TimeOnly End, int? AreaId)
    {
        public static LocationDefaultShift? TryParse(string? settingsJson)
        {
            if (string.IsNullOrWhiteSpace(settingsJson)) return null;
            try
            {
                using var doc = JsonDocument.Parse(settingsJson);
                if (doc.RootElement.ValueKind != JsonValueKind.Object
                    || !doc.RootElement.TryGetProperty("defaultShift", out var d)
                    || d.ValueKind != JsonValueKind.Object) return null;

                if (!TryTime(d, "start", out var start) || !TryTime(d, "end", out var end)) return null;

                int? area = d.TryGetProperty("areaId", out var a) && a.ValueKind == JsonValueKind.Number && a.TryGetInt32(out var id)
                    ? id : null;
                return new LocationDefaultShift(start, end, area);
            }
            catch (JsonException) { return null; }
        }

        private static bool TryTime(JsonElement obj, string name, out TimeOnly time)
        {
            time = default;
            return obj.TryGetProperty(name, out var p)
                   && p.ValueKind == JsonValueKind.String
                   && TimeOnly.TryParseExact(p.GetString(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out time);
        }
    }
}
```
`Services/LineupAccessService.cs`:
```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Authorization;
using ShiftWork.Api.Data;

namespace ShiftWork.Api.Services
{
    public record LineupAccess(string CompanyUserId, bool CanEdit, bool AllLocations, IReadOnlySet<int> LocationIds)
    {
        public bool CanSeeLocation(int locationId) => AllLocations || LocationIds.Contains(locationId);
    }

    public interface ILineupAccessService
    {
        Task<LineupAccess?> ResolveAsync(ClaimsPrincipal user, string companyId);
    }

    public class LineupAccessService : ILineupAccessService
    {
        private readonly ShiftWorkContext _context;
        public LineupAccessService(ShiftWorkContext context) => _context = context;

        public async Task<LineupAccess?> ResolveAsync(ClaimsPrincipal user, string companyId)
        {
            var uid = UserClaims.GetUserId(user);
            if (string.IsNullOrWhiteSpace(uid)) return null;

            var companyUser = await _context.CompanyUsers.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Uid == uid && u.CompanyId == companyId);

            // Same fallback as PermissionAuthorizationHandler: API JWTs carry personId, not Uid.
            if (companyUser == null)
            {
                var email = user.FindFirstValue(ClaimTypes.Email);
                if (!string.IsNullOrWhiteSpace(email))
                {
                    companyUser = await _context.CompanyUsers.AsNoTracking()
                        .FirstOrDefaultAsync(u => u.Email == email && u.CompanyId == companyId);
                }
            }
            if (companyUser == null) return null;

            var keys = await _context.UserRoles.AsNoTracking()
                .Where(ur => ur.CompanyUserId == companyUser.CompanyUserId && ur.CompanyId == companyId)
                .SelectMany(ur => _context.RolePermissions.Where(rp => rp.RoleId == ur.RoleId))
                .Select(rp => rp.Permission.Key)
                .Where(k => k.StartsWith("lineup."))
                .Distinct()
                .ToListAsync();

            var all = keys.Contains("lineup.all-locations");
            var scoped = all
                ? new HashSet<int>()
                : (await _context.UserLocationScopes.AsNoTracking()
                    .Where(s => s.CompanyId == companyId && s.CompanyUserId == companyUser.CompanyUserId)
                    .Select(s => s.LocationId)
                    .ToListAsync()).ToHashSet();

            return new LineupAccess(companyUser.CompanyUserId, keys.Contains("lineup.edit"), all, scoped);
        }
    }
}
```
Register in `Program.cs` after `IAvailabilityService`:
```csharp
builder.Services.AddScoped<ILineupAccessService, LineupAccessService>();
```

- [ ] **Step 4: Run tests, plus the existing authorization tests**

Run: `dotnet test --filter "LocationDefaultShiftTests|LineupAccessServiceTests|BillingAuthorizationTests"`
Expected: PASS (the Billing tests prove the handler refactor didn't change behaviour). If `Role`/`Permission`/`RolePermission` id property names differ from `RoleId`/`PermissionId`, fix the test helper to the real names.

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Api ShiftWork.Api.Tests
git commit -m "feat(lineup): access resolution and default-shift parsing"
```

---

### Task 4: DTOs and the lineup query service

**Files:**
- Create: `ShiftWork.Api/DTOs/LineupDtos.cs`
- Create: `ShiftWork.Api/Services/LineupQueryService.cs`
- Test: `ShiftWork.Api.Tests/Lineup/LineupQueryServiceTests.cs`
- Modify: `ShiftWork.Api/Program.cs` (DI)

**Interfaces:**
- Consumes: `IAvailabilityService`, `ICompanyTimeZoneService`, `LineupTime`, `LineupAccess`, `LocationDefaultShift` (Tasks 2–3).
- Produces: `interface ILineupQueryService { Task<LineupDto> GetAsync(string companyId, DateOnly date, LineupAccess access); }` and the DTO records below (property names become camelCase JSON).

Behaviour: visible locations are `Status == "Active"` and `access.CanSeeLocation`. Cards list non-void shifts overlapping the day at visible locations. `bench` = available people. `unavailable` = unavailable people **not already on a visible card**, with reason `"Time off"` or `"Assigned to another site"` (never a site name — spec §5, no leaking across scope). Crews list every company crew with its members; bench entries carry their crew ids. Company filter everywhere.

- [ ] **Step 1: Write the failing tests**

`LineupQueryServiceTests.cs`:
```csharp
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class LineupQueryServiceTests
{
    private const string Co = LineupTestData.CompanyId;
    private static readonly DateOnly Day = new(2026, 10, 1);
    private static DateTime U(int d, int h) => new(2026, 10, d, h, 0, 0, DateTimeKind.Utc);

    private static async Task<(ShiftWorkContext, LineupQueryService)> ArrangeAsync()
    {
        var ctx = LineupTestData.NewContext();
        ctx.Companies.Add(LineupTestData.Company());
        ctx.Locations.AddRange(
            LineupTestData.Location(7, "Main St", settings: """{"defaultShift":{"start":"07:00","end":"15:30","areaId":12}}"""),
            LineupTestData.Location(8, "Secret Site"),
            LineupTestData.Location(9, "Closed", status: "Inactive"),
            LineupTestData.Location(70, "Foreign", companyId: "other-co"));
        ctx.Persons.AddRange(
            new Person { PersonId = 1, Name = "OnCard", CompanyId = Co, Email = "1@x", Status = "Active" },
            new Person { PersonId = 2, Name = "Elsewhere", CompanyId = Co, Email = "2@x", Status = "Active" },
            new Person { PersonId = 3, Name = "Bench", CompanyId = Co, Email = "3@x", Status = "Active" },
            new Person { PersonId = 4, Name = "OffDay", CompanyId = Co, Email = "4@x", Status = "Active" },
            new Person { PersonId = 5, Name = "Foreign", CompanyId = "other-co", Email = "5@x", Status = "Active" });
        ctx.ScheduleShifts.AddRange(
            new ScheduleShift { ScheduleShiftId = 501, CompanyId = Co, PersonId = 1, LocationId = 7, AreaId = 12, StartDate = U(1, 11), EndDate = U(1, 19), Status = "Published" },
            new ScheduleShift { ScheduleShiftId = 502, CompanyId = Co, PersonId = 2, LocationId = 8, AreaId = 13, StartDate = U(1, 11), EndDate = U(1, 19), Status = "Published" },
            new ScheduleShift { ScheduleShiftId = 503, CompanyId = Co, PersonId = 3, LocationId = 7, AreaId = 12, StartDate = U(3, 11), EndDate = U(3, 19), Status = "Published" });
        ctx.TimeOffRequests.Add(new TimeOffRequest { CompanyId = Co, PersonId = 4, Status = "Approved", StartDate = new DateTime(2026, 10, 1), EndDate = new DateTime(2026, 10, 1) });
        var crew = new Crew { CrewId = 2, Name = "Alpha", CompanyId = Co };
        ctx.Crews.Add(crew);
        ctx.PersonCrews.AddRange(new PersonCrew { PersonId = 3, CrewId = 2 }, new PersonCrew { PersonId = 1, CrewId = 2 });
        await ctx.SaveChangesAsync();
        var svc = new LineupQueryService(ctx, new CompanyTimeZoneService(ctx), new AvailabilityService(ctx));
        return (ctx, svc);
    }

    private static LineupAccess Foreman() => new("cu", true, false, new HashSet<int> { 7 });
    private static LineupAccess Boss() => new("cu", true, true, new HashSet<int>());

    [Fact]
    public async Task Foreman_sees_only_scoped_active_locations_with_their_shifts()
    {
        var (ctx, svc) = await ArrangeAsync();
        var r = await svc.GetAsync(Co, Day, Foreman());
        var loc = Assert.Single(r.Locations);
        Assert.Equal(7, loc.LocationId);
        Assert.Equal("07:00", loc.DefaultShift!.Start);
        Assert.Equal(12, loc.DefaultShift.AreaId);
        var shift = Assert.Single(loc.Shifts);
        Assert.Equal(501, shift.ShiftId);
        Assert.Equal("OnCard", shift.Name);
        Assert.Equal(U(1, 11), shift.Start);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task All_locations_user_sees_every_active_site_but_not_inactive_or_foreign()
    {
        var (ctx, svc) = await ArrangeAsync();
        var r = await svc.GetAsync(Co, Day, Boss());
        Assert.Equal(new[] { 7, 8 }, r.Locations.Select(l => l.LocationId).OrderBy(x => x));
        Assert.Null(r.Locations.Single(l => l.LocationId == 8).DefaultShift);
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Bench_unavailable_and_crews_are_computed_without_leaking_site_names()
    {
        var (ctx, svc) = await ArrangeAsync();
        var r = await svc.GetAsync(Co, Day, Foreman());

        Assert.Equal(new[] { 3 }, r.Bench.Select(p => p.PersonId));
        Assert.Equal(new[] { 2 }, r.Bench.Single().CrewIds);

        var byId = r.Unavailable.ToDictionary(u => u.PersonId);
        Assert.False(byId.ContainsKey(1));                  // on a visible card
        Assert.Equal("Assigned to another site", byId[2].Reason);
        Assert.DoesNotContain("Secret", byId[2].Reason);
        Assert.Equal("Time off", byId[4].Reason);
        Assert.DoesNotContain(r.Unavailable, u => u.PersonId == 5);   // tenant isolation

        var crew = Assert.Single(r.Crews);
        Assert.Equal(new[] { 1, 3 }, crew.MemberIds.OrderBy(x => x));
        await ctx.DisposeAsync();
    }

    [Fact]
    public async Task Envelope_has_date_zone_and_can_edit()
    {
        var (ctx, svc) = await ArrangeAsync();
        var r = await svc.GetAsync(Co, Day, new LineupAccess("cu", false, true, new HashSet<int>()));
        Assert.Equal("2026-10-01", r.Date);
        Assert.Equal("America/New_York", r.TimeZone);
        Assert.False(r.CanEdit);
        await ctx.DisposeAsync();
    }
}
```
- [ ] **Step 2: Run to verify failure**

Run: `dotnet test --filter LineupQueryServiceTests` — Expected: build FAIL.

- [ ] **Step 3: Implement**

`DTOs/LineupDtos.cs`:
```csharp
using System;
using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    public record DefaultShiftDto(string Start, string End, int? AreaId);
    public record LineupShiftDto(int ShiftId, int PersonId, string Name, DateTime Start, DateTime End, string Status);
    public record LineupLocationDto(int LocationId, string Name, DefaultShiftDto? DefaultShift, List<LineupShiftDto> Shifts);
    public record LineupPersonDto(int PersonId, string Name, List<int> CrewIds);
    public record LineupUnavailableDto(int PersonId, string Name, string Reason);
    public record LineupCrewDto(int CrewId, string Name, List<int> MemberIds);
    public record LineupDto(
        string Date,
        string TimeZone,
        bool CanEdit,
        List<LineupLocationDto> Locations,
        List<LineupPersonDto> Bench,
        List<LineupUnavailableDto> Unavailable,
        List<LineupCrewDto> Crews);
}
```
`Services/LineupQueryService.cs`:
```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;

namespace ShiftWork.Api.Services
{
    public interface ILineupQueryService
    {
        Task<LineupDto> GetAsync(string companyId, DateOnly date, LineupAccess access);
    }

    public class LineupQueryService : ILineupQueryService
    {
        private readonly ShiftWorkContext _context;
        private readonly ICompanyTimeZoneService _timeZones;
        private readonly IAvailabilityService _availability;

        public LineupQueryService(ShiftWorkContext context, ICompanyTimeZoneService timeZones, IAvailabilityService availability)
        {
            _context = context;
            _timeZones = timeZones;
            _availability = availability;
        }

        public async Task<LineupDto> GetAsync(string companyId, DateOnly date, LineupAccess access)
        {
            var tz = await _timeZones.GetAsync(companyId);
            var (startUtc, endUtc) = LineupTime.DayWindowUtc(date, tz);

            var locations = (await _context.Locations.AsNoTracking()
                    .Where(l => l.CompanyId == companyId && l.Status == "Active")
                    .OrderBy(l => l.Name)
                    .ToListAsync())
                .Where(l => access.CanSeeLocation(l.LocationId))
                .ToList();
            var visibleIds = locations.Select(l => l.LocationId).ToList();

            var shifts = await _context.ScheduleShifts.AsNoTracking()
                .Where(s => s.CompanyId == companyId
                            && visibleIds.Contains(s.LocationId)
                            && s.Status.ToLower() != "void"
                            && s.StartDate < endUtc && s.EndDate > startUtc)
                .OrderBy(s => s.StartDate)
                .ToListAsync();

            var shiftPersonIds = shifts.Select(s => s.PersonId).Distinct().ToList();
            var names = await _context.Persons.AsNoTracking()
                .Where(p => p.CompanyId == companyId && shiftPersonIds.Contains(p.PersonId))
                .ToDictionaryAsync(p => p.PersonId, p => p.Name);

            var avail = await _availability.GetForWindowAsync(companyId, startUtc, endUtc, tz);
            var onCard = shiftPersonIds.ToHashSet();

            var crewRows = await _context.Crews.AsNoTracking()
                .Where(c => c.CompanyId == companyId)
                .OrderBy(c => c.Name)
                .ToListAsync();
            var crewIds = crewRows.Select(c => c.CrewId).ToList();
            var links = await _context.PersonCrews.AsNoTracking()
                .Where(pc => crewIds.Contains(pc.CrewId))
                .ToListAsync();

            var locationDtos = locations.Select(l => new LineupLocationDto(
                l.LocationId,
                l.Name,
                ToDto(LocationDefaultShift.TryParse(l.Settings)),
                shifts.Where(s => s.LocationId == l.LocationId)
                      .Select(s => new LineupShiftDto(s.ScheduleShiftId, s.PersonId,
                          names.TryGetValue(s.PersonId, out var n) ? n : "Unknown", s.StartDate, s.EndDate, s.Status))
                      .ToList())).ToList();

            var bench = avail.Available
                .Select(p => new LineupPersonDto(p.PersonId, p.Name,
                    links.Where(x => x.PersonId == p.PersonId).Select(x => x.CrewId).ToList()))
                .ToList();

            var unavailable = avail.Unavailable
                .Where(u => !onCard.Contains(u.Person.PersonId))
                .Select(u => new LineupUnavailableDto(u.Person.PersonId, u.Person.Name,
                    u.Reason == UnavailableReason.TimeOff ? "Time off" : "Assigned to another site"))
                .ToList();

            var known = bench.Select(b => b.PersonId).Concat(avail.Unavailable.Select(u => u.Person.PersonId)).ToHashSet();
            var crews = crewRows.Select(c => new LineupCrewDto(c.CrewId, c.Name,
                links.Where(x => x.CrewId == c.CrewId && known.Contains(x.PersonId)).Select(x => x.PersonId).ToList())).ToList();

            return new LineupDto(date.ToString("yyyy-MM-dd"), tz.Id, access.CanEdit, locationDtos, bench, unavailable, crews);
        }

        private static DefaultShiftDto? ToDto(LocationDefaultShift? d) =>
            d == null ? null : new DefaultShiftDto(d.Start.ToString("HH:mm"), d.End.ToString("HH:mm"), d.AreaId);
    }
}
```
Register in `Program.cs`: `builder.Services.AddScoped<ILineupQueryService, LineupQueryService>();`

- [ ] **Step 4: Run tests — expect PASS**

Run: `dotnet test --filter LineupQueryServiceTests`

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Api ShiftWork.Api.Tests
git commit -m "feat(lineup): lineup query service and DTOs"
```

---
### Task 5: The commit service

**Files:**
- Create: `ShiftWork.Api/DTOs/LineupCommitDtos.cs`
- Create: `ShiftWork.Api/Services/LineupCommitService.cs`
- Test: `ShiftWork.Api.Tests/Lineup/LineupCommitServiceTests.cs`
- Modify: `ShiftWork.Api/Program.cs` (DI)

**Interfaces:**
- Consumes: `LineupAccess`, `LineupTime`, `LocationDefaultShift`, `ICompanyTimeZoneService`; existing `IScheduleShiftService.Add/Delete`, `IScheduleValidationService.ValidateScheduleShift(string companyId, ScheduleShift shift, int personId, int? ignoreScheduleShiftId = null)` returning `ValidationResult { List<string> Errors, List<string> Warnings }`, `ICompanySettingsService.GetOrCreateSettings(string)`, `PushNotificationService.NotifyShiftAssignedAsync(string companyId, int personId, int shiftId, DateTime startDate)`.
- Produces:
  - `record LineupAssignmentDto(int PersonId, int LocationId, int? AreaId, string? Start, string? End, bool AcceptWarnings)`
  - `record LineupCommitRequest(string Date, List<LineupAssignmentDto>? Assignments, List<int>? Removals)`
  - `class LineupCommitResultDto { string Status; int? PersonId; int? LocationId; int? ShiftId; List<string> Errors; List<string> Warnings }` with statuses `created | unchanged | needs-confirmation | rejected | removed`
  - `record LineupCommitResponse(List<LineupCommitResultDto> Results)`
  - `interface ILineupCommitService { Task<LineupCommitResponse> CommitAsync(string companyId, DateOnly date, LineupCommitRequest request, LineupAccess access); }`

Rules (spec §7 with amendment C): removals are processed first, then assignments, each independently (partial success). Assignment order of checks: known active site in company → in scope → active person in company → resolve times/area (request value, else the site's default shift, else first area at the site) → idempotency (same person, site, start, end, non-void → `unchanged`) → validate (errors → `rejected`; warnings without `acceptWarnings` → `needs-confirmation`) → reuse or create a single-day "lineup" `Schedule` → create the `ScheduleShift` → push if published. Default/explicit `HH:mm` times are read in the **site's** time zone on the request date. Removal targets that are missing, in another company, or out of scope all answer "Shift not found" (no existence leak); shifts starting at or before now answer "Only future shifts can be removed".

- [ ] **Step 1: Write the failing tests**

`LineupCommitServiceTests.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using ShiftWork.Api.Tests.TestHelpers;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

internal static class CommitTestFactory
{
    public static readonly DateTimeOffset Now = new(2026, 9, 29, 12, 0, 0, TimeSpan.Zero);

    public static LineupCommitService Create(ShiftWorkContext ctx)
    {
        var settings = new CompanySettingsService(ctx);
        return new LineupCommitService(
            ctx,
            new CompanyTimeZoneService(ctx),
            new ScheduleShiftService(ctx, NullLogger<ScheduleShiftService>.Instance),
            new ScheduleValidationService(ctx, settings),
            settings,
            FakePush.Create(ctx),
            new FakeTimeProvider(Now),
            NullLogger<LineupCommitService>.Instance);
    }
}

public class LineupCommitServiceTests
{
    private const string Co = LineupTestData.CompanyId;
    private static readonly DateOnly Day = new(2026, 10, 1);
    private static DateTime U(int m, int d, int h, int min = 0) => new(2026, m, d, h, min, 0, DateTimeKind.Utc);

    private static LineupAccess Boss() => new("cu", true, true, new HashSet<int>());
    private static LineupAccess OnlySite7() => new("cu", true, false, new HashSet<int> { 7 });

    private static async Task<ShiftWorkContext> SeedAsync(bool autoApprove = false, decimal? maxWeekly = null)
    {
        var ctx = LineupTestData.NewContext();
        ctx.Companies.Add(LineupTestData.Company());
        ctx.Locations.AddRange(
            LineupTestData.Location(7, "Main St", settings: """{"defaultShift":{"start":"07:00","end":"15:30","areaId":12}}"""),
            LineupTestData.Location(8, "No Default"),
            LineupTestData.Location(9, "Second", settings: """{"defaultShift":{"start":"07:00","end":"15:30","areaId":14}}"""));
        ctx.Areas.AddRange(
            new Area { AreaId = 12, Name = "A12", CompanyId = Co, LocationId = 7 },
            new Area { AreaId = 13, Name = "A13", CompanyId = Co, LocationId = 8 },
            new Area { AreaId = 14, Name = "A14", CompanyId = Co, LocationId = 9 });
        ctx.Persons.AddRange(
            new Person { PersonId = 1, Name = "One", CompanyId = Co, Email = "1@x", Status = "Active" },
            new Person { PersonId = 2, Name = "Two", CompanyId = Co, Email = "2@x", Status = "Active" },
            new Person { PersonId = 3, Name = "Gone", CompanyId = Co, Email = "3@x", Status = "Inactive" },
            new Person { PersonId = 5, Name = "Foreign", CompanyId = "other-co", Email = "5@x", Status = "Active" });
        var settings = new CompanySettings { CompanyId = Co, AutoApproveShifts = autoApprove };
        if (maxWeekly.HasValue) settings.MaximumWeeklyHours = maxWeekly;
        ctx.CompanySettings.Add(settings);
        await ctx.SaveChangesAsync();
        return ctx;
    }

    private static LineupCommitRequest Assign(int person, int location, string? start = null, string? end = null,
        int? area = null, bool accept = false) =>
        new("2026-10-01", new() { new LineupAssignmentDto(person, location, area, start, end, accept) }, null);

    [Fact]
    public async Task Creates_shift_from_default_and_a_single_day_lineup_schedule()
    {
        await using var ctx = await SeedAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 7), Boss());

        var res = Assert.Single(r.Results);
        Assert.Equal("created", res.Status);
        var shift = await ctx.ScheduleShifts.SingleAsync();
        Assert.Equal(U(10, 1, 11), shift.StartDate);
        Assert.Equal(U(10, 1, 19, 30), shift.EndDate);
        Assert.Equal(12, shift.AreaId);
        Assert.Equal("unpublished", shift.Status);
        Assert.Equal(res.ShiftId, shift.ScheduleShiftId);
        var schedule = await ctx.Schedules.SingleAsync();
        Assert.Equal(schedule.ScheduleId, shift.ScheduleId);
        Assert.Equal("Lineup 2026-10-01", schedule.Name);
        Assert.Equal("lineup", schedule.Type);
        Assert.Equal("1", schedule.PersonId);
    }

    [Fact]
    public async Task Auto_approve_publishes()
    {
        await using var ctx = await SeedAsync(autoApprove: true);
        await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 7), Boss());
        Assert.Equal("Published", (await ctx.ScheduleShifts.SingleAsync()).Status);
    }

    [Fact]
    public async Task Explicit_times_and_area_override_the_default()
    {
        await using var ctx = await SeedAsync();
        await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 7, "08:00", "12:00", 12), Boss());
        var shift = await ctx.ScheduleShifts.SingleAsync();
        Assert.Equal(U(10, 1, 12), shift.StartDate);
        Assert.Equal(U(10, 1, 16), shift.EndDate);
    }

    [Fact]
    public async Task Repeating_the_same_assignment_is_unchanged_not_a_duplicate()
    {
        await using var ctx = await SeedAsync();
        var svc = CommitTestFactory.Create(ctx);
        var first = await svc.CommitAsync(Co, Day, Assign(1, 7), Boss());
        var second = await svc.CommitAsync(Co, Day, Assign(1, 7), Boss());
        Assert.Equal("unchanged", second.Results.Single().Status);
        Assert.Equal(first.Results.Single().ShiftId, second.Results.Single().ShiftId);
        Assert.Equal(1, await ctx.ScheduleShifts.CountAsync());
    }

    [Fact]
    public async Task Reuses_a_covering_schedule_instead_of_creating_one()
    {
        await using var ctx = await SeedAsync();
        ctx.Schedules.Add(new Schedule { ScheduleId = 900, Name = "Week", CompanyId = Co, PersonId = "1", LocationId = 7,
            StartDate = U(9, 28, 0), EndDate = U(10, 5, 0), Status = "Published" });
        await ctx.SaveChangesAsync();
        await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 7), Boss());
        Assert.Equal(900, (await ctx.ScheduleShifts.SingleAsync()).ScheduleId);
        Assert.Equal(1, await ctx.Schedules.CountAsync());
    }

    [Fact]
    public async Task No_default_and_no_times_is_rejected()
    {
        await using var ctx = await SeedAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 8), Boss());
        var res = r.Results.Single();
        Assert.Equal("rejected", res.Status);
        Assert.Contains("No shift time set for this location", res.Errors);
        Assert.Empty(ctx.ScheduleShifts);
    }

    [Fact]
    public async Task Out_of_scope_assignment_is_rejected_while_the_rest_proceed()
    {
        await using var ctx = await SeedAsync();
        var req = new LineupCommitRequest("2026-10-01", new()
        {
            new LineupAssignmentDto(1, 9, null, null, null, false),   // site 9 not in scope
            new LineupAssignmentDto(2, 7, null, null, null, false),
        }, null);
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, req, OnlySite7());
        Assert.Equal(new[] { "rejected", "created" }, r.Results.Select(x => x.Status));
        Assert.Equal(2, (await ctx.ScheduleShifts.SingleAsync()).PersonId);
    }

    [Theory]
    [InlineData(3)]   // inactive
    [InlineData(5)]   // other company
    [InlineData(99)]  // unknown
    public async Task Inactive_foreign_or_unknown_people_are_rejected(int personId)
    {
        await using var ctx = await SeedAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(personId, 7), Boss());
        Assert.Equal("rejected", r.Results.Single().Status);
        Assert.Empty(ctx.ScheduleShifts);
    }

    [Fact] // Review Focus 4
    public async Task Overlap_is_never_overridable_by_accept_warnings()
    {
        await using var ctx = await SeedAsync();
        ctx.ScheduleShifts.Add(new ScheduleShift { CompanyId = Co, PersonId = 2, LocationId = 9, AreaId = 14,
            StartDate = U(10, 1, 11), EndDate = U(10, 1, 19, 30), Status = "Published" });
        await ctx.SaveChangesAsync();

        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(2, 7, accept: true), Boss());
        var res = r.Results.Single();
        Assert.Equal("rejected", res.Status);
        Assert.NotEmpty(res.Errors);
        Assert.Equal(1, await ctx.ScheduleShifts.CountAsync());
    }

    [Fact]
    public async Task Warning_needs_confirmation_then_accept_warnings_creates()
    {
        await using var ctx = await SeedAsync(maxWeekly: 8m);   // 07:00-15:30 is 8.5h
        var svc = CommitTestFactory.Create(ctx);

        var first = (await svc.CommitAsync(Co, Day, Assign(1, 7), Boss())).Results.Single();
        Assert.Equal("needs-confirmation", first.Status);
        Assert.NotEmpty(first.Warnings);
        Assert.Empty(ctx.ScheduleShifts);

        var second = (await svc.CommitAsync(Co, Day, Assign(1, 7, accept: true), Boss())).Results.Single();
        Assert.Equal("created", second.Status);
        Assert.Equal(1, await ctx.ScheduleShifts.CountAsync());
    }

    [Fact] // Review Focus 3
    public async Task Moving_a_person_between_sites_in_one_commit_succeeds()
    {
        await using var ctx = await SeedAsync();
        ctx.ScheduleShifts.Add(new ScheduleShift { ScheduleShiftId = 601, CompanyId = Co, PersonId = 2, LocationId = 9, AreaId = 14,
            StartDate = U(10, 1, 11), EndDate = U(10, 1, 19, 30), Status = "Published" });
        await ctx.SaveChangesAsync();

        var req = new LineupCommitRequest("2026-10-01", new() { new LineupAssignmentDto(2, 7, null, null, null, false) }, new() { 601 });
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, req, Boss());

        Assert.Equal(new[] { "removed", "created" }, r.Results.Select(x => x.Status));
        var remaining = await ctx.ScheduleShifts.SingleAsync();
        Assert.Equal(7, remaining.LocationId);
    }

    [Fact]
    public async Task Past_or_started_shift_cannot_be_removed()
    {
        await using var ctx = await SeedAsync();
        ctx.ScheduleShifts.Add(new ScheduleShift { ScheduleShiftId = 602, CompanyId = Co, PersonId = 1, LocationId = 7, AreaId = 12,
            StartDate = U(9, 29, 8), EndDate = U(9, 29, 16), Status = "Published" });   // started 4h before "now"
        await ctx.SaveChangesAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, new("2026-10-01", null, new() { 602 }), Boss());
        Assert.Equal("rejected", r.Results.Single().Status);
        Assert.Equal(1, await ctx.ScheduleShifts.CountAsync());
    }

    [Fact]
    public async Task Removal_respects_scope_and_tenant()
    {
        await using var ctx = await SeedAsync();
        ctx.ScheduleShifts.AddRange(
            new ScheduleShift { ScheduleShiftId = 603, CompanyId = Co, PersonId = 1, LocationId = 9, AreaId = 14,
                StartDate = U(10, 1, 11), EndDate = U(10, 1, 19), Status = "Published" },
            new ScheduleShift { ScheduleShiftId = 604, CompanyId = "other-co", PersonId = 5, LocationId = 70, AreaId = 1,
                StartDate = U(10, 1, 11), EndDate = U(10, 1, 19), Status = "Published" });
        await ctx.SaveChangesAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, new("2026-10-01", null, new() { 603, 604, 9999 }), OnlySite7());
        Assert.All(r.Results, x => Assert.Equal("rejected", x.Status));
        Assert.Equal(2, await ctx.ScheduleShifts.CountAsync());
    }

    [Fact]
    public async Task Bad_time_text_is_rejected_not_thrown()
    {
        await using var ctx = await SeedAsync();
        var r = await CommitTestFactory.Create(ctx).CommitAsync(Co, Day, Assign(1, 7, "seven", "15:30"), Boss());
        Assert.Equal("rejected", r.Results.Single().Status);
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd ShiftWork.Api.Tests && dotnet test --filter LineupCommitServiceTests` — Expected: build FAIL.

- [ ] **Step 3: Implement**

`DTOs/LineupCommitDtos.cs`:
```csharp
using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    public record LineupAssignmentDto(int PersonId, int LocationId, int? AreaId, string? Start, string? End, bool AcceptWarnings);
    public record LineupCommitRequest(string Date, List<LineupAssignmentDto>? Assignments, List<int>? Removals);

    public class LineupCommitResultDto
    {
        public string Status { get; set; } = string.Empty;
        public int? PersonId { get; set; }
        public int? LocationId { get; set; }
        public int? ShiftId { get; set; }
        public List<string> Errors { get; set; } = new();
        public List<string> Warnings { get; set; } = new();
    }

    public record LineupCommitResponse(List<LineupCommitResultDto> Results);
}
```
`Services/LineupCommitService.cs`:
```csharp
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public interface ILineupCommitService
    {
        Task<LineupCommitResponse> CommitAsync(string companyId, DateOnly date, LineupCommitRequest request, LineupAccess access);
    }

    public class LineupCommitService : ILineupCommitService
    {
        private readonly ShiftWorkContext _context;
        private readonly ICompanyTimeZoneService _timeZones;
        private readonly IScheduleShiftService _shifts;
        private readonly IScheduleValidationService _validation;
        private readonly ICompanySettingsService _settings;
        private readonly PushNotificationService _push;
        private readonly TimeProvider _time;
        private readonly ILogger<LineupCommitService> _logger;

        public LineupCommitService(
            ShiftWorkContext context,
            ICompanyTimeZoneService timeZones,
            IScheduleShiftService shifts,
            IScheduleValidationService validation,
            ICompanySettingsService settings,
            PushNotificationService push,
            TimeProvider time,
            ILogger<LineupCommitService> logger)
        {
            _context = context;
            _timeZones = timeZones;
            _shifts = shifts;
            _validation = validation;
            _settings = settings;
            _push = push;
            _time = time;
            _logger = logger;
        }

        public async Task<LineupCommitResponse> CommitAsync(string companyId, DateOnly date, LineupCommitRequest request, LineupAccess access)
        {
            var results = new List<LineupCommitResultDto>();
            var now = _time.GetUtcNow().UtcDateTime;
            var companyTz = await _timeZones.GetAsync(companyId);
            var settings = await _settings.GetOrCreateSettings(companyId);
            var status = settings.AutoApproveShifts ? "Published" : "unpublished";

            foreach (var shiftId in request.Removals ?? new List<int>())
            {
                try { results.Add(await RemoveAsync(companyId, shiftId, access, now)); }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lineup removal of shift {ShiftId} failed for company {CompanyId}.", shiftId, companyId);
                    results.Add(Rejected(shiftId: shiftId, error: "Could not remove this shift."));
                }
            }

            foreach (var a in request.Assignments ?? new List<LineupAssignmentDto>())
            {
                try { results.Add(await AssignAsync(companyId, date, a, access, status, companyTz)); }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lineup assignment of person {PersonId} failed for company {CompanyId}.", a.PersonId, companyId);
                    results.Add(Rejected(a.PersonId, a.LocationId, error: "Could not assign this person."));
                }
            }
            return new LineupCommitResponse(results);
        }

        private async Task<LineupCommitResultDto> RemoveAsync(string companyId, int shiftId, LineupAccess access, DateTime now)
        {
            var shift = await _context.ScheduleShifts.AsNoTracking()
                .FirstOrDefaultAsync(s => s.ScheduleShiftId == shiftId && s.CompanyId == companyId);
            // Same answer for missing, foreign and out-of-scope so ids can't be probed.
            if (shift == null || !access.CanSeeLocation(shift.LocationId))
                return Rejected(shiftId: shiftId, error: "Shift not found.");
            if (shift.StartDate <= now)
                return Rejected(shiftId: shiftId, error: "Only future shifts can be removed.");

            await _shifts.Delete(shiftId);
            return new LineupCommitResultDto { Status = "removed", ShiftId = shiftId, PersonId = shift.PersonId, LocationId = shift.LocationId };
        }

        private async Task<LineupCommitResultDto> AssignAsync(
            string companyId, DateOnly date, LineupAssignmentDto a, LineupAccess access, string status, TimeZoneInfo companyTz)
        {
            var location = await _context.Locations.AsNoTracking()
                .FirstOrDefaultAsync(l => l.LocationId == a.LocationId && l.CompanyId == companyId && l.Status == "Active");
            if (location == null) return Rejected(a.PersonId, a.LocationId, "Unknown job site.");
            if (!access.CanSeeLocation(a.LocationId)) return Rejected(a.PersonId, a.LocationId, "You can't edit this job site.");

            var person = await _context.Persons.AsNoTracking()
                .FirstOrDefaultAsync(p => p.PersonId == a.PersonId && p.CompanyId == companyId && p.Status == "Active");
            if (person == null) return Rejected(a.PersonId, a.LocationId, "Person not available.");

            var def = LocationDefaultShift.TryParse(location.Settings);
            TimeOnly start, end;
            if (a.Start != null || a.End != null)
            {
                if (!TryTime(a.Start, out start) || !TryTime(a.End, out end))
                    return Rejected(a.PersonId, a.LocationId, "Invalid shift time.");
            }
            else if (def != null) { start = def.Start; end = def.End; }
            else return Rejected(a.PersonId, a.LocationId, "No shift time set for this location");

            var areaId = a.AreaId ?? def?.AreaId;
            if (areaId.HasValue)
            {
                var ok = await _context.Areas.AnyAsync(x => x.AreaId == areaId && x.LocationId == a.LocationId && x.CompanyId == companyId);
                if (!ok) return Rejected(a.PersonId, a.LocationId, "Unknown area.");
            }
            else
            {
                areaId = await _context.Areas.Where(x => x.LocationId == a.LocationId && x.CompanyId == companyId)
                    .OrderBy(x => x.AreaId).Select(x => (int?)x.AreaId).FirstOrDefaultAsync();
                if (!areaId.HasValue) return Rejected(a.PersonId, a.LocationId, "No area set for this location.");
            }

            var locationTz = LineupTime.Resolve(location.TimeZone);
            var (startUtc, endUtc) = LineupTime.ShiftWindowUtc(date, start, end, locationTz);

            var existing = await _context.ScheduleShifts.AsNoTracking().FirstOrDefaultAsync(s =>
                s.CompanyId == companyId && s.PersonId == a.PersonId && s.LocationId == a.LocationId
                && s.StartDate == startUtc && s.EndDate == endUtc && s.Status.ToLower() != "void");
            if (existing != null)
                return new LineupCommitResultDto { Status = "unchanged", PersonId = a.PersonId, LocationId = a.LocationId, ShiftId = existing.ScheduleShiftId };

            var candidate = new ScheduleShift
            {
                CompanyId = companyId, PersonId = a.PersonId, LocationId = a.LocationId, AreaId = areaId.Value,
                StartDate = startUtc, EndDate = endUtc, Status = status
            };
            var validation = await _validation.ValidateScheduleShift(companyId, candidate, a.PersonId);
            if (validation.Errors.Count > 0)
                return Rejected(a.PersonId, a.LocationId, validation.Errors.ToArray());
            if (validation.Warnings.Count > 0 && !a.AcceptWarnings)
                return new LineupCommitResultDto
                {
                    Status = "needs-confirmation", PersonId = a.PersonId, LocationId = a.LocationId,
                    Warnings = validation.Warnings.ToList()
                };

            var personKey = a.PersonId.ToString(CultureInfo.InvariantCulture);
            var schedule = await _context.Schedules.FirstOrDefaultAsync(s =>
                s.CompanyId == companyId && s.PersonId == personKey && s.LocationId == a.LocationId
                && s.Status.ToLower() != "void" && s.StartDate <= startUtc && s.EndDate >= endUtc);
            if (schedule == null)
            {
                schedule = new Schedule
                {
                    Name = $"Lineup {date:yyyy-MM-dd}", CompanyId = companyId, PersonId = personKey,
                    LocationId = a.LocationId, AreaId = areaId, StartDate = startUtc, EndDate = endUtc,
                    Status = status, Type = "lineup", TimeZone = companyTz.Id,
                    CreatedBy = access.CompanyUserId, CreatedAt = _time.GetUtcNow().UtcDateTime
                };
                _context.Schedules.Add(schedule);
                await _context.SaveChangesAsync();
            }

            candidate.ScheduleId = schedule.ScheduleId;
            candidate.CreatedBy = access.CompanyUserId;
            candidate.CreatedAt = _time.GetUtcNow().UtcDateTime;
            var created = await _shifts.Add(candidate);

            if (status == "Published")
            {
                try { await _push.NotifyShiftAssignedAsync(companyId, a.PersonId, created.ScheduleShiftId, created.StartDate); }
                catch (Exception ex) { _logger.LogWarning(ex, "Push for lineup shift {ShiftId} failed.", created.ScheduleShiftId); }
            }

            return new LineupCommitResultDto { Status = "created", PersonId = a.PersonId, LocationId = a.LocationId, ShiftId = created.ScheduleShiftId };
        }

        private static bool TryTime(string? text, out TimeOnly time)
        {
            time = default;
            return text != null && TimeOnly.TryParseExact(text, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out time);
        }

        private static LineupCommitResultDto Rejected(int? personId = null, int? locationId = null, string? error = null, int? shiftId = null) =>
            Rejected(personId, locationId, error == null ? Array.Empty<string>() : new[] { error }, shiftId);

        private static LineupCommitResultDto Rejected(int? personId, int? locationId, string[] errors, int? shiftId = null) =>
            new() { Status = "rejected", PersonId = personId, LocationId = locationId, ShiftId = shiftId, Errors = errors.ToList() };
    }
}
```
The two `Rejected` overloads collide on some call shapes; if the compiler complains about ambiguity, rename the array one `RejectedMany`. Register in `Program.cs`: `builder.Services.AddScoped<ILineupCommitService, LineupCommitService>();`

- [ ] **Step 4: Run tests — expect PASS**

Run: `dotnet test --filter LineupCommitServiceTests`
If `ValidateScheduleShift` needs fields the candidate lacks (for example a non-zero `ScheduleId`), pass what it needs rather than loosening the tests, and tell the reviewer what changed.

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Api ShiftWork.Api.Tests
git commit -m "feat(lineup): commit service with partial success and warning confirmation"
```

---

### Task 6: The controller

**Files:**
- Create: `ShiftWork.Api/Controllers/LineupController.cs`
- Test: `ShiftWork.Api.Tests/Lineup/LineupControllerTests.cs`

**Interfaces:**
- Consumes: `ILineupAccessService.ResolveAsync`, `ILineupQueryService.GetAsync`, `ILineupCommitService.CommitAsync`, DTOs from Tasks 4–5.
- Produces: routes `GET api/companies/{companyId}/lineup?date=yyyy-MM-dd` (policy `lineup.view`) and `POST api/companies/{companyId}/lineup/commit` (policy `lineup.edit`). `400` on a missing/invalid date, `403` when the caller has no access record or (for commit) `CanEdit` is false.

Check the base route used by sibling controllers first (`grep -n "\[Route" ShiftWork.Api/Controllers/CrewsController.cs`) and copy its pattern exactly.

- [ ] **Step 1: Write the failing tests**

`LineupControllerTests.cs`:
```csharp
using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class LineupControllerTests
{
    private const string Co = LineupTestData.CompanyId;

    private static LineupController Build(LineupAccess? access, out Mock<ILineupQueryService> query, out Mock<ILineupCommitService> commit)
    {
        var accessSvc = new Mock<ILineupAccessService>();
        accessSvc.Setup(a => a.ResolveAsync(It.IsAny<ClaimsPrincipal>(), Co)).ReturnsAsync(access);
        query = new Mock<ILineupQueryService>();
        commit = new Mock<ILineupCommitService>();
        var c = new LineupController(accessSvc.Object, query.Object, commit.Object, NullLogger<LineupController>.Instance);
        c.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        return c;
    }

    private static LineupAccess Edit() => new("cu", true, true, new HashSet<int>());
    private static LineupAccess ViewOnly() => new("cu", false, true, new HashSet<int>());

    [Fact]
    public void Routes_are_guarded_by_the_lineup_policies()
    {
        string Policy(string method) =>
            typeof(LineupController).GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>()!.Policy!;
        Assert.Equal("lineup.view", Policy(nameof(LineupController.Get)));
        Assert.Equal("lineup.edit", Policy(nameof(LineupController.Commit)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("10/01/2026")]
    [InlineData("2026-13-45")]
    public async Task Get_rejects_missing_or_bad_date(string? date)
    {
        var c = Build(Edit(), out _, out _);
        Assert.IsType<BadRequestObjectResult>(await c.Get(Co, date));
    }

    [Fact]
    public async Task Get_is_forbidden_without_an_access_record()
    {
        var c = Build(null, out _, out _);
        Assert.IsType<ForbidResult>(await c.Get(Co, "2026-10-01"));
    }

    [Fact]
    public async Task Get_returns_the_lineup()
    {
        var c = Build(Edit(), out var query, out _);
        var dto = new LineupDto("2026-10-01", "UTC", true, new(), new(), new(), new());
        query.Setup(q => q.GetAsync(Co, new DateOnly(2026, 10, 1), It.IsAny<LineupAccess>())).ReturnsAsync(dto);
        var ok = Assert.IsType<OkObjectResult>(await c.Get(Co, "2026-10-01"));
        Assert.Same(dto, ok.Value);
    }

    [Fact]
    public async Task Commit_is_forbidden_for_view_only_users()
    {
        var c = Build(ViewOnly(), out _, out var commit);
        var result = await c.Commit(Co, new LineupCommitRequest("2026-10-01", new(), new()));
        Assert.IsType<ForbidResult>(result);
        commit.Verify(x => x.CommitAsync(It.IsAny<string>(), It.IsAny<DateOnly>(), It.IsAny<LineupCommitRequest>(), It.IsAny<LineupAccess>()), Times.Never);
    }

    [Fact]
    public async Task Commit_rejects_bad_date_and_delegates_otherwise()
    {
        var c = Build(Edit(), out _, out var commit);
        Assert.IsType<BadRequestObjectResult>(await c.Commit(Co, new LineupCommitRequest("nope", null, null)));

        var response = new LineupCommitResponse(new());
        commit.Setup(x => x.CommitAsync(Co, new DateOnly(2026, 10, 1), It.IsAny<LineupCommitRequest>(), It.IsAny<LineupAccess>()))
              .ReturnsAsync(response);
        var ok = Assert.IsType<OkObjectResult>(await c.Commit(Co, new LineupCommitRequest("2026-10-01", null, null)));
        Assert.Same(response, ok.Value);
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `dotnet test --filter LineupControllerTests` — Expected: build FAIL.

- [ ] **Step 3: Implement**

`Controllers/LineupController.cs`:
```csharp
using System;
using System.Globalization;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/lineup")]
    public class LineupController : ControllerBase
    {
        private readonly ILineupAccessService _access;
        private readonly ILineupQueryService _query;
        private readonly ILineupCommitService _commit;
        private readonly ILogger<LineupController> _logger;

        public LineupController(ILineupAccessService access, ILineupQueryService query, ILineupCommitService commit, ILogger<LineupController> logger)
        {
            _access = access;
            _query = query;
            _commit = commit;
            _logger = logger;
        }

        [HttpGet]
        [Authorize(Policy = "lineup.view")]
        [ProducesResponseType(typeof(LineupDto), 200)]
        public async Task<IActionResult> Get(string companyId, [FromQuery] string? date)
        {
            if (!TryDate(date, out var day)) return BadRequest("date must be YYYY-MM-DD.");
            var access = await _access.ResolveAsync(User, companyId);
            if (access == null) return Forbid();
            return Ok(await _query.GetAsync(companyId, day, access));
        }

        [HttpPost("commit")]
        [Authorize(Policy = "lineup.edit")]
        [ProducesResponseType(typeof(LineupCommitResponse), 200)]
        public async Task<IActionResult> Commit(string companyId, [FromBody] LineupCommitRequest request)
        {
            if (!TryDate(request?.Date, out var day)) return BadRequest("date must be YYYY-MM-DD.");
            var access = await _access.ResolveAsync(User, companyId);
            if (access == null || !access.CanEdit) return Forbid();
            return Ok(await _commit.CommitAsync(companyId, day, request!, access));
        }

        private static bool TryDate(string? text, out DateOnly date) =>
            DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
    }
}
```
- [ ] **Step 4: Run tests — expect PASS**

Run: `dotnet test --filter LineupControllerTests`

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Api ShiftWork.Api.Tests
git commit -m "feat(lineup): lineup controller"
```

---

### Task 7: Gate and consolidate replacement-candidates

**Files:**
- Modify: `ShiftWork.Api/Services/ScheduleShiftService.cs` (constructor and `GetReplacementCandidatesByWindow`)
- Modify: `ShiftWork.Api/Controllers/ScheduleShiftsController.cs` (both replacement-candidates actions)
- Modify: `ShiftWork.Api.Tests/Lineup/LineupCommitServiceTests.cs` (`CommitTestFactory.Create`, the `ScheduleShiftService` constructor call)
- Test: `ShiftWork.Api.Tests/Lineup/ReplacementCandidatesTests.cs`

**Interfaces:**
- Consumes: `IAvailabilityService.GetForWindowAsync` and `ICompanyTimeZoneService.GetAsync` (Task 2).
- Produces: `ScheduleShiftService(ShiftWorkContext, ILogger<ScheduleShiftService>, IAvailabilityService, ICompanyTimeZoneService)`. `GetReplacementCandidatesByWindow` keeps its signature. **Behaviour change (release-note it):** inactive people are now excluded and approved `TimeOffRequests` are honoured. `locationId`/`areaId` arguments remain accepted and unused, exactly as today (verify by reading the current body first; if it does use them, keep that filtering).

Read the current `GetReplacementCandidatesByWindow` and `GetReplacementCandidatesForShift` bodies before editing. Only the window method is rewritten; `GetReplacementCandidatesForShift` should already delegate to it (if it does not, make it call the window method with the shift's start/end and `PersonId`).

- [ ] **Step 1: Write the failing tests**

`ReplacementCandidatesTests.cs`:
```csharp
using Microsoft.Extensions.Logging.Abstractions;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class ReplacementCandidatesTests
{
    private const string Co = LineupTestData.CompanyId;
    private static DateTime U(int d, int h) => new(2026, 10, d, h, 0, 0, DateTimeKind.Utc);

    private static ScheduleShiftService Build(ShiftWork.Api.Data.ShiftWorkContext ctx) =>
        new(ctx, NullLogger<ScheduleShiftService>.Instance, new AvailabilityService(ctx), new CompanyTimeZoneService(ctx));

    [Fact]
    public async Task Excludes_busy_inactive_time_off_and_the_excluded_person()
    {
        await using var ctx = LineupTestData.NewContext();
        ctx.Companies.Add(LineupTestData.Company());
        ctx.Persons.AddRange(
            new Person { PersonId = 1, Name = "Free", CompanyId = Co, Email = "1@x", Status = "Active" },
            new Person { PersonId = 2, Name = "Busy", CompanyId = Co, Email = "2@x", Status = "Active" },
            new Person { PersonId = 3, Name = "Inactive", CompanyId = Co, Email = "3@x", Status = "Inactive" },
            new Person { PersonId = 4, Name = "Off", CompanyId = Co, Email = "4@x", Status = "Active" },
            new Person { PersonId = 6, Name = "Requester", CompanyId = Co, Email = "6@x", Status = "Active" });
        ctx.ScheduleShifts.Add(new ScheduleShift { CompanyId = Co, PersonId = 2, LocationId = 7, AreaId = 1, StartDate = U(1, 12), EndDate = U(1, 20), Status = "Published" });
        ctx.TimeOffRequests.Add(new TimeOffRequest { CompanyId = Co, PersonId = 4, Status = "Approved", StartDate = new DateTime(2026, 10, 1), EndDate = new DateTime(2026, 10, 1) });
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).GetReplacementCandidatesByWindow(Co, U(1, 12), U(1, 20), 7, 1, excludePersonId: 6);
        Assert.Equal(new[] { 1 }, result.Select(p => p.PersonId));
    }

    [Fact]
    public void Both_replacement_candidate_routes_require_schedule_shifts_read()
    {
        var methods = typeof(ShiftWork.Api.Controllers.ScheduleShiftsController).GetMethods()
            .Where(m => m.Name is "GetReplacementCandidatesForShift" or "GetReplacementCandidatesByWindow").ToList();
        Assert.Equal(2, methods.Count);
        foreach (var m in methods)
        {
            var attr = m.GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute), true)
                .Cast<Microsoft.AspNetCore.Authorization.AuthorizeAttribute>().SingleOrDefault();
            Assert.Equal("schedule-shifts.read", attr?.Policy);
        }
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `dotnet test --filter ReplacementCandidatesTests` — Expected: build FAIL (constructor arity).

- [ ] **Step 3: Implement**

`ScheduleShiftService.cs`: add `private readonly IAvailabilityService _availability;` and `private readonly ICompanyTimeZoneService _timeZones;`, extend the constructor to `(ShiftWorkContext context, ILogger<ScheduleShiftService> logger, IAvailabilityService availability, ICompanyTimeZoneService timeZones)` assigning both, and replace the body of `GetReplacementCandidatesByWindow` with:
```csharp
var tz = await _timeZones.GetAsync(companyId);
var result = await _availability.GetForWindowAsync(companyId, startUtc, endUtc, tz);
return result.Available.Where(p => !excludePersonId.HasValue || p.PersonId != excludePersonId.Value).ToList();
```
`ScheduleShiftsController.cs`: add `[Authorize(Policy = "schedule-shifts.read")]` above both replacement-candidates actions (`Microsoft.AspNetCore.Authorization` is already imported there).
`LineupCommitServiceTests.cs`: change the `new ScheduleShiftService(ctx, NullLogger<ScheduleShiftService>.Instance)` call inside `CommitTestFactory.Create` to `new ScheduleShiftService(ctx, NullLogger<ScheduleShiftService>.Instance, new AvailabilityService(ctx), new CompanyTimeZoneService(ctx))`.
Search for other constructions: `grep -rn "new ScheduleShiftService(" ShiftWork.Api ShiftWork.Api.Tests` and update each.

- [ ] **Step 4: Run the whole suite**

Run: `cd ShiftWork.Api.Tests && dotnet test`
Expected: everything PASS, including pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Api ShiftWork.Api.Tests
git commit -m "fix(schedule-shifts): gate replacement-candidates and use shared availability"
```

---

### Task 8: Final verification

**Files:** none changed unless a check fails.

- [ ] **Step 1: Build and test everything**

Run: `dotnet build ShiftWork.Api && dotnet test ShiftWork.Api.Tests`
Expected: 0 errors; all tests pass.

- [ ] **Step 2: Confirm registration**

Run: `grep -n 'AddPolicy("lineup' ShiftWork.Api/Program.cs`
Expected: exactly three lines (`lineup.view`, `lineup.edit`, `lineup.all-locations`).
Run: `grep -n "Lineup\|Availability\|CompanyTimeZone" ShiftWork.Api/Program.cs`
Expected: `ICompanyTimeZoneService`, `IAvailabilityService`, `ILineupAccessService`, `ILineupQueryService`, `ILineupCommitService` all registered.

- [ ] **Step 3: Confirm the migration is clean**

Open `ShiftWork.Api/Migrations/*_AddLineupLocationScope.cs`; it must create only `UserLocationScopes` and its unique index. Run `dotnet ef migrations has-pending-model-changes` (or `dotnet ef migrations add Probe` then delete it) and confirm the model snapshot has no other drift.

- [ ] **Step 4: Smoke the endpoints against a dev database**

With the API running and a user holding `lineup.view`/`lineup.edit`:
```bash
curl -H "Authorization: Bearer $TOKEN" "$API/api/companies/$CO/lineup?date=2026-10-01"
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"date":"2026-10-01","assignments":[{"personId":41,"locationId":7}],"removals":[]}' \
  "$API/api/companies/$CO/lineup/commit"
```
Expected: 200 with the shapes in spec §6; a user with neither permission gets 403.

- [ ] **Step 5: Record release notes**

Note for release: replacement-candidates now requires `schedule-shifts.read`, excludes inactive people, and honours approved time off. Existing roles other than Admin will not have the three new lineup permissions until an admin grants them.
