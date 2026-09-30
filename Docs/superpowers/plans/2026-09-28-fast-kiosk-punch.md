# Fast Kiosk Punch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut kiosk clock-in to about 2–3 seconds at sites that don't need a PIN or photo, add per-Location PIN/photo switches and a per-employee photo exemption, and make punches survive a lost connection.

**Architecture:** Two settings on `Location` (`RequirePin`, `RequirePhoto`) and one on `Person` (`PhotoExempt`) reach the kiosk through a new `GET /api/kiosk/{companyId}/config` endpoint and an extra field on the employee list. The kiosk decides its screens with one pure function (`nextStep`), auto-picks In/Out from the employee's status, and records every punch into a persistent local outbox that a background worker sends, with a client-generated event id so retries never duplicate.

**Tech Stack:** ASP.NET Core (net9.0) + EF Core + xUnit/Moq/InMemory; Angular (admin); Expo 54 / React Native 0.81 / TypeScript / Zustand / React Query / Jest (`jest-expo`) for the kiosk.

**Spec:** `Docs/superpowers/specs/2026-09-28-fast-kiosk-punch-design.md` (read it first; this plan implements it).

## Global Constraints

- New settings default to today's behavior: `Location.RequirePin = true`, `Location.RequirePhoto = true`, `Person.PhotoExempt = false`. **Existing rows must migrate to `true`/`true`/`false`.**
- Config endpoint: `GET /api/kiosk/{companyId}/config?locationId=` returns `{ requirePin, requirePhoto, questionsOnClockOutOnly: true }`.
- `POST /api/kiosk/{companyId}/clock` accepts client `eventLogId` (GUID) and `eventDate`; a repeated `eventLogId` returns the original result and creates no second event; `eventDate` may be at most 7 days in the past and not in the future.
- Photo needed = Location `RequirePhoto` is on **and** the employee is not `PhotoExempt`. PIN is a site-level decision only.
- Kiosk questions appear only on a **clock-out** with active questions.
- Undo window is 3 seconds. Outbox cap is 200 punches or 24 hours; nothing is dropped silently.
- Code, folders and namespaces keep the `ShiftWork.*` names. Kiosk imports use the `@/` alias.
- Every new kiosk string is added to **both** `ShiftWork.Kiosk/i18n/translations/en.ts` and `es.ts`.
- API tests use xUnit + Moq + `UseInMemoryDatabase` (see `ShiftWork.Api.Tests/Kiosk/KioskServiceGeofenceTests.cs`). Kiosk tests use Jest, files under `__tests__/` next to the code (see `services/__tests__/interstitial.service.test.ts`).
- Work on branch `feature/kiosk-fast-punch`. Commit after each task; end each commit message with the attribution footer your session requires.

## Decisions this plan made that the spec left open (confirm or change)

- **D1. PIN sites need a connection for the PIN check.** The PIN is still verified online with the existing `verify-pin` call (a wrong PIN must be shown immediately). Full offline punching therefore works at sites where the PIN is **off**. At PIN sites the verified PIN also travels with the punch and is held in the tablet's local outbox (unencrypted app storage) until sent, so the server can enforce it (D2).
- **D2. Server PIN enforcement is behind a setting, default off.** `KioskSettings:EnforcePinOnClock` (default `false`). Tablets on the old build do not send a PIN, so turning enforcement on before they are updated would reject every punch. Turn it on after all tablets run the new build.
- **D3. Clock-skew tolerance.** `eventDate` up to 5 minutes in the future is accepted, because tablet clocks drift. Anything later is rejected.
- **D4. Undo is a send delay.** The outbox holds each punch for 3 seconds before sending, so a punch reaches the server at least 3 seconds after the tap. Undo removes it locally; there is no "void punch" API.
- **D5. Post-clock-out interstitial is skipped when the kiosk looks offline** (any unsent punch has already failed once), so an offline clock-out never waits on a network timeout.
- **D6. The employee list and the kiosk questions are held in memory** for the running session. A tablet that restarts with no connection shows "Could not load employees" (with Retry) until the first successful fetch. The site config *is* cached on the device (strict until known), and so is the outbox.
- **D7. The photo upload endpoint is anonymous** (like `/clock`), with type, size and magic-byte checks and a company-exists check.
- **D8. "Flagged" photo failures.** When a photo cannot be uploaded the punch is still sent without one. The spec says this punch is "flagged"; the plan does not add a separate flag. A punch with no `PhotoUrl` at a site that requires photos is already visible to managers, and no separate flag is stored. Say so if you want one.

## Review Focus

Inputs the spec implies but no single task's happy path exercises. Each has a test in the task named in brackets.

1. **Existing sites must stay strict after the migration.** A Location that existed before this change must still require PIN and photo; a wrong column default would silently turn both off everywhere. [Task 1]
2. **Double tap on a name card.** Two quick taps must produce one punch, not an In followed by an Out. [Task 8]
3. **PIN site with no internet.** The PIN screen must fail fast with a clear message, not spin for 15 seconds. [Task 6]
4. **Tablet clock is wrong.** A punch with a far-future or 8-day-old `eventDate` is rejected with 400 and shows up as `failed` in the outbox instead of being retried forever or silently accepted. [Tasks 3, 6]
5. **A retry after a lost response.** The server saved the punch but the tablet never heard back; the resend must return the original event, and a reused id from a different person or company must be refused. [Task 3]

## File Structure

**API (`ShiftWork.Api`)**
- Modify `Models/Location.cs`, `Models/Person.cs`: new flags.
- Modify `DTOs/LocationDto.cs`, `DTOs/PersonDto.cs`, `DTOs/KioskDtos.cs`: expose flags; `KioskConfigDto`; `PhotoExempt` on `KioskEmployeeDto`; new fields on `KioskClockRequest`.
- Modify `Services/LocationService.cs`, `Services/PeopleService.cs`: persist flags on update.
- Modify `Services/IKioskService.cs`, `Services/KioskService.cs`: config, employees, idempotent/validated clock.
- Create `Services/KioskPunchRejectedException.cs`: status-carrying exception.
- Modify `Controllers/KioskController.cs`: config endpoint, exception mapping.
- Create `Controllers/KioskPhotosController.cs`: anonymous photo upload.
- Create `Migrations/<timestamp>_AddKioskPunchSettings.cs` (generated, then hand-edited defaults).
- Modify `appsettings.json`: two keys under `KioskSettings`.
- Tests in `ShiftWork.Api.Tests/Kiosk/`: `KioskSettingsPersistenceTests.cs`, `KioskServiceSettingsTests.cs`, `KioskServiceClockTests.cs`, `KioskPhotosControllerTests.cs`; extend `KioskControllerTests.cs`.

**Angular admin (`ShiftWork.Angular`)**
- Modify `core/models/location.model.ts`, `core/models/people.model.ts`, `features/dashboard/locations/locations.component.{ts,html}`, `features/dashboard/people/people.component.{ts,html}`.

**Kiosk (`ShiftWork.Kiosk`)**
- Modify `types/index.ts`, `services/kiosk.service.ts`, `store/sessionStore.ts`, `i18n/translations/{en,es}.ts`, `app/_layout.tsx`, `app/(kiosk)/{index,pin,clock,questions,success}.tsx`, `app/(admin)/index.tsx`.
- Create `services/punchFlow.ts` (pure screen logic), `services/outbox.service.ts` (pure queue logic), `services/outbox.ts` (wiring, worker, hook), `services/punch.service.ts`, `services/geo.service.ts`, `store/configStore.ts`, `utils/localStore.ts`, `hooks/usePunchNavigator.ts`, `components/OutboxStatusCard.tsx`.
- Tests in `services/__tests__/` and `store/__tests__/`.

**Tooling note:** the sandbox that wrote this plan had no .NET SDK, so the C# in Tasks 1–4 has been written carefully but **not compiled**. Run each C# task's first test run on a machine with the .NET 9 SDK and fix any compile error before moving on. The kiosk logic in Task 6 (`punchFlow`, `outbox.service`) **was** run: 32 tests passed under Jest and `tsc --noEmit` was clean.

---

### Task 1: Data model, migration, and admin persistence

**Files:**
- Modify: `ShiftWork.Api/Models/Location.cs`, `ShiftWork.Api/Models/Person.cs`
- Modify: `ShiftWork.Api/DTOs/LocationDto.cs`, `ShiftWork.Api/DTOs/PersonDto.cs`
- Modify: `ShiftWork.Api/Services/LocationService.cs` (in `Update`, after `existingLocation.Status = location.Status;`), `ShiftWork.Api/Services/PeopleService.cs` (in `Update`, after `existingPerson.PreferredLanguage = person.PreferredLanguage;`)
- Create: `ShiftWork.Api/Migrations/<timestamp>_AddKioskPunchSettings.cs` (+ `.Designer.cs`, updated `ShiftWorkContextModelSnapshot.cs`)
- Test: `ShiftWork.Api.Tests/Kiosk/KioskSettingsPersistenceTests.cs`

**Interfaces:**
- Produces: `Location.RequirePin: bool`, `Location.RequirePhoto: bool`, `Person.PhotoExempt: bool` (also on `LocationDto` / `PersonDto`). Tasks 2, 3 and 5 read them.

- [ ] **Step 1: Write the failing test**

Create `ShiftWork.Api.Tests/Kiosk/KioskSettingsPersistenceTests.cs`:

```csharp
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `dotnet test ShiftWork.Api.Tests --filter KioskSettingsPersistenceTests`
Expected: build FAILS with "'Location' does not contain a definition for 'RequirePin'" (and the other two).

- [ ] **Step 3: Add the model fields**

In `ShiftWork.Api/Models/Location.cs`, add after the `public bool IsSandbox ...` line:

```csharp
        /// <summary>When false, kiosks at this site skip the PIN screen. Default true (today's behavior).</summary>
        public bool RequirePin { get; set; } = true;
        /// <summary>When false, kiosks at this site skip the camera. Default true (today's behavior).</summary>
        public bool RequirePhoto { get; set; } = true;
```

In `ShiftWork.Api/Models/Person.cs`, add after the `public bool IsSandbox ...` line (line ~49):

```csharp
        /// <summary>When true, this employee is never asked for a photo at a kiosk, at any site.</summary>
        public bool PhotoExempt { get; set; } = false;
```

In `ShiftWork.Api/DTOs/LocationDto.cs`, add after `public string Status { get; set; }`:

```csharp
        public bool RequirePin { get; set; } = true;
        public bool RequirePhoto { get; set; } = true;
```

In `ShiftWork.Api/DTOs/PersonDto.cs`, add inside the class (next to `Pin`):

```csharp
        public bool PhotoExempt { get; set; }
```

(AutoMapper's `Location`↔`LocationDto` and `Person`↔`PersonDto` maps in `Helpers/MappingProfiles.cs` pick these up by name; no profile change is needed.)

- [ ] **Step 4: Persist the flags on update**

In `LocationService.Update`, after `existingLocation.Status = location.Status;` add:

```csharp
            existingLocation.RequirePin = location.RequirePin;
            existingLocation.RequirePhoto = location.RequirePhoto;
```

In `PeopleService.Update`, after `existingPerson.PreferredLanguage = person.PreferredLanguage;` add:

```csharp
            existingPerson.PhotoExempt = person.PhotoExempt;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `dotnet test ShiftWork.Api.Tests --filter KioskSettingsPersistenceTests`
Expected: 4 tests PASS.

- [ ] **Step 6: Generate the migration**

Run: `dotnet ef migrations add AddKioskPunchSettings --project ShiftWork.Api`
Expected: creates `Migrations/<timestamp>_AddKioskPunchSettings.cs`, its `.Designer.cs`, and updates `ShiftWorkContextModelSnapshot.cs`.

- [ ] **Step 7: Fix the column defaults by hand (critical)**

EF writes `defaultValue: false` for every new non-null `bool` column. Open the generated migration and set the two **Location** columns to `defaultValue: true` so existing sites stay strict. `PhotoExempt` stays `false`. The `Up` method must read:

```csharp
            migrationBuilder.AddColumn<bool>(
                name: "RequirePhoto",
                table: "Locations",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequirePin",
                table: "Locations",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "PhotoExempt",
                table: "Persons",
                type: "bit",
                nullable: false,
                defaultValue: false);
```

Do **not** use `HasDefaultValue(true)` in the model: EF then treats `false` as "unset" and can never save `RequirePin = false`.

- [ ] **Step 8: Verify the defaults**

Run: `grep -n "defaultValue" ShiftWork.Api/Migrations/*_AddKioskPunchSettings.cs`
Expected: exactly three lines: `RequirePhoto` → `true`, `RequirePin` → `true`, `PhotoExempt` → `false` (check the column names above each).

- [ ] **Step 9: Run the whole API test project**

Run: `dotnet test ShiftWork.Api.Tests`
Expected: all tests PASS (nothing else reads these columns yet).

- [ ] **Step 10: Commit**

```bash
git add ShiftWork.Api ShiftWork.Api.Tests
git commit -m "feat(kiosk): add per-location PIN/photo flags and per-person photo exemption"
```

---

### Task 2: Config endpoint and employee `photoExempt`

**Files:**
- Modify: `ShiftWork.Api/DTOs/KioskDtos.cs`, `ShiftWork.Api/Services/IKioskService.cs`, `ShiftWork.Api/Services/KioskService.cs`, `ShiftWork.Api/Controllers/KioskController.cs`
- Test: `ShiftWork.Api.Tests/Kiosk/KioskServiceSettingsTests.cs` (create), `ShiftWork.Api.Tests/Kiosk/KioskControllerTests.cs` (extend)

**Interfaces:**
- Consumes: `Location.RequirePin`, `Location.RequirePhoto`, `Person.PhotoExempt` (Task 1).
- Produces: `IKioskService.GetKioskConfigAsync(string companyId, int locationId): Task<KioskConfigDto?>`; `KioskConfigDto { bool RequirePin, bool RequirePhoto, bool QuestionsOnClockOutOnly }`; `KioskEmployeeDto.PhotoExempt`. JSON (camelCase): `{ "requirePin": true, "requirePhoto": true, "questionsOnClockOutOnly": true }` and `photoExempt` on each employee. The kiosk (Task 6) consumes both.

- [ ] **Step 1: Write the failing service tests**

Create `ShiftWork.Api.Tests/Kiosk/KioskServiceSettingsTests.cs`:

```csharp
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test ShiftWork.Api.Tests --filter KioskServiceSettingsTests`
Expected: build FAILS ("'KioskService' does not contain a definition for 'GetKioskConfigAsync'").

- [ ] **Step 3: Add the DTOs**

In `ShiftWork.Api/DTOs/KioskDtos.cs`, add to `KioskEmployeeDto` (after `StatusShiftWork`):

```csharp
        /// <summary>True when this employee is never asked for a photo at a kiosk.</summary>
        public bool PhotoExempt { get; set; }
```

and add a new class after `KioskLocationDto`:

```csharp
    /// <summary>
    /// Per-site behavior switches a kiosk fetches at startup and on each refresh.
    /// </summary>
    public class KioskConfigDto
    {
        public bool RequirePin { get; set; } = true;
        public bool RequirePhoto { get; set; } = true;
        /// <summary>Kiosk questions are shown after a clock-out only.</summary>
        public bool QuestionsOnClockOutOnly { get; set; } = true;
    }
```

- [ ] **Step 4: Implement the service method**

In `IKioskService.cs`, add under the public section:

```csharp
        /// <summary>Returns the site's PIN/photo switches, or null when the location is not in the company.</summary>
        Task<KioskConfigDto?> GetKioskConfigAsync(string companyId, int locationId);
```

In `KioskService.cs`, add `PhotoExempt = p.PhotoExempt,` to the projection in `GetKioskEmployeesAsync` (after `StatusShiftWork = p.StatusShiftWork,`), and add this method below it:

```csharp
        public async Task<KioskConfigDto?> GetKioskConfigAsync(string companyId, int locationId)
        {
            var location = await _context.Locations
                .AsNoTracking()
                .FirstOrDefaultAsync(l => l.LocationId == locationId && l.CompanyId == companyId);
            if (location == null) return null;

            return new KioskConfigDto
            {
                RequirePin = location.RequirePin,
                RequirePhoto = location.RequirePhoto,
                QuestionsOnClockOutOnly = true,
            };
        }
```

- [ ] **Step 5: Run to verify the service tests pass**

Run: `dotnet test ShiftWork.Api.Tests --filter KioskServiceSettingsTests`
Expected: 4 tests PASS.

- [ ] **Step 6: Write the failing controller tests**

In `ShiftWork.Api.Tests/Kiosk/KioskControllerTests.cs`, add `using ShiftWork.Api.DTOs;` and `using Microsoft.AspNetCore.Mvc;` at the top, then add inside the class:

```csharp
    [Fact]
    public async Task GetKioskConfig_ReturnsOk_WithTheServiceConfig()
    {
        _kioskServiceMock
            .Setup(s => s.GetKioskConfigAsync(CompanyId, 3))
            .ReturnsAsync(new KioskConfigDto { RequirePin = false, RequirePhoto = true });

        var result = await _sut.GetKioskConfig(CompanyId, 3);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<KioskConfigDto>(ok.Value);
        Assert.False(dto.RequirePin);
        Assert.True(dto.RequirePhoto);
    }

    [Fact]
    public async Task GetKioskConfig_ReturnsNotFound_WhenLocationIsUnknown()
    {
        _kioskServiceMock
            .Setup(s => s.GetKioskConfigAsync(CompanyId, 3))
            .ReturnsAsync((KioskConfigDto?)null);

        var result = await _sut.GetKioskConfig(CompanyId, 3);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task GetKioskConfig_ReturnsBadRequest_WhenCompanyIsBlank()
    {
        var result = await _sut.GetKioskConfig(" ", 3);
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
```

- [ ] **Step 7: Run to verify they fail**

Run: `dotnet test ShiftWork.Api.Tests --filter KioskControllerTests`
Expected: build FAILS ("'KioskController' does not contain a definition for 'GetKioskConfig'").

- [ ] **Step 8: Add the endpoint**

In `KioskController.cs`, add after `GetKioskEmployees`:

```csharp
        /// <summary>
        /// Returns the PIN/photo switches for the site a kiosk is enrolled to.
        /// Anonymous, like the other kiosk reads; only booleans are exposed.
        /// </summary>
        [HttpGet("{companyId}/config")]
        [AllowAnonymous]
        public async Task<ActionResult<KioskConfigDto>> GetKioskConfig(string companyId, [FromQuery] int locationId)
        {
            if (string.IsNullOrWhiteSpace(companyId))
                return BadRequest("companyId is required.");

            var config = await _kioskService.GetKioskConfigAsync(companyId, locationId);
            if (config == null)
                return NotFound(new { message = $"Location {locationId} not found in company {companyId}." });

            return Ok(config);
        }
```

- [ ] **Step 9: Run and commit**

Run: `dotnet test ShiftWork.Api.Tests`
Expected: all tests PASS.

```bash
git add ShiftWork.Api ShiftWork.Api.Tests
git commit -m "feat(kiosk): add kiosk config endpoint and photoExempt on the employee list"
```

---

### Task 3: Idempotent, validated, PIN-enforced `/clock`

**Files:**
- Modify: `ShiftWork.Api/DTOs/KioskDtos.cs` (`KioskClockRequest`), `ShiftWork.Api/Services/KioskService.cs` (constructor + `ClockFromKioskAsync`), `ShiftWork.Api/Controllers/KioskController.cs` (`ClockFromKiosk`), `ShiftWork.Api/appsettings.json`
- Create: `ShiftWork.Api/Services/KioskPunchRejectedException.cs`
- Test: `ShiftWork.Api.Tests/Kiosk/KioskServiceClockTests.cs` (create), `ShiftWork.Api.Tests/Kiosk/KioskControllerTests.cs` (extend)

**Interfaces:**
- Consumes: `Location.RequirePin` (Task 1).
- Produces: `KioskClockRequest.EventLogId: Guid?`, `.EventDate: DateTime?`, `.Pin: string?`; `KioskPunchRejectedException(int statusCode, string message)` with `.StatusCode`. Status codes the kiosk outbox relies on: 400 (bad date / unknown person or location), 403 (PIN required/invalid), 409 (event id reused for a different punch) are all permanent; 5xx and network errors are retried. `POST /clock` returns 200 with the original event for a repeated `eventLogId`.

- [ ] **Step 1: Write the failing tests**

Create `ShiftWork.Api.Tests/Kiosk/KioskServiceClockTests.cs`:

```csharp
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test ShiftWork.Api.Tests --filter KioskServiceClockTests`
Expected: build FAILS ("'KioskClockRequest' does not contain a definition for 'EventLogId'", `KioskPunchRejectedException` not found, `KioskService` has no 3-argument constructor).

- [ ] **Step 3: Add the request fields and the exception**

In `KioskDtos.cs`, add to `KioskClockRequest` (after `Answers`):

```csharp
        /// <summary>Client-generated id. A repeated id returns the original event instead of creating a second one.</summary>
        public Guid? EventLogId { get; set; }
        /// <summary>When the employee actually tapped (UTC). Defaults to server time. Max 7 days old, not in the future.</summary>
        public DateTime? EventDate { get; set; }
        /// <summary>The employee's PIN. Required at PIN sites once KioskSettings:EnforcePinOnClock is on.</summary>
        public string? Pin { get; set; }
```

Create `ShiftWork.Api/Services/KioskPunchRejectedException.cs`:

```csharp
using System;

namespace ShiftWork.Api.Services
{
    /// <summary>A kiosk punch was understood but refused; carries the HTTP status to return.</summary>
    public class KioskPunchRejectedException : Exception
    {
        public int StatusCode { get; }

        public KioskPunchRejectedException(int statusCode, string message) : base(message)
        {
            StatusCode = statusCode;
        }
    }
}
```

- [ ] **Step 4: Rewrite `ClockFromKioskAsync`**

In `KioskService.cs`, add `using Microsoft.Extensions.Configuration;` at the top. Replace the constructor block and fields with:

```csharp
        private readonly ShiftWorkContext _context;
        private readonly IShiftEventService _shiftEventService;
        private readonly IConfiguration? _configuration;

        // Optional so existing tests and callers that build the service directly keep working.
        public KioskService(ShiftWorkContext context, IShiftEventService shiftEventService, IConfiguration? configuration = null)
        {
            _context = context;
            _shiftEventService = shiftEventService;
            _configuration = configuration;
        }

        private static readonly TimeSpan MaxClockSkew = TimeSpan.FromMinutes(5);
        private static readonly TimeSpan MaxPunchAge = TimeSpan.FromDays(7);

        private bool EnforcePin =>
            bool.TryParse(_configuration?["KioskSettings:EnforcePinOnClock"], out var enforce) && enforce;
```

Replace the whole `ClockFromKioskAsync` method with this, and add the three helpers after it:

```csharp
        public async Task<KioskClockResponse> ClockFromKioskAsync(string companyId, KioskClockRequest request)
        {
            var person = await _context.Persons
                .FirstOrDefaultAsync(p => p.PersonId == request.PersonId && p.CompanyId == companyId);
            if (person == null)
                throw new ArgumentException($"Person {request.PersonId} not found in company {companyId}.");

            var eventId = request.EventLogId ?? Guid.NewGuid();

            // A retried punch returns the original result instead of creating a second event.
            if (request.EventLogId.HasValue)
            {
                var existing = await _context.ShiftEvents.AsNoTracking()
                    .FirstOrDefaultAsync(e => e.EventLogId == eventId);
                if (existing != null)
                {
                    if (existing.CompanyId != companyId || existing.PersonId != request.PersonId)
                        throw new KioskPunchRejectedException(409, "This event id was already used for a different punch.");
                    return ToClockResponse(existing, person);
                }
            }

            var now = DateTime.UtcNow;
            var eventDate = ResolveEventDate(request.EventDate, now);
            await EnforcePinAsync(companyId, request, person);

            var shiftEvent = new ShiftEvent
            {
                EventLogId = eventId,
                EventDate = eventDate,
                EventType = request.EventType,
                CompanyId = companyId,
                PersonId = request.PersonId,
                PhotoUrl = request.PhotoUrl,
                GeoLocation = request.GeoLocation,
                KioskDevice = request.KioskDevice,
                CreatedAt = now,
            };
            _context.ShiftEvents.Add(shiftEvent);

            if (request.Answers != null && request.Answers.Count > 0)
            {
                var answers = request.Answers.Select(a => new KioskAnswer
                {
                    ShiftEventId = eventId,
                    KioskQuestionId = a.KioskQuestionId,
                    AnswerText = a.AnswerText,
                }).ToList();
                _context.KioskAnswers.AddRange(answers);
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException) when (request.EventLogId.HasValue)
            {
                // A concurrent retry inserted the same event id first: return that one.
                _context.ChangeTracker.Clear();
                var winner = await _context.ShiftEvents.AsNoTracking().FirstOrDefaultAsync(e =>
                    e.EventLogId == eventId && e.CompanyId == companyId && e.PersonId == request.PersonId);
                if (winner != null) return ToClockResponse(winner, person);
                throw;
            }

            // Kiosk devices are enrolled to a fixed site (request.LocationId), so this always
            // resolves a geofence target; it also fixes StatusShiftWork, which previously never
            // updated for kiosk clock-ins (see ShiftEventService.CreateShiftEventAsync for the
            // mobile/API-direct equivalent of this same logic).
            await _shiftEventService.ApplyStatusAndGeofenceAsync(shiftEvent, request.LocationId);

            return ToClockResponse(shiftEvent, person);
        }

        private static KioskClockResponse ToClockResponse(ShiftEvent e, Person person) => new()
        {
            EventLogId = e.EventLogId,
            EventType = e.EventType ?? string.Empty,
            EventDate = e.EventDate,
            PersonName = person.Name,
        };

        private static DateTime ResolveEventDate(DateTime? requested, DateTime nowUtc)
        {
            if (!requested.HasValue) return nowUtc;

            var utc = requested.Value.Kind switch
            {
                DateTimeKind.Utc => requested.Value,
                DateTimeKind.Local => requested.Value.ToUniversalTime(),
                _ => DateTime.SpecifyKind(requested.Value, DateTimeKind.Utc),
            };

            if (utc > nowUtc + MaxClockSkew)
                throw new ArgumentException("EventDate cannot be in the future.");
            if (utc < nowUtc - MaxPunchAge)
                throw new ArgumentException("EventDate is more than 7 days old.");
            return utc;
        }

        /// <summary>
        /// At PIN sites the punch must carry a valid PIN. Off by default (KioskSettings:EnforcePinOnClock)
        /// until every tablet runs a build that sends it. An unknown site (no LocationId) is treated as PIN-required.
        /// </summary>
        private async Task EnforcePinAsync(string companyId, KioskClockRequest request, Person person)
        {
            if (!EnforcePin) return;

            var requirePin = true;
            if (request.LocationId.HasValue)
            {
                var location = await _context.Locations.AsNoTracking().FirstOrDefaultAsync(l =>
                    l.LocationId == request.LocationId.Value && l.CompanyId == companyId);
                if (location == null)
                    throw new ArgumentException($"Location {request.LocationId} not found in company {companyId}.");
                requirePin = location.RequirePin;
            }

            if (!requirePin) return;

            if (string.IsNullOrEmpty(request.Pin) || string.IsNullOrEmpty(person.Pin) ||
                !BCrypt.Net.BCrypt.Verify(request.Pin, person.Pin))
                throw new KioskPunchRejectedException(403, "A valid PIN is required at this site.");
        }
```

- [ ] **Step 5: Run to verify the service tests pass**

Run: `dotnet test ShiftWork.Api.Tests --filter KioskServiceClockTests`
Expected: 15 tests PASS. Also run `dotnet test ShiftWork.Api.Tests --filter KioskServiceGeofenceTests` and expect it still PASSES (it uses the 2-argument constructor).

- [ ] **Step 6: Write the failing controller tests**

Add to `KioskControllerTests.cs`:

```csharp
    [Fact]
    public async Task ClockFromKiosk_ReturnsTheStatusOfARejectedPunch()
    {
        _kioskServiceMock
            .Setup(s => s.ClockFromKioskAsync(CompanyId, It.IsAny<KioskClockRequest>()))
            .ThrowsAsync(new KioskPunchRejectedException(403, "A valid PIN is required at this site."));

        var result = await _sut.ClockFromKiosk(CompanyId, new KioskClockRequest { PersonId = 1, EventType = "ClockIn" });

        var status = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(403, status.StatusCode);
    }

    [Fact]
    public async Task ClockFromKiosk_ReturnsBadRequest_ForABadEventDate()
    {
        _kioskServiceMock
            .Setup(s => s.ClockFromKioskAsync(CompanyId, It.IsAny<KioskClockRequest>()))
            .ThrowsAsync(new ArgumentException("EventDate cannot be in the future."));

        var result = await _sut.ClockFromKiosk(CompanyId, new KioskClockRequest { PersonId = 1, EventType = "ClockIn" });

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
```

- [ ] **Step 7: Run to verify the first one fails**

Run: `dotnet test ShiftWork.Api.Tests --filter KioskControllerTests`
Expected: `ClockFromKiosk_ReturnsTheStatusOfARejectedPunch` FAILS (the controller's bare `catch` returns 500).

- [ ] **Step 8: Map the exception in the controller**

In `KioskController.ClockFromKiosk`, add a catch **before** the `ArgumentException` catch:

```csharp
            catch (KioskPunchRejectedException ex)
            {
                return StatusCode(ex.StatusCode, new { message = ex.Message });
            }
```

- [ ] **Step 9: Add the settings keys**

In `ShiftWork.Api/appsettings.json`, replace:

```json
  "KioskSettings": {
    "AdminPassword": "admin123"
  },
```

with:

```json
  "KioskSettings": {
    "AdminPassword": "admin123",
    "EnforcePinOnClock": false,
    "PhotoBucket": "shiftwork-photos"
  },
```

- [ ] **Step 10: Run everything and commit**

Run: `dotnet test ShiftWork.Api.Tests`
Expected: all tests PASS.

```bash
git add ShiftWork.Api ShiftWork.Api.Tests
git commit -m "feat(kiosk): make /clock idempotent, accept client event time, optionally enforce PIN"
```


---

### Task 4: Anonymous kiosk photo upload

**Files:**
- Create: `ShiftWork.Api/Controllers/KioskPhotosController.cs`
- Test: `ShiftWork.Api.Tests/Kiosk/KioskPhotosControllerTests.cs` (create)

**Interfaces:**
- Consumes: `IAwsS3Service.UploadFileAsync(string bucketName, IFormFile file): Task<AwsS3Response>` (existing; `AwsS3Response.Message` holds the URL on success), config `KioskSettings:PhotoBucket` (Task 3).
- Produces: `POST /api/kiosk/{companyId}/photo` (multipart, field name `file`) → `200 { "url": "<https url>" }`; `400` for a missing, oversize (>5 MB), non-JPEG/PNG or fake image; `404` for an unknown company; `502` when S3 fails. The kiosk outbox (Task 6) calls it.

- [ ] **Step 1: Write the failing tests**

Create `ShiftWork.Api.Tests/Kiosk/KioskPhotosControllerTests.cs`:

```csharp
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Kiosk;

public class KioskPhotosControllerTests : IDisposable
{
    private const string CompanyId = "photo-co";
    private static readonly byte[] Jpeg = { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10 };
    private static readonly byte[] Png = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A };

    private readonly ShiftWorkContext _context;
    private readonly Mock<IAwsS3Service> _s3 = new();
    private readonly KioskPhotosController _sut;

    public KioskPhotosControllerTests()
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

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["KioskSettings:PhotoBucket"] = "test-bucket" })
            .Build();
        _sut = new KioskPhotosController(_context, _s3.Object, config, NullLogger<KioskPhotosController>.Instance);
    }

    public void Dispose() => _context.Dispose();

    private static IFormFile File(byte[] bytes, string contentType = "image/jpeg", long? declaredLength = null) =>
        new FormFile(new MemoryStream(bytes), 0, declaredLength ?? bytes.Length, "file", "p.jpg")
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType,
        };

    private void S3Returns(int status, string message) =>
        _s3.Setup(s => s.UploadFileAsync(It.IsAny<string>(), It.IsAny<IFormFile>()))
           .ReturnsAsync(new AwsS3Response { StatusCode = status, Message = message });

    [Fact]
    public async Task Upload_StoresAJpeg_InTheConfiguredBucket_AndReturnsTheUrl()
    {
        S3Returns(200, "https://s3.example/p.jpg");
        var file = File(Jpeg);

        var result = await _sut.Upload(CompanyId, file);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("https://s3.example/p.jpg", ok.Value!.GetType().GetProperty("url")!.GetValue(ok.Value));
        _s3.Verify(s => s.UploadFileAsync("test-bucket", file), Times.Once);
    }

    [Fact]
    public async Task Upload_AcceptsAPng()
    {
        S3Returns(200, "https://s3.example/p.png");
        Assert.IsType<OkObjectResult>(await _sut.Upload(CompanyId, File(Png, "image/png")));
    }

    [Fact]
    public async Task Upload_RejectsAnUnknownCompany()
    {
        S3Returns(200, "x");
        Assert.IsType<NotFoundObjectResult>(await _sut.Upload("nope", File(Jpeg)));
        _s3.Verify(s => s.UploadFileAsync(It.IsAny<string>(), It.IsAny<IFormFile>()), Times.Never);
    }

    [Fact]
    public async Task Upload_RejectsAMissingFile()
    {
        Assert.IsType<BadRequestObjectResult>(await _sut.Upload(CompanyId, null));
    }

    [Fact]
    public async Task Upload_RejectsAnEmptyFile()
    {
        Assert.IsType<BadRequestObjectResult>(await _sut.Upload(CompanyId, File(Array.Empty<byte>())));
    }

    [Fact]
    public async Task Upload_RejectsAWrongContentType()
    {
        Assert.IsType<BadRequestObjectResult>(await _sut.Upload(CompanyId, File(Jpeg, "application/pdf")));
    }

    [Fact]
    public async Task Upload_RejectsAFileThatIsNotReallyAnImage()
    {
        var notAnImage = System.Text.Encoding.ASCII.GetBytes("<script>alert(1)</script>");
        Assert.IsType<BadRequestObjectResult>(await _sut.Upload(CompanyId, File(notAnImage)));
    }

    [Fact]
    public async Task Upload_RejectsAFileOver5MB()
    {
        var huge = File(Jpeg, declaredLength: KioskPhotosController.MaxBytes + 1);
        Assert.IsType<BadRequestObjectResult>(await _sut.Upload(CompanyId, huge));
    }

    [Fact]
    public async Task Upload_Returns502_WhenS3Fails()
    {
        S3Returns(500, "boom");
        var result = await _sut.Upload(CompanyId, File(Jpeg));
        Assert.Equal(502, Assert.IsType<ObjectResult>(result).StatusCode);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test ShiftWork.Api.Tests --filter KioskPhotosControllerTests`
Expected: build FAILS ("The type or namespace name 'KioskPhotosController' could not be found").

- [ ] **Step 3: Implement the controller**

Create `ShiftWork.Api/Controllers/KioskPhotosController.cs`:

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Services;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// Anonymous photo upload for kiosk devices (same trust model as the kiosk clock endpoint).
    /// Accepts small JPEG/PNG files only, for a company that exists.
    /// </summary>
    [ApiController]
    [Route("api/kiosk/{companyId}/photo")]
    public class KioskPhotosController : ControllerBase
    {
        public const long MaxBytes = 5 * 1024 * 1024;

        private static readonly HashSet<string> AllowedTypes =
            new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png" };

        private readonly ShiftWorkContext _context;
        private readonly IAwsS3Service _s3;
        private readonly IConfiguration _configuration;
        private readonly ILogger<KioskPhotosController> _logger;

        public KioskPhotosController(
            ShiftWorkContext context,
            IAwsS3Service s3,
            IConfiguration configuration,
            ILogger<KioskPhotosController> logger)
        {
            _context = context;
            _s3 = s3;
            _configuration = configuration;
            _logger = logger;
        }

        [HttpPost]
        [AllowAnonymous]
        [RequestSizeLimit(6 * 1024 * 1024)]
        public async Task<IActionResult> Upload(string companyId, IFormFile? file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "A photo file is required." });
            if (file.Length > MaxBytes)
                return BadRequest(new { message = "The photo is larger than 5 MB." });
            if (!AllowedTypes.Contains(file.ContentType ?? string.Empty))
                return BadRequest(new { message = "Only JPEG or PNG photos are accepted." });
            if (!await LooksLikeImageAsync(file))
                return BadRequest(new { message = "The file is not a valid JPEG or PNG image." });

            if (string.IsNullOrWhiteSpace(companyId) ||
                !await _context.Companies.AnyAsync(c => c.CompanyId == companyId))
                return NotFound(new { message = "Company not found." });

            var bucket = _configuration["KioskSettings:PhotoBucket"] ?? "shiftwork-photos";
            var response = await _s3.UploadFileAsync(bucket, file);
            if (response.StatusCode < 200 || response.StatusCode >= 300)
            {
                _logger.LogError("Kiosk photo upload failed for company {CompanyId}: {Status} {Message}",
                    companyId, response.StatusCode, response.Message);
                return StatusCode(502, new { message = "Could not store the photo." });
            }

            return Ok(new { url = response.Message });
        }

        private static async Task<bool> LooksLikeImageAsync(IFormFile file)
        {
            var header = new byte[4];
            await using var stream = file.OpenReadStream();
            var read = await stream.ReadAsync(header, 0, header.Length);
            var jpeg = read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;
            var png = read >= 4 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47;
            return jpeg || png;
        }
    }
}
```

- [ ] **Step 4: Run to verify the tests pass**

Run: `dotnet test ShiftWork.Api.Tests --filter KioskPhotosControllerTests`
Expected: 9 tests PASS.

- [ ] **Step 5: Run everything and commit**

Run: `dotnet test ShiftWork.Api.Tests`
Expected: all PASS.

```bash
git add ShiftWork.Api ShiftWork.Api.Tests
git commit -m "feat(kiosk): add anonymous kiosk photo upload endpoint"
```

---

### Task 5: Angular admin: location toggles and employee exemption

**Files:**
- Modify: `ShiftWork.Angular/src/app/core/models/location.model.ts`, `ShiftWork.Angular/src/app/core/models/people.model.ts`
- Modify: `ShiftWork.Angular/src/app/features/dashboard/locations/locations.component.{ts,html,css}`
- Modify: `ShiftWork.Angular/src/app/features/dashboard/people/people.component.{ts,html}`
- Modify: `ShiftWork.Angular/src/locale/messages.xlf`, `ShiftWork.Angular/src/locale/messages.es.xlf`

**Interfaces:**
- Consumes: `LocationDto.RequirePin/RequirePhoto` and `PersonDto.PhotoExempt` (Task 1), serialized camelCase (`requirePin`, `requirePhoto`, `photoExempt`).
- Produces: admins can set both flags per location and the exemption per employee.

This component code has no spec files today (`locations/` and `people/` contain none), so verification is a type-check and build plus a manual check.

- [ ] **Step 1: Extend the models**

In `core/models/location.model.ts`, add after `status: string;`:

```ts
    requirePin?: boolean;
    requirePhoto?: boolean;
```

In `core/models/people.model.ts`, add after `roleId?: number;`:

```ts
    photoExempt?: boolean;
```

- [ ] **Step 2: Location form controls**

In `locations.component.ts`, in the `this.fb.group({...})` (the one containing `ratioMax: [100, Validators.required],`), add after `status: ['Active', Validators.required],`:

```ts
      requirePin: [true],
      requirePhoto: [true],
```

In `cancelEdit()`, in the `this.locationForm.reset({...})` object, add after `status: 'Active',`:

```ts
      requirePin: true,
      requirePhoto: true,
```

(`editLocation` already does `patchValue({...location})` and `saveLocation` already spreads `formValue`, so the two fields flow both ways with no further change.)

- [ ] **Step 3: Location template and style**

In `locations.component.html`, add this block immediately after the `radius_hint` form-group (the `</div>` that closes the group containing `<small class="form-hint" i18n="@@locations.radius_hint">…</small>`):

```html
                <div class="form-group">
                  <label class="form-label">
                    <i class="fa fa-lock"></i>
                    <ng-container i18n="@@locations.kiosk_section">Kiosk</ng-container>
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" id="requirePin" formControlName="requirePin">
                    <ng-container i18n="@@locations.require_pin">Require PIN at the kiosk</ng-container>
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" id="requirePhoto" formControlName="requirePhoto">
                    <ng-container i18n="@@locations.require_photo">Require a photo at the kiosk</ng-container>
                  </label>
                  <small class="form-hint" i18n="@@locations.kiosk_hint">Turn both off for the fastest clock-in. Employees marked "No photo required" never see the camera.</small>
                </div>
```

Append to `locations.component.css`:

```css
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.25rem 0;
  cursor: pointer;
}
```

- [ ] **Step 4: Employee form control and template**

In `people.component.ts`, in the `this.fb.group({...})` add after `photoUrl: ['']` (add a comma to it):

```ts
      photoUrl: [''],
      photoExempt: [false]
```

and in `cancelEdit()`'s `this.personForm.reset({...})` add after `photoUrl: '',`:

```ts
      photoExempt: false,
```

In `people.component.html`, replace the line

```html
                <!-- Roles field removed: permissions now managed via CompanyUserProfiles -->
```

with:

```html
                <div class="form-group">
                  <label class="checkbox-label">
                    <input type="checkbox" id="photoExempt" formControlName="photoExempt">
                    <ng-container i18n="@@people.photo_exempt">No photo required at the kiosk</ng-container>
                  </label>
                </div>

                <!-- Roles field removed: permissions now managed via CompanyUserProfiles -->
```

If `people.component.css` has no `.checkbox-label` rule, append the same rule as in Step 3 to it.

- [ ] **Step 5: Add the translation units**

In `src/locale/messages.xlf`, add these units next to the existing `people.pin_code` / `locations.radius_hint` units (order in the file does not matter):

```xml
      <trans-unit id="locations.kiosk_section" datatype="html">
        <source>Kiosk</source>
      </trans-unit>
      <trans-unit id="locations.require_pin" datatype="html">
        <source>Require PIN at the kiosk</source>
      </trans-unit>
      <trans-unit id="locations.require_photo" datatype="html">
        <source>Require a photo at the kiosk</source>
      </trans-unit>
      <trans-unit id="locations.kiosk_hint" datatype="html">
        <source>Turn both off for the fastest clock-in. Employees marked "No photo required" never see the camera.</source>
      </trans-unit>
      <trans-unit id="people.photo_exempt" datatype="html">
        <source>No photo required at the kiosk</source>
      </trans-unit>
```

In `src/locale/messages.es.xlf`, add:

```xml
      <trans-unit id="locations.kiosk_section" datatype="html">
        <source>Kiosk</source>
        <target state="translated">Kiosco</target>
      </trans-unit>
      <trans-unit id="locations.require_pin" datatype="html">
        <source>Require PIN at the kiosk</source>
        <target state="translated">Exigir PIN en el kiosco</target>
      </trans-unit>
      <trans-unit id="locations.require_photo" datatype="html">
        <source>Require a photo at the kiosk</source>
        <target state="translated">Exigir foto en el kiosco</target>
      </trans-unit>
      <trans-unit id="locations.kiosk_hint" datatype="html">
        <source>Turn both off for the fastest clock-in. Employees marked "No photo required" never see the camera.</source>
        <target state="translated">Desactiva ambos para una marcación más rápida. Los empleados marcados como "Sin foto" nunca ven la cámara.</target>
      </trans-unit>
      <trans-unit id="people.photo_exempt" datatype="html">
        <source>No photo required at the kiosk</source>
        <target state="translated">Sin foto en el kiosco</target>
      </trans-unit>
```

- [ ] **Step 6: Build**

Run: `cd ShiftWork.Angular && npm ci && npm run build`
Expected: build succeeds with no template or type errors (a missing-translation warning for any of the five ids means a trans-unit was not added to both files).

- [ ] **Step 7: Manual check**

Run the API and the Angular app. In Locations, edit a site, untick both boxes, save, reopen it: both stay unticked. In People, tick "No photo required", save, reopen: it stays ticked. Then `GET /api/kiosk/{companyId}/config?locationId=<id>` returns `requirePin:false, requirePhoto:false` and the employee list shows `photoExempt:true`.

- [ ] **Step 8: Commit**

```bash
git add ShiftWork.Angular
git commit -m "feat(admin): add kiosk PIN/photo toggles per location and photo exemption per employee"
```

---

### Task 6: Kiosk core logic: screen flow, offline outbox, API client

**Files:**
- Modify: `ShiftWork.Kiosk/types/index.ts`, `ShiftWork.Kiosk/services/kiosk.service.ts`
- Create: `ShiftWork.Kiosk/services/punchFlow.ts`, `ShiftWork.Kiosk/services/outbox.service.ts`
- Test: `ShiftWork.Kiosk/services/__tests__/punchFlow.test.ts`, `ShiftWork.Kiosk/services/__tests__/outbox.service.test.ts`, `ShiftWork.Kiosk/services/__tests__/kiosk.service.test.ts` (all create)

**Interfaces:**
- Consumes: the API from Tasks 2–4 (`/config`, `/photo`, new `/clock` fields, `photoExempt`).
- Produces (later tasks depend on these exact names):
  - `types`: `KioskConfig { requirePin; requirePhoto; questionsOnClockOutOnly }`, `KioskEmployee.photoExempt?`, `KioskClockRequest.{eventLogId?, eventDate?, pin?}`.
  - `punchFlow.ts`: `STRICT_DEFAULT_CONFIG`, `type PunchStep = 'pin'|'photo'|'questions'|'commit'`, `nextEventType(status?): ClockEventType`, `needsPhoto(config, employee): boolean`, `nextStep(from: 'start'|PunchStep, ctx: FlowContext): PunchStep`, `shouldShowInterstitial(eventType, entries): boolean`.
  - `outbox.service.ts`: `class Outbox` (`init()`, `enqueue(punch: NewPunch): Promise<{eventLogId, eventDate}>`, `undo(id): Promise<boolean>`, `drain()`, `getSnapshot(): OutboxSnapshot`, `subscribe(listener)`), `OutboxDeps`, `OutboxEntry`, `NewPunch`, `OutboxStorageError`, `applyPendingStatus(employees, entries)`, constants `UNDO_HOLD_MS`, `MAX_ENTRIES`, `MAX_AGE_MS`.
  - `kioskService.getConfig(companyId, locationId): Promise<KioskConfig>`, `kioskService.uploadPhoto(companyId, uri): Promise<string>`; `verifyPin` gets a 5 s timeout.

The two pure modules below were written and run in a scratch Jest project before this plan was finished: **35 tests passed and `tsc --noEmit` was clean.** That run found one real bug (the queue could send a later person's punch ahead of an earlier person's that was waiting out a retry delay), which is fixed in the `drain()` below.

- [ ] **Step 1: Install and confirm the kiosk test setup works**

Run: `cd ShiftWork.Kiosk && npm install && npm test`
Expected: the existing suites PASS (this proves Jest runs before you add to it).

- [ ] **Step 2: Extend the types**

In `ShiftWork.Kiosk/types/index.ts`:

Add `photoExempt?: boolean;` to `KioskEmployee` (after `statusShiftWork?: string; ...`).

Add this interface after `KioskLocation`:

```ts
/** Per-site switches fetched from GET /api/kiosk/{companyId}/config. */
export interface KioskConfig {
  requirePin: boolean;
  requirePhoto: boolean;
  questionsOnClockOutOnly: boolean;
}
```

Replace the `KioskClockRequest` interface with:

```ts
export interface KioskClockRequest {
  personId: number;
  eventType: ClockEventType;
  locationId?: number;
  photoUrl?: string;
  geoLocation?: string;
  kioskDevice: string;
  answers?: KioskAnswer[];
  /** Client-generated GUID; a repeated id returns the original event. */
  eventLogId?: string;
  /** ISO timestamp of the real tap. */
  eventDate?: string;
  /** Sent at PIN sites so the server can enforce it. */
  pin?: string;
}
```

- [ ] **Step 3: Write the failing screen-flow tests**

Create `ShiftWork.Kiosk/services/__tests__/punchFlow.test.ts`:

```ts
import { nextEventType, nextStep, needsPhoto, shouldShowInterstitial, STRICT_DEFAULT_CONFIG } from '../punchFlow';
import type { KioskConfig, KioskEmployee } from '@/types';

const emp = (over: Partial<KioskEmployee> = {}): KioskEmployee => ({ personId: 1, name: 'Maria', ...over });
const cfg = (over: Partial<KioskConfig> = {}): KioskConfig => ({ ...STRICT_DEFAULT_CONFIG, ...over });

describe('nextEventType', () => {
  it.each([
    ['OnShift', 'ClockOut'],
    ['OnShift:Late', 'ClockOut'],
    ['onshift:NoSchedule', 'ClockOut'],
    ['OffShift', 'ClockIn'],
    [undefined, 'ClockIn'],
    [null, 'ClockIn'],
    ['', 'ClockIn'],
  ])('%s -> %s', (status, expected) => {
    expect(nextEventType(status as string | undefined)).toBe(expected);
  });
});

describe('nextStep', () => {
  const base = { employee: emp(), eventType: 'ClockIn' as const, questionCount: 0 };

  it('PIN off, photo off -> straight to commit', () => {
    expect(nextStep('start', { ...base, config: cfg({ requirePin: false, requirePhoto: false }) })).toBe('commit');
  });
  it('PIN off, photo on -> photo, then commit', () => {
    const config = cfg({ requirePin: false, requirePhoto: true });
    expect(nextStep('start', { ...base, config })).toBe('photo');
    expect(nextStep('photo', { ...base, config })).toBe('commit');
  });
  it('PIN on, photo off -> pin, then commit', () => {
    const config = cfg({ requirePin: true, requirePhoto: false });
    expect(nextStep('start', { ...base, config })).toBe('pin');
    expect(nextStep('pin', { ...base, config })).toBe('commit');
  });
  it('PIN on, photo on -> pin, photo, commit', () => {
    const config = cfg();
    expect(nextStep('start', { ...base, config })).toBe('pin');
    expect(nextStep('pin', { ...base, config })).toBe('photo');
    expect(nextStep('photo', { ...base, config })).toBe('commit');
  });
  it('photo-exempt employee skips the camera even when the site requires photos', () => {
    const config = cfg({ requirePin: false });
    expect(needsPhoto(config, emp({ photoExempt: true }))).toBe(false);
    expect(nextStep('start', { ...base, employee: emp({ photoExempt: true }), config })).toBe('commit');
  });
  it('questions come only on clock-out and only when there are active questions', () => {
    const config = cfg({ requirePin: false, requirePhoto: false });
    expect(nextStep('start', { ...base, eventType: 'ClockIn', questionCount: 3, config })).toBe('commit');
    expect(nextStep('start', { ...base, eventType: 'ClockOut', questionCount: 0, config })).toBe('commit');
    expect(nextStep('start', { ...base, eventType: 'ClockOut', questionCount: 3, config })).toBe('questions');
    expect(nextStep('questions', { ...base, eventType: 'ClockOut', questionCount: 3, config })).toBe('commit');
  });
  it('clock-out with PIN, photo and questions runs pin, photo, questions, commit in order', () => {
    const ctx = { ...base, eventType: 'ClockOut' as const, questionCount: 2, config: cfg() };
    expect(nextStep('start', ctx)).toBe('pin');
    expect(nextStep('pin', ctx)).toBe('photo');
    expect(nextStep('photo', ctx)).toBe('questions');
    expect(nextStep('questions', ctx)).toBe('commit');
  });
});

describe('shouldShowInterstitial', () => {
  it('shows after a clock-out when every queued punch is healthy', () => {
    expect(shouldShowInterstitial('ClockOut', [{ attempts: 0 }])).toBe(true);
    expect(shouldShowInterstitial('ClockOut', [])).toBe(true);
  });
  it('is skipped after a clock-in', () => {
    expect(shouldShowInterstitial('ClockIn', [])).toBe(false);
    expect(shouldShowInterstitial(null, [])).toBe(false);
  });
  it('is skipped when any queued punch has already failed to send (kiosk looks offline)', () => {
    expect(shouldShowInterstitial('ClockOut', [{ attempts: 0 }, { attempts: 2 }])).toBe(false);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `cd ShiftWork.Kiosk && npm test -- punchFlow`
Expected: FAIL with "Cannot find module '../punchFlow'".

- [ ] **Step 5: Implement the screen flow**

Create `ShiftWork.Kiosk/services/punchFlow.ts`:

```ts
import type { ClockEventType, KioskConfig, KioskEmployee } from '@/types';

/** Used until a real config has been fetched or cached: the strictest behavior. */
export const STRICT_DEFAULT_CONFIG: KioskConfig = {
  requirePin: true,
  requirePhoto: true,
  questionsOnClockOutOnly: true,
};

export type PunchStep = 'pin' | 'photo' | 'questions' | 'commit';

const ORDER: PunchStep[] = ['pin', 'photo', 'questions', 'commit'];

/** "OnShift" and "OnShift:Late" etc. mean the next punch is a clock-out. */
export function nextEventType(status?: string | null): ClockEventType {
  return status && status.toLowerCase().startsWith('onshift') ? 'ClockOut' : 'ClockIn';
}

export function needsPhoto(config: KioskConfig, employee: KioskEmployee): boolean {
  return config.requirePhoto && !employee.photoExempt;
}

export interface FlowContext {
  config: KioskConfig;
  employee: KioskEmployee;
  eventType: ClockEventType;
  questionCount: number;
}

/** Which screen comes after `from`. 'start' means the employee was just tapped. */
export function nextStep(from: 'start' | PunchStep, ctx: FlowContext): PunchStep {
  const wanted: Record<PunchStep, boolean> = {
    pin: ctx.config.requirePin,
    photo: needsPhoto(ctx.config, ctx.employee),
    questions: ctx.eventType === 'ClockOut' && ctx.questionCount > 0,
    commit: true,
  };
  const startIdx = from === 'start' ? 0 : ORDER.indexOf(from) + 1;
  return ORDER.slice(startIdx).find((s) => wanted[s]) as PunchStep;
}

/** The post-clock-out screen needs the network; skip it when the kiosk looks offline. */
export function shouldShowInterstitial(
  eventType: ClockEventType | null,
  entries: ReadonlyArray<{ attempts: number }>,
): boolean {
  return eventType === 'ClockOut' && !entries.some((e) => e.attempts > 0);
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd ShiftWork.Kiosk && npm test -- punchFlow`
Expected: PASS (17 tests).

- [ ] **Step 7: Write the failing outbox tests**

Create `ShiftWork.Kiosk/services/__tests__/outbox.service.test.ts`:

```ts
import {
  Outbox, OutboxDeps, OutboxEntry, NewPunch, OutboxStorageError,
  UNDO_HOLD_MS, MAX_ENTRIES, MAX_AGE_MS, applyPendingStatus,
} from '../outbox.service';

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status } });
}

function setup() {
  let clock = 1_000_000;
  let idSeq = 0;
  let stored: OutboxEntry[] = [];
  const deps: OutboxDeps & {
    clock: jest.Mock; uploadPhoto: jest.Mock; save: jest.Mock;
  } = {
    load: jest.fn(async () => stored),
    save: jest.fn(async (e: OutboxEntry[]) => { stored = e; }),
    uploadPhoto: jest.fn(async () => 'https://s3/photo.jpg'),
    clock: jest.fn(async () => ({})),
    now: () => clock,
    newId: () => `id-${++idSeq}`,
  };
  const outbox = new Outbox(deps);
  const advance = (ms: number) => { clock += ms; };
  const punch = (over: Partial<NewPunch> = {}): NewPunch => ({
    companyId: 'co-1', personId: 7, eventType: 'ClockIn', kioskDevice: 'kiosk-1', locationId: 3, ...over,
  });
  return { outbox, deps, advance, punch, getStored: () => stored, setStored: (e: OutboxEntry[]) => { stored = e; } };
}

describe('Outbox.enqueue / undo', () => {
  it('persists the punch with the real tap time and reports it as pending', async () => {
    const { outbox, punch, getStored } = setup();
    const { eventLogId, eventDate } = await outbox.enqueue(punch());
    expect(eventLogId).toBe('id-1');
    expect(eventDate).toBe(new Date(1_000_000).toISOString());
    expect(getStored()).toHaveLength(1);
    expect(outbox.getSnapshot().pendingCount).toBe(1);
  });

  it('undo inside the hold window removes the punch', async () => {
    const { outbox, punch, advance, getStored } = setup();
    const { eventLogId } = await outbox.enqueue(punch());
    advance(UNDO_HOLD_MS - 1);
    expect(await outbox.undo(eventLogId)).toBe(true);
    expect(getStored()).toHaveLength(0);
    expect(outbox.getSnapshot().pendingCount).toBe(0);
  });

  it('undo after the hold window is refused', async () => {
    const { outbox, punch, advance } = setup();
    const { eventLogId } = await outbox.enqueue(punch());
    advance(UNDO_HOLD_MS);
    expect(await outbox.undo(eventLogId)).toBe(false);
    expect(outbox.getSnapshot().pendingCount).toBe(1);
  });

  it('throws OutboxStorageError and keeps the queue unchanged when storage is full', async () => {
    const { outbox, punch, deps } = setup();
    deps.save.mockRejectedValueOnce(new Error('disk full'));
    await expect(outbox.enqueue(punch())).rejects.toBeInstanceOf(OutboxStorageError);
    expect(outbox.getSnapshot().entries).toHaveLength(0);
  });
});

describe('Outbox.drain', () => {
  it('does not send a punch before its undo window has passed', async () => {
    const { outbox, punch, deps } = setup();
    await outbox.enqueue(punch());
    await outbox.drain();
    expect(deps.clock).not.toHaveBeenCalled();
  });

  it('sends oldest first with the idempotency id and the real tap time, then removes the entry', async () => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch({ personId: 1 }));
    advance(10);
    await outbox.enqueue(punch({ personId: 2, eventType: 'ClockOut', pin: '1234' }));
    advance(UNDO_HOLD_MS + 100);
    await outbox.drain();
    expect(deps.clock.mock.calls.map((c) => c[1].personId)).toEqual([1, 2]);
    expect(deps.clock.mock.calls[0][1]).toMatchObject({
      eventLogId: 'id-1', eventDate: new Date(1_000_000).toISOString(), kioskDevice: 'kiosk-1', locationId: 3,
    });
    expect(deps.clock.mock.calls[1][1].pin).toBe('1234');
    expect(outbox.getSnapshot().entries).toHaveLength(0);
  });

  it('a transient failure keeps the punch, backs off, and stops the queue to preserve order', async () => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch({ personId: 1 }));
    await outbox.enqueue(punch({ personId: 2 }));
    advance(UNDO_HOLD_MS + 1);
    deps.clock.mockRejectedValueOnce(new Error('Network Error'));
    await outbox.drain();
    expect(deps.clock).toHaveBeenCalledTimes(1);
    expect(outbox.getSnapshot().pendingCount).toBe(2);

    await outbox.drain(); // still inside the backoff window
    expect(deps.clock).toHaveBeenCalledTimes(1);

    advance(61_000);
    await outbox.drain();
    expect(deps.clock.mock.calls.map((c) => c[1].personId)).toEqual([1, 1, 2]);
    expect(outbox.getSnapshot().entries).toHaveLength(0);
  });

  it('a 5xx is transient', async () => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch());
    advance(UNDO_HOLD_MS + 1);
    deps.clock.mockRejectedValueOnce(httpError(503));
    await outbox.drain();
    expect(outbox.getSnapshot()).toMatchObject({ pendingCount: 1, failedCount: 0 });
  });

  it('a 4xx marks the punch failed, keeps it visible, and does not block the next one', async () => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch({ personId: 1 }));
    await outbox.enqueue(punch({ personId: 2 }));
    advance(UNDO_HOLD_MS + 1);
    deps.clock.mockRejectedValueOnce(httpError(400));
    await outbox.drain();
    const snap = outbox.getSnapshot();
    expect(snap.failedCount).toBe(1);
    expect(snap.entries.find((e) => e.status === 'failed')?.personId).toBe(1);
    expect(deps.clock).toHaveBeenCalledTimes(2);
    expect(snap.entries).toHaveLength(1); // person 2 was sent and removed
  });

  it('uploads the photo first and sends the returned URL, not the local path', async () => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch({ photoUri: 'file:///cache/p.jpg' }));
    advance(UNDO_HOLD_MS + 1);
    await outbox.drain();
    expect(deps.uploadPhoto).toHaveBeenCalledWith('co-1', 'file:///cache/p.jpg');
    expect(deps.clock.mock.calls[0][1].photoUrl).toBe('https://s3/photo.jpg');
  });

  it('a permanent photo failure still sends the punch, without a photo', async () => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch({ photoUri: 'file:///gone.jpg' }));
    advance(UNDO_HOLD_MS + 1);
    deps.uploadPhoto.mockRejectedValueOnce(httpError(413));
    await outbox.drain();
    expect(deps.clock).toHaveBeenCalledTimes(1);
    expect(deps.clock.mock.calls[0][1].photoUrl).toBeUndefined();
  });

  it('a transient photo failure retries; after 5 attempts the punch goes without the photo', async () => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch({ photoUri: 'file:///p.jpg' }));
    advance(UNDO_HOLD_MS + 1);
    deps.uploadPhoto.mockRejectedValue(new Error('Network Error'));
    for (let i = 0; i < 5; i++) {
      await outbox.drain();
      advance(61_000);
    }
    expect(deps.uploadPhoto).toHaveBeenCalledTimes(5);
    expect(deps.clock).toHaveBeenCalledTimes(1);
    expect(deps.clock.mock.calls[0][1].photoUrl).toBeUndefined();
  });

  it('two overlapping drains never send the same punch twice', async () => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch());
    advance(UNDO_HOLD_MS + 1);
    await Promise.all([outbox.drain(), outbox.drain()]);
    expect(deps.clock).toHaveBeenCalledTimes(1);
  });
});

describe('Outbox.init', () => {
  it('returns entries left "sending" by a crash to pending', async () => {
    const { outbox, setStored } = setup();
    setStored([{
      eventLogId: 'x', companyId: 'co-1', personId: 1, eventType: 'ClockIn', kioskDevice: 'k',
      eventDate: new Date(0).toISOString(), photoAttempts: 0, status: 'sending', holdUntil: 0,
      attempts: 0, nextAttemptAt: 0, createdAt: 0,
    }]);
    await outbox.init();
    expect(outbox.getSnapshot().entries[0].status).toBe('pending');
  });
});

describe('Outbox cap', () => {
  it('flags overCap past 200 punches', async () => {
    const { outbox, punch } = setup();
    for (let i = 0; i < MAX_ENTRIES + 1; i++) await outbox.enqueue(punch({ personId: i }));
    expect(outbox.getSnapshot().overCap).toBe(true);
    expect(outbox.getSnapshot().entries).toHaveLength(MAX_ENTRIES + 1); // nothing is dropped
  });

  it('flags overCap when the oldest punch is older than 24 hours', async () => {
    const { outbox, punch, advance } = setup();
    await outbox.enqueue(punch());
    expect(outbox.getSnapshot().overCap).toBe(false);
    advance(MAX_AGE_MS + 1);
    await outbox.enqueue(punch({ personId: 8 }));
    expect(outbox.getSnapshot().overCap).toBe(true);
  });
});

describe('applyPendingStatus', () => {
  const entry = (personId: number, eventType: 'ClockIn' | 'ClockOut', iso: string, status: OutboxEntry['status'] = 'pending'): OutboxEntry => ({
    eventLogId: `${personId}-${iso}`, companyId: 'c', personId, eventType, kioskDevice: 'k', eventDate: iso,
    photoAttempts: 0, status, holdUntil: 0, attempts: 0, nextAttemptAt: 0, createdAt: 0,
  });
  const employees = [
    { personId: 1, name: 'A', statusShiftWork: 'OffShift' },
    { personId: 2, name: 'B', statusShiftWork: 'OnShift' },
    { personId: 3, name: 'C', statusShiftWork: 'OffShift' },
  ];

  it('overlays unsent punches on the server status, latest punch wins', () => {
    const out = applyPendingStatus(employees, [
      entry(1, 'ClockIn', '2026-09-28T10:00:00.000Z'),
      entry(2, 'ClockOut', '2026-09-28T10:00:00.000Z'),
      entry(2, 'ClockIn', '2026-09-28T11:00:00.000Z'),
    ]);
    expect(out.map((e) => e.statusShiftWork)).toEqual(['OnShift', 'OnShift', 'OffShift']);
  });
  it('ignores failed punches and returns the same array when nothing is pending', () => {
    expect(applyPendingStatus(employees, [entry(1, 'ClockIn', '2026-09-28T10:00:00.000Z', 'failed')])).toBe(employees);
  });
});
```

- [ ] **Step 8: Run to verify it fails**

Run: `cd ShiftWork.Kiosk && npm test -- outbox.service`
Expected: FAIL with "Cannot find module '../outbox.service'".

- [ ] **Step 9: Implement the outbox**

Create `ShiftWork.Kiosk/services/outbox.service.ts`:

```ts
import type { ClockEventType, KioskAnswer, KioskClockRequest, KioskEmployee } from '@/types';

export const MAX_ENTRIES = 200;
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const UNDO_HOLD_MS = 3_000;
const MAX_PHOTO_ATTEMPTS = 5;

export interface OutboxEntry {
  eventLogId: string;
  companyId: string;
  personId: number;
  eventType: ClockEventType;
  locationId?: number;
  kioskDevice: string;
  /** ISO timestamp of the real tap. */
  eventDate: string;
  geoLocation?: string;
  pin?: string;
  answers?: KioskAnswer[];
  photoUri?: string;
  photoUrl?: string;
  photoFailed?: boolean;
  photoAttempts: number;
  status: 'pending' | 'sending' | 'failed';
  /** Epoch ms. The entry is not sent before this (Undo window). */
  holdUntil: number;
  attempts: number;
  /** Epoch ms. Backoff gate after a transient failure. */
  nextAttemptAt: number;
  lastError?: string;
  createdAt: number;
}

export type NewPunch = Pick<
  OutboxEntry,
  'companyId' | 'personId' | 'eventType' | 'locationId' | 'kioskDevice' | 'geoLocation' | 'pin' | 'answers' | 'photoUri'
>;

export interface OutboxDeps {
  load(): Promise<OutboxEntry[]>;
  save(entries: OutboxEntry[]): Promise<void>;
  uploadPhoto(companyId: string, uri: string): Promise<string>;
  clock(companyId: string, request: KioskClockRequest): Promise<unknown>;
  now(): number;
  newId(): string;
}

export interface OutboxSnapshot {
  entries: OutboxEntry[];
  pendingCount: number;
  failedCount: number;
  /** True when the queue holds more than MAX_ENTRIES or an entry older than MAX_AGE_MS. */
  overCap: boolean;
}

export class OutboxStorageError extends Error {
  constructor(message = 'Could not save the punch on this device') {
    super(message);
    this.name = 'OutboxStorageError';
  }
}

/** 4xx (except 408/429) will never succeed on retry; everything else is transient. */
export function isPermanentError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429;
}

export class Outbox {
  private entries: OutboxEntry[] = [];
  private listeners = new Set<() => void>();
  private draining = false;
  private snapshot: OutboxSnapshot = { entries: [], pendingCount: 0, failedCount: 0, overCap: false };

  constructor(private readonly deps: OutboxDeps) {}

  /** Load persisted entries; anything left "sending" by a crash goes back to pending. */
  async init(): Promise<void> {
    const loaded = await this.deps.load();
    this.entries = loaded.map((e) => (e.status === 'sending' ? { ...e, status: 'pending' as const } : e));
    this.publish();
  }

  async enqueue(punch: NewPunch): Promise<{ eventLogId: string; eventDate: string }> {
    const now = this.deps.now();
    const entry: OutboxEntry = {
      ...punch,
      eventLogId: this.deps.newId(),
      eventDate: new Date(now).toISOString(),
      photoAttempts: 0,
      status: 'pending',
      holdUntil: now + UNDO_HOLD_MS,
      attempts: 0,
      nextAttemptAt: 0,
      createdAt: now,
    };
    const next = [...this.entries, entry];
    try {
      await this.deps.save(next);
    } catch {
      throw new OutboxStorageError();
    }
    this.entries = next;
    this.publish();
    return { eventLogId: entry.eventLogId, eventDate: entry.eventDate };
  }

  /** Removes the punch if it is still inside its Undo window and unsent. */
  async undo(eventLogId: string): Promise<boolean> {
    const entry = this.entries.find((e) => e.eventLogId === eventLogId);
    if (!entry || entry.status !== 'pending' || this.deps.now() >= entry.holdUntil) return false;
    this.entries = this.entries.filter((e) => e.eventLogId !== eventLogId);
    await this.persist();
    this.publish();
    return true;
  }

  /** Sends due entries oldest first. Stops at the first transient failure to keep order. */
  async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      for (const id of this.entries.map((e) => e.eventLogId)) {
        const entry = this.entries.find((e) => e.eventLogId === id);
        if (!entry || entry.status !== 'pending') continue;
        const now = this.deps.now();
        // Not due yet: everything behind it is newer, so wait too. This keeps punches in order.
        if (now < entry.holdUntil || now < entry.nextAttemptAt) break;
        const ok = await this.sendOne(entry);
        if (!ok) break;
      }
    } finally {
      this.draining = false;
    }
  }

  getSnapshot(): OutboxSnapshot {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Returns false when a transient failure means the rest of the queue should wait. */
  private async sendOne(entry: OutboxEntry): Promise<boolean> {
    this.patch(entry.eventLogId, { status: 'sending' });
    let photoUrl = entry.photoUrl;
    let photoFailed = entry.photoFailed ?? false;

    if (entry.photoUri && !photoUrl && !photoFailed) {
      try {
        photoUrl = await this.deps.uploadPhoto(entry.companyId, entry.photoUri);
        this.patch(entry.eventLogId, { photoUrl });
      } catch (err) {
        const attempts = entry.photoAttempts + 1;
        if (isPermanentError(err) || attempts >= MAX_PHOTO_ATTEMPTS) {
          photoFailed = true; // give up on the photo; never lose the time record
          this.patch(entry.eventLogId, { photoFailed: true, photoAttempts: attempts });
        } else {
          this.retryLater(entry, err, { photoAttempts: attempts });
          await this.persist();
          return false;
        }
      }
    }

    try {
      await this.deps.clock(entry.companyId, {
        personId: entry.personId,
        eventType: entry.eventType,
        locationId: entry.locationId,
        kioskDevice: entry.kioskDevice,
        geoLocation: entry.geoLocation,
        answers: entry.answers,
        pin: entry.pin,
        eventLogId: entry.eventLogId,
        eventDate: entry.eventDate,
        photoUrl: photoFailed ? undefined : photoUrl,
      });
      this.entries = this.entries.filter((e) => e.eventLogId !== entry.eventLogId);
      await this.persist();
      this.publish();
      return true;
    } catch (err) {
      if (isPermanentError(err)) {
        this.patch(entry.eventLogId, { status: 'failed', lastError: errorMessage(err) });
        await this.persist();
        return true; // a permanently failed punch must not block the ones behind it
      }
      this.retryLater(entry, err, {});
      await this.persist();
      return false;
    }
  }

  private retryLater(entry: OutboxEntry, err: unknown, extra: Partial<OutboxEntry>): void {
    const attempts = entry.attempts + 1;
    const backoff = Math.min(60_000, 2_000 * 2 ** attempts);
    this.patch(entry.eventLogId, {
      ...extra,
      status: 'pending',
      attempts,
      nextAttemptAt: this.deps.now() + backoff,
      lastError: errorMessage(err),
    });
  }

  private patch(eventLogId: string, changes: Partial<OutboxEntry>): void {
    this.entries = this.entries.map((e) => (e.eventLogId === eventLogId ? { ...e, ...changes } : e));
    this.publish();
  }

  private async persist(): Promise<void> {
    try {
      await this.deps.save(this.entries);
    } catch {
      // The in-memory queue is still correct; the next successful save catches up.
    }
  }

  private publish(): void {
    const now = this.deps.now();
    const oldest = this.entries.reduce((min, e) => Math.min(min, e.createdAt), Infinity);
    this.snapshot = {
      entries: this.entries,
      pendingCount: this.entries.filter((e) => e.status !== 'failed').length,
      failedCount: this.entries.filter((e) => e.status === 'failed').length,
      overCap: this.entries.length > MAX_ENTRIES || (this.entries.length > 0 && now - oldest > MAX_AGE_MS),
    };
    this.listeners.forEach((l) => l());
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Server status for each person, with unsent local punches applied on top. */
export function applyPendingStatus(employees: KioskEmployee[], entries: OutboxEntry[]): KioskEmployee[] {
  const latest = new Map<number, OutboxEntry>();
  for (const e of entries) {
    if (e.status === 'failed') continue;
    const cur = latest.get(e.personId);
    if (!cur || e.eventDate > cur.eventDate) latest.set(e.personId, e);
  }
  if (latest.size === 0) return employees;
  return employees.map((emp) => {
    const e = latest.get(emp.personId);
    return e ? { ...emp, statusShiftWork: e.eventType === 'ClockIn' ? 'OnShift' : 'OffShift' } : emp;
  });
}
```

- [ ] **Step 10: Run to verify it passes**

Run: `cd ShiftWork.Kiosk && npm test -- outbox.service`
Expected: PASS (18 tests).

- [ ] **Step 11: Write the failing API-client tests**

Create `ShiftWork.Kiosk/services/__tests__/kiosk.service.test.ts`:

```ts
jest.mock('../api-client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import apiClient from '../api-client';
import { kioskService } from '../kiosk.service';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

class FakeFormData {
  parts: Array<[string, unknown]> = [];
  append(key: string, value: unknown) {
    this.parts.push([key, value]);
  }
}

const realFormData = (global as { FormData?: unknown }).FormData;
beforeAll(() => {
  (global as { FormData?: unknown }).FormData = FakeFormData;
});
afterAll(() => {
  (global as { FormData?: unknown }).FormData = realFormData;
});
beforeEach(() => jest.clearAllMocks());

describe('kioskService.getConfig', () => {
  it('requests the site config for the enrolled location', async () => {
    mockGet.mockResolvedValue({
      data: { requirePin: false, requirePhoto: true, questionsOnClockOutOnly: true },
    });

    const config = await kioskService.getConfig('co-1', 3);

    expect(mockGet).toHaveBeenCalledWith('/api/kiosk/co-1/config', { params: { locationId: 3 } });
    expect(config.requirePin).toBe(false);
    expect(config.requirePhoto).toBe(true);
  });
});

describe('kioskService.verifyPin', () => {
  it('fails fast (5 s) so an offline PIN screen does not hang', async () => {
    mockPost.mockResolvedValue({ data: { verified: true } });

    const ok = await kioskService.verifyPin(7, '1234');

    expect(ok).toBe(true);
    expect(mockPost).toHaveBeenCalledWith(
      '/api/auth/verify-pin',
      { personId: 7, pin: '1234' },
      { timeout: 5_000 }
    );
  });
});

describe('kioskService.uploadPhoto', () => {
  it('posts the file as multipart and returns the stored url', async () => {
    mockPost.mockResolvedValue({ data: { url: 'https://s3.example/p.jpg' } });

    const url = await kioskService.uploadPhoto('co-1', 'file:///cache/p.jpg');

    expect(url).toBe('https://s3.example/p.jpg');
    const [path, form, options] = mockPost.mock.calls[0];
    expect(path).toBe('/api/kiosk/co-1/photo');
    expect((form as FakeFormData).parts).toEqual([
      ['file', { uri: 'file:///cache/p.jpg', name: 'punch.jpg', type: 'image/jpeg' }],
    ]);
    expect(options.headers['Content-Type']).toBe('multipart/form-data');
    expect(options.timeout).toBe(30_000);
  });
});

describe('kioskService.clock', () => {
  it('sends the idempotency id, real tap time and pin as given', async () => {
    mockPost.mockResolvedValue({ data: { eventLogId: 'e1' } });
    const request = {
      personId: 7,
      eventType: 'ClockIn' as const,
      kioskDevice: 'k1',
      eventLogId: 'e1',
      eventDate: '2026-09-28T10:00:00.000Z',
      pin: '1234',
    };

    await kioskService.clock('co-1', request);

    expect(mockPost).toHaveBeenCalledWith('/api/kiosk/co-1/clock', request);
  });
});
```

- [ ] **Step 12: Run to verify it fails**

Run: `cd ShiftWork.Kiosk && npm test -- kiosk.service`
Expected: FAIL: `kioskService.getConfig is not a function` (and the `verifyPin` timeout assertion fails).

- [ ] **Step 13: Update the API client**

In `ShiftWork.Kiosk/services/kiosk.service.ts`: add `KioskConfig` to the type import list, then add these two methods to the `kioskService` object (after `getDefaultLanguage`):

```ts
  /** Per-site PIN/photo switches for the enrolled location. */
  async getConfig(companyId: string, locationId: number): Promise<KioskConfig> {
    const { data } = await apiClient.get<KioskConfig>(
      `/api/kiosk/${companyId}/config`,
      { params: { locationId } }
    );
    return data;
  },

  /** Uploads a punch photo and returns its stored URL. */
  async uploadPhoto(companyId: string, uri: string): Promise<string> {
    const form = new FormData();
    form.append('file', { uri, name: 'punch.jpg', type: 'image/jpeg' } as unknown as Blob);
    const { data } = await apiClient.post<{ url: string }>(
      `/api/kiosk/${companyId}/photo`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30_000 }
    );
    return data.url;
  },
```

and replace the existing `verifyPin` method with:

```ts
  async verifyPin(personId: number, pin: string): Promise<boolean> {
    // Short timeout: with no connection the PIN screen must fail fast, not spin for 15 s.
    const { data } = await apiClient.post<{ verified: boolean }>(
      '/api/auth/verify-pin',
      { personId, pin },
      { timeout: 5_000 }
    );
    return data.verified;
  },
```

- [ ] **Step 14: Run everything and commit**

Run: `cd ShiftWork.Kiosk && npm test && npm run type-check`
Expected: all suites PASS; `tsc` reports no errors.

```bash
git add ShiftWork.Kiosk
git commit -m "feat(kiosk): add screen-flow logic, offline outbox and photo/config API client"
```

---

### Task 7: Kiosk plumbing: local storage, site config, cached GPS, outbox wiring

**Files:**
- Modify: `ShiftWork.Kiosk/package.json` (via `expo install`), `ShiftWork.Kiosk/app/_layout.tsx`
- Create: `ShiftWork.Kiosk/utils/localStore.ts`, `ShiftWork.Kiosk/store/configStore.ts`, `ShiftWork.Kiosk/services/geo.service.ts`, `ShiftWork.Kiosk/services/outbox.ts`
- Test: `ShiftWork.Kiosk/store/__tests__/configStore.test.ts`, `ShiftWork.Kiosk/services/__tests__/geo.service.test.ts` (create)

**Interfaces:**
- Consumes: `kioskService.getConfig`, `STRICT_DEFAULT_CONFIG`, `Outbox`, `OutboxEntry`, `OutboxSnapshot` (Task 6).
- Produces:
  - `localStore.ts`: `getJson<T>(key): Promise<T | null>` (never throws), `setJson(key, value): Promise<void>` (throws on failure).
  - `configStore.ts`: `useConfigStore` with `config: KioskConfig`, `loadCached(companyId, locationId): Promise<void>`, `refresh(companyId, locationId): Promise<void>`.
  - `geo.service.ts`: `getLastKnownGeo(): string | null` (format `"lat,lng"`), `refreshGeo(): Promise<void>`, `startGeoRefresh(): () => void`, `clearGeo(): void`.
  - `outbox.ts`: `outbox` (the app-wide `Outbox`), `startOutboxWorker(): () => void`, `useOutboxStatus(): OutboxSnapshot`.

- [ ] **Step 1: Install the two native dependencies**

Run: `cd ShiftWork.Kiosk && npx expo install @react-native-async-storage/async-storage expo-crypto`
Expected: both appear in `package.json` `dependencies` with SDK-54-compatible versions. (AsyncStorage holds the outbox and the cached config; `expo-crypto` supplies `randomUUID()` for punch ids. Both need a new native build of the tablet app.)

- [ ] **Step 2: Write the failing config-store tests**

Create `ShiftWork.Kiosk/store/__tests__/configStore.test.ts`:

```ts
jest.mock('@/services/kiosk.service', () => ({
  kioskService: { getConfig: jest.fn() },
}));
jest.mock('@/utils/localStore', () => ({
  getJson: jest.fn(),
  setJson: jest.fn(),
}));

import { kioskService } from '@/services/kiosk.service';
import { getJson, setJson } from '@/utils/localStore';
import { STRICT_DEFAULT_CONFIG } from '@/services/punchFlow';
import { useConfigStore } from '../configStore';

const mockGetConfig = kioskService.getConfig as jest.Mock;
const mockGetJson = getJson as jest.Mock;
const mockSetJson = setJson as jest.Mock;

const LAX = { requirePin: false, requirePhoto: false, questionsOnClockOutOnly: true };

beforeEach(() => {
  jest.clearAllMocks();
  mockSetJson.mockResolvedValue(undefined);
  useConfigStore.setState({ config: STRICT_DEFAULT_CONFIG });
});

describe('configStore', () => {
  it('starts strict: PIN and photo required', () => {
    expect(useConfigStore.getState().config).toEqual(STRICT_DEFAULT_CONFIG);
  });

  it('refresh applies the server config and caches it for this site', async () => {
    mockGetConfig.mockResolvedValue(LAX);

    await useConfigStore.getState().refresh('co-1', 3);

    expect(useConfigStore.getState().config).toEqual(LAX);
    expect(mockSetJson).toHaveBeenCalledWith('kiosk_config_v1_co-1_3', LAX);
  });

  it('refresh keeps the current config when the server cannot be reached', async () => {
    useConfigStore.setState({ config: LAX });
    mockGetConfig.mockRejectedValue(new Error('Network Error'));

    await useConfigStore.getState().refresh('co-1', 3);

    expect(useConfigStore.getState().config).toEqual(LAX);
  });

  it('a failed cache write does not lose the fresh config', async () => {
    mockGetConfig.mockResolvedValue(LAX);
    mockSetJson.mockRejectedValue(new Error('disk full'));

    await useConfigStore.getState().refresh('co-1', 3);

    expect(useConfigStore.getState().config).toEqual(LAX);
  });

  it('loadCached uses the cached config for this site', async () => {
    mockGetJson.mockResolvedValue(LAX);

    await useConfigStore.getState().loadCached('co-1', 3);

    expect(mockGetJson).toHaveBeenCalledWith('kiosk_config_v1_co-1_3');
    expect(useConfigStore.getState().config).toEqual(LAX);
  });

  it('loadCached falls back to strict when there is no cache, never keeping another site\'s lax config', async () => {
    useConfigStore.setState({ config: LAX });
    mockGetJson.mockResolvedValue(null);

    await useConfigStore.getState().loadCached('co-1', 4);

    expect(useConfigStore.getState().config).toEqual(STRICT_DEFAULT_CONFIG);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd ShiftWork.Kiosk && npm test -- configStore`
Expected: FAIL with "Cannot find module '../configStore'".

- [ ] **Step 4: Implement local storage and the config store**

Create `ShiftWork.Kiosk/utils/localStore.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Reads a JSON value; returns null when missing or unreadable. Never throws. */
export async function getJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Writes a JSON value. Throws on failure so callers (the outbox) can react. */
export async function setJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
```

Create `ShiftWork.Kiosk/store/configStore.ts`:

```ts
import { create } from 'zustand';
import type { KioskConfig } from '@/types';
import { kioskService } from '@/services/kiosk.service';
import { STRICT_DEFAULT_CONFIG } from '@/services/punchFlow';
import { getJson, setJson } from '@/utils/localStore';

const cacheKey = (companyId: string, locationId: number) =>
  `kiosk_config_v1_${companyId}_${locationId}`;

interface ConfigState {
  /** Strict (PIN and photo required) until a real config is cached or fetched. */
  config: KioskConfig;
  /** Apply the last config saved for this site, or go strict when there is none. */
  loadCached: (companyId: string, locationId: number) => Promise<void>;
  /** Fetch the live config; on any failure keep whatever is current. */
  refresh: (companyId: string, locationId: number) => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: STRICT_DEFAULT_CONFIG,

  loadCached: async (companyId, locationId) => {
    set({ config: STRICT_DEFAULT_CONFIG });
    const cached = await getJson<KioskConfig>(cacheKey(companyId, locationId));
    if (cached) set({ config: cached });
  },

  refresh: async (companyId, locationId) => {
    try {
      const config = await kioskService.getConfig(companyId, locationId);
      set({ config });
      await setJson(cacheKey(companyId, locationId), config).catch(() => undefined);
    } catch {
      // Offline or server error: keep the cached (or strict) config.
    }
  },
}));
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd ShiftWork.Kiosk && npm test -- configStore`
Expected: PASS (6 tests).

- [ ] **Step 6: Write the failing GPS-cache tests**

Create `ShiftWork.Kiosk/services/__tests__/geo.service.test.ts`:

```ts
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

import * as Location from 'expo-location';
import { clearGeo, getLastKnownGeo, refreshGeo, startGeoRefresh } from '../geo.service';

const mockPermission = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockPosition = Location.getCurrentPositionAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  clearGeo();
});

describe('geo.service', () => {
  it('has no fix until one is fetched', () => {
    expect(getLastKnownGeo()).toBeNull();
  });

  it('stores the fix as "lat,lng"', async () => {
    mockPermission.mockResolvedValue({ status: 'granted' });
    mockPosition.mockResolvedValue({ coords: { latitude: 40.75, longitude: -73.98 } });

    await refreshGeo();

    expect(getLastKnownGeo()).toBe('40.75,-73.98');
  });

  it('does nothing when location permission is denied', async () => {
    mockPermission.mockResolvedValue({ status: 'denied' });

    await refreshGeo();

    expect(mockPosition).not.toHaveBeenCalled();
    expect(getLastKnownGeo()).toBeNull();
  });

  it('keeps the previous fix when a later lookup fails', async () => {
    mockPermission.mockResolvedValue({ status: 'granted' });
    mockPosition.mockResolvedValueOnce({ coords: { latitude: 1, longitude: 2 } });
    await refreshGeo();

    mockPosition.mockRejectedValueOnce(new Error('no signal'));
    await refreshGeo();

    expect(getLastKnownGeo()).toBe('1,2');
  });

  it('startGeoRefresh fetches now and every 5 minutes until stopped', async () => {
    jest.useFakeTimers();
    mockPermission.mockResolvedValue({ status: 'granted' });
    mockPosition.mockResolvedValue({ coords: { latitude: 1, longitude: 2 } });

    const stop = startGeoRefresh();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockPosition).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(5 * 60_000);
    expect(mockPosition).toHaveBeenCalledTimes(2);

    stop();
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    expect(mockPosition).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `cd ShiftWork.Kiosk && npm test -- geo.service`
Expected: FAIL with "Cannot find module '../geo.service'".

- [ ] **Step 8: Implement the GPS cache**

Create `ShiftWork.Kiosk/services/geo.service.ts`:

```ts
import * as Location from 'expo-location';

const REFRESH_MS = 5 * 60_000;

let lastKnown: string | null = null;

/** The most recent fix as "lat,lng", or null. A kiosk is fixed on a wall, so a fix a few minutes old is fine. */
export function getLastKnownGeo(): string | null {
  return lastKnown;
}

export function clearGeo(): void {
  lastKnown = null;
}

/** Fetches a fix. Never throws and never blocks a punch; failures keep the previous fix. */
export async function refreshGeo(): Promise<void> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    lastKnown = `${loc.coords.latitude},${loc.coords.longitude}`;
  } catch {
    // Geo is optional.
  }
}

/** Fetch now, then every 5 minutes. Returns a function that stops it. */
export function startGeoRefresh(): () => void {
  void refreshGeo();
  const id = setInterval(() => void refreshGeo(), REFRESH_MS);
  return () => clearInterval(id);
}
```

- [ ] **Step 9: Run to verify it passes**

Run: `cd ShiftWork.Kiosk && npm test -- geo.service`
Expected: PASS (5 tests).

- [ ] **Step 10: Wire the app-wide outbox**

Create `ShiftWork.Kiosk/services/outbox.ts`:

```ts
import { useSyncExternalStore } from 'react';
import * as Crypto from 'expo-crypto';
import { kioskService } from '@/services/kiosk.service';
import { getJson, setJson } from '@/utils/localStore';
import { Outbox, type OutboxEntry, type OutboxSnapshot } from '@/services/outbox.service';

const OUTBOX_KEY = 'kiosk_outbox_v1';
const DRAIN_EVERY_MS = 5_000;

/** The single queue for this tablet. Punches are recorded here first and sent in the background. */
export const outbox = new Outbox({
  load: async () => (await getJson<OutboxEntry[]>(OUTBOX_KEY)) ?? [],
  save: (entries) => setJson(OUTBOX_KEY, entries),
  uploadPhoto: (companyId, uri) => kioskService.uploadPhoto(companyId, uri),
  clock: (companyId, request) => kioskService.clock(companyId, request),
  now: () => Date.now(),
  newId: () => Crypto.randomUUID(),
});

/** Loads the saved queue, then tries to send every few seconds. Returns a stop function. */
export function startOutboxWorker(): () => void {
  void outbox.init().then(() => outbox.drain());
  const id = setInterval(() => void outbox.drain(), DRAIN_EVERY_MS);
  return () => clearInterval(id);
}

/** Live queue counts for the admin badge and the pending-status overlay. */
export function useOutboxStatus(): OutboxSnapshot {
  return useSyncExternalStore(
    (listener) => outbox.subscribe(listener),
    () => outbox.getSnapshot()
  );
}
```

- [ ] **Step 11: Start the worker, cached config and GPS from the root layout**

In `ShiftWork.Kiosk/app/_layout.tsx`, add these imports after `import { LocaleProvider } from '@/i18n';`:

```ts
import { startOutboxWorker } from '@/services/outbox';
import { startGeoRefresh } from '@/services/geo.service';
import { useConfigStore } from '@/store/configStore';
```

Then, inside `RootLayout`, replace:

```ts
  const loadFromStorage = useDeviceStore((s) => s.loadFromStorage);
```

with:

```ts
  const loadFromStorage = useDeviceStore((s) => s.loadFromStorage);
  const isEnrolled = useDeviceStore((s) => s.isEnrolled);
  const companyId = useDeviceStore((s) => s.companyId);
  const locationId = useDeviceStore((s) => s.locationId);
  const loadCachedConfig = useConfigStore((s) => s.loadCached);
```

and add these two effects directly after the `// Keep the tablet screen awake at all times` effect:

```ts
  // Load the saved offline queue and keep sending it for the life of the app.
  useEffect(() => startOutboxWorker(), []);

  // Once enrolled: apply this site's last-known PIN/photo switches (strict until known)
  // and keep a recent GPS fix so punches never wait on a location lookup.
  useEffect(() => {
    if (!isEnrolled) return undefined;
    void loadCachedConfig(companyId, locationId);
    return startGeoRefresh();
  }, [isEnrolled, companyId, locationId, loadCachedConfig]);
```

- [ ] **Step 12: Run everything and commit**

Run: `cd ShiftWork.Kiosk && npm test && npm run type-check`
Expected: all suites PASS; no type errors.

```bash
git add ShiftWork.Kiosk
git commit -m "feat(kiosk): add local storage, site config store, cached GPS and outbox worker"
```

---

### Task 8: Punch commit, screen routing, employee list and PIN screen

**Files:**
- Modify: `ShiftWork.Kiosk/store/sessionStore.ts` (rewrite), `ShiftWork.Kiosk/app/(kiosk)/index.tsx`, `ShiftWork.Kiosk/app/(kiosk)/pin.tsx`
- Create: `ShiftWork.Kiosk/services/punch.service.ts`, `ShiftWork.Kiosk/hooks/usePunchNavigator.ts`
- Test: `ShiftWork.Kiosk/services/__tests__/punch.service.test.ts` (create)

**Interfaces:**
- Consumes: `outbox`, `useOutboxStatus` (Task 7), `Outbox.enqueue`, `applyPendingStatus`, `UNDO_HOLD_MS`, `nextStep`, `nextEventType` (Task 6), `getLastKnownGeo` (Task 7), `useConfigStore` (Task 7).
- Produces:
  - `sessionStore`: `employee`, `clockType`, `capturedPhotoUri`, `pin`, `answers`, `eventLogId`, `commitError`; actions `startPunch(employee, clockType)` (clears everything else), `setCapturedPhoto(uri)`, `setPin(pin)`, `setAnswers(answers)`, `setCommitted(eventLogId)`, `setCommitError(failed)`, `reset()`.
  - `punch.service.ts`: `commitPunch(input: CommitInput, now?): Promise<{ eventLogId: string }>`, `forgetRecentPunch(personId): void`.
  - `usePunchNavigator(): (from: 'start' | PunchStep) => Promise<void>`. Screens call it after finishing their step; it routes to the next screen or commits the punch and opens `/(kiosk)/success`. Tasks 9 relies on the session fields above.

- [ ] **Step 1: Write the failing commit tests**

Create `ShiftWork.Kiosk/services/__tests__/punch.service.test.ts`:

```ts
jest.mock('../outbox', () => ({
  outbox: { enqueue: jest.fn(), drain: jest.fn() },
}));
jest.mock('../geo.service', () => ({
  getLastKnownGeo: jest.fn(),
}));
jest.mock('@/store/deviceStore', () => ({
  useDeviceStore: {
    getState: () => ({ companyId: 'co-1', locationId: 3, kioskDeviceId: 'kiosk-1' }),
  },
}));

import { outbox } from '../outbox';
import { getLastKnownGeo } from '../geo.service';
import { UNDO_HOLD_MS } from '../outbox.service';
import { commitPunch, forgetRecentPunch } from '../punch.service';

const enqueue = outbox.enqueue as jest.Mock;
const drain = outbox.drain as jest.Mock;
const geo = getLastKnownGeo as jest.Mock;

const ana = { personId: 7, name: 'Ana' };
const ben = { personId: 8, name: 'Ben' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  let n = 0;
  enqueue.mockImplementation(async () => ({ eventLogId: `e${++n}`, eventDate: 'x' }));
  geo.mockReturnValue('40.1,-73.9');
  forgetRecentPunch(7);
  forgetRecentPunch(8);
});
afterEach(() => jest.useRealTimers());

describe('commitPunch', () => {
  it('records the punch with the device, last known location, pin, photo and answers', async () => {
    const answers = [{ kioskQuestionId: 1, answerText: 'yes' }];

    const result = await commitPunch({
      employee: ana, eventType: 'ClockOut', pin: '1234', photoUri: 'file:///p.jpg', answers,
    });

    expect(result.eventLogId).toBe('e1');
    expect(enqueue).toHaveBeenCalledWith({
      companyId: 'co-1',
      personId: 7,
      eventType: 'ClockOut',
      locationId: 3,
      kioskDevice: 'kiosk-1',
      geoLocation: '40.1,-73.9',
      pin: '1234',
      answers,
      photoUri: 'file:///p.jpg',
    });
  });

  it('leaves out the location and pin when there are none', async () => {
    geo.mockReturnValue(null);

    await commitPunch({ employee: ana, eventType: 'ClockIn' });

    const call = enqueue.mock.calls[0][0];
    expect(call.geoLocation).toBeUndefined();
    expect(call.pin).toBeUndefined();
    expect(call.photoUri).toBeUndefined();
  });

  it('asks the outbox to send shortly after the undo window closes', async () => {
    await commitPunch({ employee: ana, eventType: 'ClockIn' });
    expect(drain).not.toHaveBeenCalled();

    jest.advanceTimersByTime(UNDO_HOLD_MS + 300);

    expect(drain).toHaveBeenCalledTimes(1);
  });

  it('a double tap inside the undo window records one punch and returns the same id', async () => {
    let t = 1_000;
    const first = await commitPunch({ employee: ana, eventType: 'ClockIn' }, () => t);
    t += 500;
    const second = await commitPunch({ employee: ana, eventType: 'ClockOut' }, () => t);

    expect(second.eventLogId).toBe(first.eventLogId);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('a different person is never blocked by someone else\'s recent punch', async () => {
    let t = 1_000;
    await commitPunch({ employee: ana, eventType: 'ClockIn' }, () => t);
    await commitPunch({ employee: ben, eventType: 'ClockIn' }, () => t);
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it('a deliberate second punch after the undo window is recorded', async () => {
    let t = 1_000;
    await commitPunch({ employee: ana, eventType: 'ClockIn' }, () => t);
    t += UNDO_HOLD_MS;
    await commitPunch({ employee: ana, eventType: 'ClockOut' }, () => t);
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it('after Undo the same person can punch again immediately', async () => {
    let t = 1_000;
    await commitPunch({ employee: ana, eventType: 'ClockIn' }, () => t);
    forgetRecentPunch(7);
    t += 200;
    await commitPunch({ employee: ana, eventType: 'ClockOut' }, () => t);
    expect(enqueue).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ShiftWork.Kiosk && npm test -- punch.service`
Expected: FAIL with "Cannot find module '../punch.service'".

- [ ] **Step 3: Implement the commit**

Create `ShiftWork.Kiosk/services/punch.service.ts`:

```ts
import { useDeviceStore } from '@/store/deviceStore';
import type { ClockEventType, KioskAnswer, KioskEmployee } from '@/types';
import { getLastKnownGeo } from './geo.service';
import { outbox } from './outbox';
import { UNDO_HOLD_MS } from './outbox.service';

export interface CommitInput {
  employee: KioskEmployee;
  eventType: ClockEventType;
  pin?: string;
  photoUri?: string;
  answers?: KioskAnswer[];
}

/**
 * Double-tap guard: a second commit for the same person inside the undo window
 * returns the first punch instead of recording an In followed by an Out.
 */
const recent = new Map<number, { eventLogId: string; at: number }>();

/** Call after Undo so the employee can punch again right away. */
export function forgetRecentPunch(personId: number): void {
  recent.delete(personId);
}

/** Records the punch on this tablet (it is sent in the background) and returns its id. */
export async function commitPunch(
  input: CommitInput,
  now: () => number = Date.now
): Promise<{ eventLogId: string }> {
  const prior = recent.get(input.employee.personId);
  if (prior && now() - prior.at < UNDO_HOLD_MS) {
    return { eventLogId: prior.eventLogId };
  }

  const { companyId, locationId, kioskDeviceId } = useDeviceStore.getState();
  const { eventLogId } = await outbox.enqueue({
    companyId,
    personId: input.employee.personId,
    eventType: input.eventType,
    locationId: locationId || undefined,
    kioskDevice: kioskDeviceId,
    geoLocation: getLastKnownGeo() ?? undefined,
    pin: input.pin,
    answers: input.answers,
    photoUri: input.photoUri,
  });

  recent.set(input.employee.personId, { eventLogId, at: now() });
  // The outbox holds the punch for the undo window; ask it to send just after.
  setTimeout(() => void outbox.drain(), UNDO_HOLD_MS + 250);
  return { eventLogId };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd ShiftWork.Kiosk && npm test -- punch.service`
Expected: PASS (7 tests).

- [ ] **Step 5: Rewrite the session store**

Replace the whole of `ShiftWork.Kiosk/store/sessionStore.ts` with:

```ts
import { create } from 'zustand';
import type { KioskAnswer, KioskEmployee, ClockEventType } from '@/types';

// Transient per-punch state. Cleared when a new punch starts and after the success screen.
interface SessionState {
  employee: KioskEmployee | null;
  clockType: ClockEventType | null;
  capturedPhotoUri: string | null;
  /** The PIN the employee just entered; kept only until the punch is recorded. */
  pin: string | null;
  answers: KioskAnswer[];
  /** Id of the recorded punch, used by Undo. Null until recorded. */
  eventLogId: string | null;
  /** True when the punch could not be saved on this tablet. */
  commitError: boolean;

  // Actions
  startPunch: (employee: KioskEmployee, clockType: ClockEventType) => void;
  setCapturedPhoto: (uri: string) => void;
  setPin: (pin: string) => void;
  setAnswers: (answers: KioskAnswer[]) => void;
  setCommitted: (eventLogId: string) => void;
  setCommitError: (failed: boolean) => void;
  reset: () => void;
}

const initialState = {
  employee: null,
  clockType: null,
  capturedPhotoUri: null,
  pin: null,
  answers: [] as KioskAnswer[],
  eventLogId: null,
  commitError: false,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,
  startPunch: (employee, clockType) => set({ ...initialState, employee, clockType }),
  setCapturedPhoto: (capturedPhotoUri) => set({ capturedPhotoUri }),
  setPin: (pin) => set({ pin }),
  setAnswers: (answers) => set({ answers }),
  setCommitted: (eventLogId) => set({ eventLogId, commitError: false }),
  setCommitError: (commitError) => set({ commitError }),
  reset: () => set(initialState),
}));
```

- [ ] **Step 6: Add the navigation hook**

Create `ShiftWork.Kiosk/hooks/usePunchNavigator.ts`:

```ts
import { useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { kioskService } from '@/services/kiosk.service';
import { commitPunch } from '@/services/punch.service';
import { nextStep, type PunchStep } from '@/services/punchFlow';
import { useConfigStore } from '@/store/configStore';
import { useDeviceStore } from '@/store/deviceStore';
import { useSessionStore } from '@/store/sessionStore';

const ROUTES = {
  pin: '/(kiosk)/pin',
  photo: '/(kiosk)/clock',
  questions: '/(kiosk)/questions',
} as const;

/**
 * Returns `goNext(from)`: call it when a step is finished. It opens the next screen the
 * site/employee needs, or records the punch and opens the success screen.
 * `from` is 'start' right after an employee is tapped.
 */
export function usePunchNavigator() {
  const router = useRouter();
  const companyId = useDeviceStore((s) => s.companyId);

  // Same key as the questions screen, so this is one shared fetch.
  const { data: questions } = useQuery({
    queryKey: ['kiosk-questions', companyId],
    queryFn: () => kioskService.getQuestions(companyId),
    staleTime: 5 * 60_000,
  });
  const questionCount = useRef(0);
  questionCount.current = questions?.length ?? 0;

  return useCallback(
    async (from: 'start' | PunchStep): Promise<void> => {
      const session = useSessionStore.getState();
      const { employee, clockType } = session;
      if (!employee || !clockType) {
        router.replace('/(kiosk)');
        return;
      }

      const step = nextStep(from, {
        config: useConfigStore.getState().config,
        employee,
        eventType: clockType,
        questionCount: questionCount.current,
      });

      if (step !== 'commit') {
        router.push(ROUTES[step]);
        return;
      }

      try {
        const { eventLogId } = await commitPunch({
          employee,
          eventType: clockType,
          pin: session.pin ?? undefined,
          photoUri: session.capturedPhotoUri ?? undefined,
          answers: session.answers,
        });
        session.setCommitted(eventLogId);
      } catch {
        // The punch could not be saved on this tablet (for example storage is full).
        session.setCommitError(true);
      }
      router.replace('/(kiosk)/success');
    },
    [router]
  );
}
```

- [ ] **Step 7: Update the employee list screen**

In `ShiftWork.Kiosk/app/(kiosk)/index.tsx`:

Replace `import { useCallback, useRef, useState } from 'react';` with:

```ts
import { useCallback, useMemo, useRef, useState } from 'react';
```

Add after `import { useSessionStore } from '@/store/sessionStore';`:

```ts
import { useConfigStore } from '@/store/configStore';
import { usePunchNavigator } from '@/hooks/usePunchNavigator';
import { nextEventType } from '@/services/punchFlow';
import { applyPendingStatus } from '@/services/outbox.service';
import { useOutboxStatus } from '@/services/outbox';
```

Replace this block:

```ts
  const companyId = useDeviceStore((s) => s.companyId);
  const setEmployee = useSessionStore((s) => s.setEmployee);
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['kiosk-employees', companyId],
    queryFn: () => kioskService.getEmployees(companyId),
    refetchInterval: 45_000, // auto-refresh every 45 s
    staleTime: 30_000,
  });

  const filtered = (data ?? []).filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectEmployee = useCallback(
    async (employee: KioskEmployee) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setEmployee(employee);
      router.push('/(kiosk)/pin');
    },
    [router, setEmployee]
  );
```

with:

```ts
  const companyId = useDeviceStore((s) => s.companyId);
  const locationId = useDeviceStore((s) => s.locationId);
  const startPunch = useSessionStore((s) => s.startPunch);
  const refreshConfig = useConfigStore((s) => s.refresh);
  const goNext = usePunchNavigator();
  const { entries } = useOutboxStatus();
  const [search, setSearch] = useState('');
  const busyRef = useRef(false);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['kiosk-employees', companyId],
    queryFn: () => kioskService.getEmployees(companyId),
    refetchInterval: 45_000, // auto-refresh every 45 s
    staleTime: 30_000,
  });

  // Keep the site's PIN/photo switches fresh on the same 45 s cadence.
  useQuery({
    queryKey: ['kiosk-config', companyId, locationId],
    queryFn: async () => {
      await refreshConfig(companyId, locationId);
      return true;
    },
    refetchInterval: 45_000,
    staleTime: 30_000,
  });

  // Server status with this tablet's own unsent punches applied, so In/Out stays right offline.
  const employees = useMemo(() => applyPendingStatus(data ?? [], entries), [data, entries]);
  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectEmployee = useCallback(
    async (employee: KioskEmployee) => {
      // A second tap while the first is still being processed must not punch twice.
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        startPunch(employee, nextEventType(employee.statusShiftWork));
        await goNext('start');
      } finally {
        setTimeout(() => {
          busyRef.current = false;
        }, 1000);
      }
    },
    [startPunch, goNext]
  );
```

(`router` and `useRouter` may now be unused in this file; remove them if lint complains.)

- [ ] **Step 8: Update the PIN screen**

In `ShiftWork.Kiosk/app/(kiosk)/pin.tsx`:

Add after `import { useSessionStore } from '@/store/sessionStore';`:

```ts
import { usePunchNavigator } from '@/hooks/usePunchNavigator';
```

Add after `const employee = useSessionStore((s) => s.employee);`:

```ts
  const setPin = useSessionStore((s) => s.setPin);
  const goNext = usePunchNavigator();
```

Replace:

```ts
        if (verified) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.push('/(kiosk)/clock');
```

with:

```ts
        if (verified) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setPin(submittedPin);
          await goNext('pin');
```

and replace the dependency list `[employee, loading, router, resetTimeout, t]` with `[employee, loading, router, resetTimeout, t, setPin, goNext]`.

(No change is needed for an offline PIN attempt: `verifyPin` now times out in 5 s and the existing catch block shows `kiosk_app.pin_failed`, "Verification failed. Check your connection.")

- [ ] **Step 9: Run the tests (do not commit yet)**

Run: `cd ShiftWork.Kiosk && npm test`
Expected: all suites PASS.

`npm run type-check` will still report errors in `clock.tsx`, `questions.tsx` and `success.tsx`, because they use session fields this task removed. That is expected: Task 9 rewrites them, and Tasks 8 and 9 are committed together at the end of Task 9. Continue straight into Task 9.

---

### Task 9: Auto-capture photo, questions, and the success screen with Undo

**Files:**
- Modify: `ShiftWork.Kiosk/app/(kiosk)/clock.tsx` (rewrite), `ShiftWork.Kiosk/app/(kiosk)/questions.tsx`, `ShiftWork.Kiosk/app/(kiosk)/success.tsx` (rewrite)

**Interfaces:**
- Consumes: `usePunchNavigator`, session fields and actions (Task 8), `outbox.undo`, `forgetRecentPunch`, `shouldShowInterstitial`, `UNDO_HOLD_MS` (Tasks 6–8). i18n keys added in Task 10: `kiosk_app.photo_countdown` (`{{count}}`), `kiosk_app.photo_retry`, `kiosk_app.undo`, `kiosk_app.punch_cancelled`, `kiosk_app.commit_error_title`, `kiosk_app.commit_error_body`, `kiosk_app.commit_error_ok`.
- Produces: the finished kiosk flow. Nothing later depends on these screens.

These are UI screens; the repo has no component tests, so the checks are the type-check plus the manual run in Task 10. The decisions they make (which screen comes next, when the interstitial is skipped, the double-tap guard) are already covered by the tests in Tasks 6 and 8.

- [ ] **Step 1: Rewrite the photo screen**

Replace the whole of `ShiftWork.Kiosk/app/(kiosk)/clock.tsx` with (the file name stays `clock.tsx` so the route `/(kiosk)/clock` keeps working; it is now only the photo step):

```tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { useSessionStore } from '@/store/sessionStore';
import { usePunchNavigator } from '@/hooks/usePunchNavigator';
import { colors, spacing, radius, typography, shadow } from '@/styles/tokens';
import { useTranslation } from '@/i18n';

const TIMEOUT_MS = 60_000;
const COUNTDOWN_SECONDS = 1;

/**
 * Photo step. Only opened when the site requires a photo and the employee is not exempt
 * (see nextStep). Takes the picture by itself after a short countdown; a manual button
 * appears only if that fails.
 */
export default function PhotoScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const employee = useSessionStore((s) => s.employee);
  const clockType = useSessionStore((s) => s.clockType);
  const setCapturedPhoto = useSessionStore((s) => s.setCapturedPhoto);
  const goNext = usePunchNavigator();

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [capturing, setCapturing] = useState(false);
  const [failed, setFailed] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Idle timeout: back to the employee list if nothing happens.
  useEffect(() => {
    timeoutRef.current = setTimeout(() => router.replace('/(kiosk)'), TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [router]);

  useEffect(() => {
    if (!employee) router.replace('/(kiosk)');
  }, [employee, router]);

  const capture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    setFailed(false);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: false,
        skipProcessing: Platform.OS === 'android',
      });
      if (!photo) throw new Error('No photo captured');
      setCapturedPhoto(photo.uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await goNext('photo');
    } catch {
      setFailed(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCapturing(false);
    }
  }, [capturing, setCapturedPhoto, goNext]);

  // Count down once the camera is live, then capture.
  useEffect(() => {
    if (!cameraReady || failed || capturing) return undefined;
    if (count <= 0) {
      void capture();
      return undefined;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cameraReady, failed, capturing, count, capture]);

  if (!employee) return null;

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>{t('kiosk_app.camera_required')}</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>{t('kiosk_app.grant_camera')}</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(kiosk)')}>
          <Text style={styles.cancel}>{t('kiosk_app.cancel')}</Text>
        </Pressable>
      </View>
    );
  }

  const action = clockType === 'ClockOut' ? t('kiosk_app.clock_out') : t('kiosk_app.clock_in');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          onCameraReady={() => setCameraReady(true)}
        />
        <View style={styles.viewfinder} pointerEvents="none" />
        <View style={styles.cameraOverlay}>
          <Text style={styles.cameraLabel}>
            {t('kiosk_app.look_at_camera', { action })}
          </Text>
          {failed ? (
            <Pressable
              style={({ pressed }) => [styles.captureBtn, pressed && { opacity: 0.8 }]}
              onPress={capture}
              disabled={capturing}
            >
              <Ionicons name="camera" size={40} color="#fff" />
            </Pressable>
          ) : (
            <Text style={styles.countdown}>
              {capturing || count <= 0
                ? t('kiosk_app.recording')
                : t('kiosk_app.photo_countdown', { count })}
            </Text>
          )}
          {failed && <Text style={styles.cancel}>{t('kiosk_app.photo_retry')}</Text>}
          <Pressable onPress={() => router.replace('/(kiosk)')}>
            <Text style={styles.cancel}>{t('kiosk_app.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, padding: spacing.xxl },
  cameraContainer: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  viewfinder: {
    position: 'absolute',
    top: '10%',
    bottom: '28%',
    left: '20%',
    right: '20%',
    borderRadius: 9999,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingTop: spacing.xl,
  },
  cameraLabel: { ...typography.title, color: '#fff' },
  countdown: { ...typography.h3, color: '#fff' },
  captureBtn: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    ...shadow.raised,
  },
  permText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  btnText: { ...typography.title, color: colors.textOnPrimary },
  cancel: { ...typography.label, color: colors.textMuted, marginTop: spacing.sm },
});
```

- [ ] **Step 2: Make the questions screen hand off instead of sending**

In `ShiftWork.Kiosk/app/(kiosk)/questions.tsx`:

Add after `import { useTranslation } from '@/i18n';`:

```ts
import { usePunchNavigator } from '@/hooks/usePunchNavigator';
```

Replace:

```ts
  const clockType = useSessionStore((s) => s.clockType);
  const capturedPhotoUri = useSessionStore((s) => s.capturedPhotoUri);
  const geoLocation = useSessionStore((s) => s.geoLocation);
  const { companyId, locationId, kioskDeviceId } = useDeviceStore();
```

with:

```ts
  const clockType = useSessionStore((s) => s.clockType);
  const setAnswers = useSessionStore((s) => s.setAnswers);
  const { companyId } = useDeviceStore();
  const goNext = usePunchNavigator();
```

Replace this block inside `handleSubmit`:

```ts
      await kioskService.clock(companyId, {
        personId: employee.personId,
        eventType: clockType,
        locationId: locationId || undefined,
        photoUrl: capturedPhotoUri ?? undefined,
        geoLocation: geoLocation ?? undefined,
        kioskDevice: kioskDeviceId,
        answers: answerList,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(kiosk)/success');
```

with:

```ts
      // The punch is recorded (and later sent) by the navigator, with these answers.
      setAnswers(answerList);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await goNext('questions');
```

and replace the dependency list `[employee, clockType, questions, answers, companyId, locationId, capturedPhotoUri, geoLocation, kioskDeviceId, router, t]` with `[employee, clockType, questions, answers, setAnswers, goNext, t]`.

- [ ] **Step 3: Rewrite the success screen with Undo**

Replace the whole of `ShiftWork.Kiosk/app/(kiosk)/success.tsx` with:

```tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { outbox } from '@/services/outbox';
import { UNDO_HOLD_MS } from '@/services/outbox.service';
import { forgetRecentPunch } from '@/services/punch.service';
import { shouldShowInterstitial } from '@/services/punchFlow';
import { useSessionStore } from '@/store/sessionStore';
import { colors, spacing, radius, typography } from '@/styles/tokens';
import { useTranslation } from '@/i18n';

/**
 * Shown right after a punch is recorded on this tablet (sending happens in the background).
 * For the 3-second undo window the employee can cancel it; then the kiosk moves on:
 * to the bulletins/safety screen after an online clock-out, otherwise straight home.
 */
export default function SuccessScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const employee = useSessionStore((s) => s.employee);
  const clockType = useSessionStore((s) => s.clockType);
  const eventLogId = useSessionStore((s) => s.eventLogId);
  const commitError = useSessionStore((s) => s.commitError);
  const resetSession = useSessionStore((s) => s.reset);

  const [undone, setUndone] = useState(false);
  const [eventTime] = useState(() =>
    new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  );
  const scale = useRef(new Animated.Value(0)).current;

  const goHome = useCallback(() => {
    resetSession();
    router.replace('/(kiosk)');
  }, [resetSession, router]);

  useEffect(() => {
    Haptics.notificationAsync(
      commitError ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success
    );
    Animated.sequence([
      Animated.delay(100),
      Animated.spring(scale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the undo window closes, move on.
  useEffect(() => {
    if (commitError || undone) return undefined;
    const id = setTimeout(() => {
      const entries = outbox.getSnapshot().entries;
      if (employee && shouldShowInterstitial(clockType, entries)) {
        router.replace(`/(kiosk)/interstitial?personId=${employee.personId}` as any);
      } else {
        goHome();
      }
    }, UNDO_HOLD_MS);
    return () => clearTimeout(id);
  }, [commitError, undone, clockType, employee, router, goHome]);

  const handleUndo = useCallback(async () => {
    if (!eventLogId || !employee) return;
    const removed = await outbox.undo(eventLogId);
    if (!removed) return; // window already closed
    forgetRecentPunch(employee.personId);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setUndone(true);
    setTimeout(goHome, 1200);
  }, [eventLogId, employee, goHome]);

  if (commitError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]}>
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={112} color={colors.danger} />
          <Text style={styles.errTitle}>{t('kiosk_app.commit_error_title')}</Text>
          <Text style={styles.errBody}>{t('kiosk_app.commit_error_body')}</Text>
          <Pressable style={styles.okBtn} onPress={goHome}>
            <Text style={styles.okText}>{t('kiosk_app.commit_error_ok')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const label = clockType === 'ClockIn' ? t('kiosk_app.clocked_in') : t('kiosk_app.clocked_out');
  const bgColor = clockType === 'ClockIn' ? colors.clockIn : colors.clockOut;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]}>
      <View style={styles.center}>
        <Animated.View style={[styles.iconWrapper, { transform: [{ scale }] }]}>
          <Ionicons name={undone ? 'close-circle' : 'checkmark-circle'} size={128} color="#fff" />
        </Animated.View>

        <Text style={styles.name}>{employee?.name ?? t('kiosk_app.employee_fallback')}</Text>
        {undone ? (
          <Text style={styles.label}>{t('kiosk_app.punch_cancelled')}</Text>
        ) : (
          <>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.time}>{eventTime}</Text>
            <Pressable
              style={({ pressed }) => [styles.undoBtn, pressed && { opacity: 0.7 }]}
              onPress={handleUndo}
              accessibilityRole="button"
            >
              <Text style={styles.undoText}>{t('kiosk_app.undo')}</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  iconWrapper: { marginBottom: spacing.sm },
  name: { fontSize: 34, fontWeight: '700' as const, color: '#fff', textAlign: 'center', letterSpacing: 0.37 },
  label: { fontSize: 22, fontWeight: '300' as const, color: 'rgba(255,255,255,0.8)', letterSpacing: -0.2 },
  time: { fontSize: 48, fontWeight: '200' as const, color: 'rgba(255,255,255,0.9)', letterSpacing: -2, marginTop: spacing.sm },
  undoBtn: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  undoText: { ...typography.title, color: '#fff' },
  errTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  errBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', maxWidth: 420 },
  okBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  okText: { ...typography.title, color: colors.textOnPrimary },
});
```

- [ ] **Step 4: Type-check (Tasks 8 and 9 land together)**

Run: `cd ShiftWork.Kiosk && npm run type-check`
Expected: no errors. If `router.push(ROUTES[step])` in `usePunchNavigator.ts` is rejected by typed routes, cast it: `router.push(ROUTES[step] as never)`. Use the same cast for `router.replace(\`/(kiosk)/interstitial?...\`)`, which already uses `as any` in the original code.

- [ ] **Step 5: Run the tests and commit Tasks 8 and 9 together**

The screens only type-check as a set, so Tasks 8 and 9 are committed together.

Run: `cd ShiftWork.Kiosk && npm test && npm run type-check`
Expected: all suites PASS; no type errors.

```bash
git add ShiftWork.Kiosk
git commit -m "feat(kiosk): one-tap punch flow with auto In/Out, auto-capture photo, undo and background send"
```

---

### Task 10: Sync badge, translations, and end-to-end verification

**Files:**
- Modify: `ShiftWork.Kiosk/i18n/translations/en.ts`, `ShiftWork.Kiosk/i18n/translations/es.ts`, `ShiftWork.Kiosk/app/(admin)/index.tsx`
- Create: `ShiftWork.Kiosk/components/OutboxStatusCard.tsx`
- Test: the existing `ShiftWork.Kiosk/i18n/__tests__/parity.test.ts` (checks en/es keys and `{{placeholders}}` match)

**Interfaces:**
- Consumes: `useOutboxStatus` (Task 7); the keys Task 9 uses.
- Produces: the admin sync badge and all new strings.

- [ ] **Step 1: Add the English strings**

In `ShiftWork.Kiosk/i18n/translations/en.ts`, inside `"kiosk_app": {`, add after the line `"tap_hint": "Tap your name to clock in or out",`:

```ts
    "undo": "Undo",
    "punch_cancelled": "Punch cancelled",
    "photo_countdown": "Taking photo in {{count}}…",
    "photo_retry": "Could not take the photo. Tap the camera to try again.",
    "sync_waiting": "{{count}} waiting to sync",
    "sync_failed": "{{count}} could not be sent. Check with your supervisor.",
    "sync_over_cap": "Too many unsent punches. Connect this kiosk to the internet.",
    "commit_error_title": "Could not save your punch",
    "commit_error_body": "This kiosk could not save your punch. Tell your supervisor.",
    "commit_error_ok": "OK",
```

- [ ] **Step 2: Add the Spanish strings**

In `ShiftWork.Kiosk/i18n/translations/es.ts`, inside `"kiosk_app": {`, add after the line `"tap_hint": "Toca tu nombre para marcar entrada o salida",`:

```ts
    "undo": "Deshacer",
    "punch_cancelled": "Marcación cancelada",
    "photo_countdown": "Tomando la foto en {{count}}…",
    "photo_retry": "No se pudo tomar la foto. Toca la cámara para intentar de nuevo.",
    "sync_waiting": "{{count}} pendientes de sincronizar",
    "sync_failed": "{{count}} no se pudieron enviar. Consulta a tu supervisor.",
    "sync_over_cap": "Demasiadas marcaciones sin enviar. Conecta este kiosco a internet.",
    "commit_error_title": "No se pudo guardar tu marcación",
    "commit_error_body": "Este kiosco no pudo guardar tu marcación. Avisa a tu supervisor.",
    "commit_error_ok": "Aceptar",
```

- [ ] **Step 3: Run the parity test**

Run: `cd ShiftWork.Kiosk && npm test -- parity`
Expected: PASS (every en key exists in es and vice versa; `{{count}}` placeholders match).

- [ ] **Step 4: Add the sync badge**

Create `ShiftWork.Kiosk/components/OutboxStatusCard.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { useOutboxStatus } from '@/services/outbox';
import { colors, spacing, radius, typography } from '@/styles/tokens';
import { useTranslation } from '@/i18n';

/** Admin-only: how many punches are waiting to send, could not be sent, or have piled up too long. */
export function OutboxStatusCard() {
  const { t } = useTranslation();
  const { pendingCount, failedCount, overCap } = useOutboxStatus();

  if (pendingCount === 0 && failedCount === 0 && !overCap) return null;

  return (
    <View style={styles.card}>
      {pendingCount > 0 && (
        <Text style={styles.text}>{t('kiosk_app.sync_waiting', { count: pendingCount })}</Text>
      )}
      {failedCount > 0 && (
        <Text style={[styles.text, styles.bad]}>{t('kiosk_app.sync_failed', { count: failedCount })}</Text>
      )}
      {overCap && <Text style={[styles.text, styles.bad]}>{t('kiosk_app.sync_over_cap')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  text: { ...typography.body, color: colors.text },
  bad: { color: colors.danger },
});
```

In `ShiftWork.Kiosk/app/(admin)/index.tsx`, add after `import { useTranslation } from '@/i18n';`:

```ts
import { OutboxStatusCard } from '@/components/OutboxStatusCard';
```

and add the card directly under the current-location line in the menu step, i.e. after:

```tsx
            <Text style={styles.subtitle}>{t('kiosk_app.current_location', { location: locationName })}</Text>
```

insert:

```tsx
            <OutboxStatusCard />
```

- [ ] **Step 5: Full automated check**

Run: `cd ShiftWork.Kiosk && npm test && npm run type-check && npm run lint`
Expected: all suites PASS; no type errors; lint clean (fix any unused-import warnings left over from Tasks 8–9, such as `useRouter` in `index.tsx` or `kioskService` in `questions.tsx` if it is no longer used there).

Run: `dotnet test ShiftWork.Api.Tests` and `cd ShiftWork.Angular && npm run build`
Expected: both succeed.

- [ ] **Step 6: Manual test on a tablet (development build with the new native modules)**

Set up two Locations in the admin: **Site A** (PIN off, photo off) and **Site B** (PIN on, photo on). Give one employee "No photo required". Then check each row:

| # | Do this | Expect |
|---|---|---|
| 1 | Enroll the kiosk to Site A. Tap a name. | The success screen appears at once; no PIN, no camera; label says Clocked In; Undo visible for about 3 s; then the list returns. |
| 2 | Tap the same name again after it returns. | Clocked **Out** (auto), then bulletins/safety if any exist. |
| 3 | Tap a name, then Undo within 3 s. | "Punch cancelled"; the employee is unchanged; tapping again works right away. |
| 4 | Double-tap a name card fast. | One punch only. |
| 5 | Turn on airplane mode; punch three employees at Site A. | Each succeeds at once; admin menu shows "3 waiting to sync"; turn airplane mode off: the count drops to 0 within about 10 s and the three punches appear in the timesheet with their **real tap times**. |
| 6 | While offline, punch the same employee In then (after 3 s) Out. | The list shows In then Out correctly; both reach the server in that order after reconnecting. |
| 7 | Enroll to Site B. Tap a name. | PIN screen, then the camera counts down 1 s and takes the photo by itself, then success. |
| 8 | At Site B tap the photo-exempt employee. | PIN screen, then success with **no** camera. |
| 9 | At Site B in airplane mode, tap a name and enter a PIN. | Within 5 s: "Verification failed. Check your connection." (no long spinner). |
| 10 | Clock-out at a site with active kiosk questions. | Questions appear after PIN/photo; clock-in shows none. |
| 11 | After a punch with a photo, open it in the web app. | The photo loads from S3 (an `https` URL, not a `file://` path). |
| 12 | Change Site A to "Require PIN" in the admin; wait 60 s. | The kiosk starts asking for a PIN without a restart. |

- [ ] **Step 7: Roll out**

1. Deploy the API (the migration runs; existing Locations stay PIN-on and photo-on).
2. Install the new kiosk build on every tablet.
3. Only after **all** tablets run the new build, set `KioskSettings:EnforcePinOnClock` to `true` in the API configuration (decision D2).

- [ ] **Step 8: Commit**

```bash
git add ShiftWork.Kiosk
git commit -m "feat(kiosk): add admin sync badge and translations for the fast punch flow"
```
