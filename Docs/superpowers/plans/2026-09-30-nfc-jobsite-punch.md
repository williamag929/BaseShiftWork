# NFC Jobsite Punch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an employee clock in or out by tapping their own phone on an NFC tag at a jobsite, and let a Location require that tap for phone punches.

**Architecture:**
- **Tag and punch.** Each Location gets a server-owned random tag key. The tag holds the link `https://t.loqzen.com/t/<key>`.
- **Server.** A new `POST nfc-punch` endpoint maps the key to the site, picks In or Out from the employee's status, and records the punch through the existing `ShiftEventService`, so the geofence flag is computed exactly as today. `POST shiftevents` rejects the employee's own phone punch at a `RequireNfc` site with `NFC_REQUIRED`.
- **Tag host.** The API also serves the app-link files and a fallback page for the tag host.
- **Apps.**
  - The Angular location form manages the flag and the tag link.
  - The Mobile app opens from the tag link (universal/app link) or scans in-app with `react-native-nfc-manager`.
  - Managers write tags from a Mobile screen.

**Tech Stack:**
- **API:** ASP.NET Core (net9.0) + EF Core 8 (SQL Server), with xUnit + Moq + EF InMemory for tests.
- **Web:** Angular 19.
- **Mobile:** Expo 54 / React Native 0.81 with expo-router 6, TanStack Query, Zustand and jest-expo. New dependencies: `react-native-nfc-manager` 3.17.2 and `expo-crypto`.

**Spec:** `Docs/superpowers/specs/2026-09-30-nfc-jobsite-punch-design.md`

## Global Constraints

**Naming and copy**
- Code, folders and namespaces stay `ShiftWork.*`. User-visible text says **Loqzen**.
- Bundle id / Android package: `com.loqzen.mobile`.

**Tag link and key**
- Tag link format, exactly: `https://t.loqzen.com/t/<tagKey>`. Host constant `t.loqzen.com`, path prefix `/t/`.
- Tag key: 16 random bytes (`RandomNumberGenerator`), base64url with no padding, which gives 22 chars from `[A-Za-z0-9_-]`. The column is `nvarchar(64)`, nullable, with a unique index.
- The key is **server-owned**. Clients never set it. It is created the first time `RequireNfc` is turned on, or by "Regenerate / Create tag link". Turning `RequireNfc` off keeps the key, so an installed tag keeps working at an optional site.
- An NFC punch works at **any** Location that has a tag key. `RequireNfc` only controls whether the phone's clock button is allowed there.

**Punch rules**
- A tap is automatic In/Out, taken from `Person.StatusShiftWork`: a value starting with `OnShift` means Out, anything else means In. There is no photo and no PIN.
- Trust model: tag + GPS. An out-of-range punch, or one without GPS, is **recorded and flagged** (`GeofenceStatus` `Outside` / `Unknown`), never refused.
- The event date window is shared with the kiosk: at most **7 days** in the past and at most **5 minutes** in the future.
- Repeat-tap window: **60 seconds**. A second tap by the same person at the same site within 60 s of their last NFC punch records nothing and returns the earlier punch with `repeated: true`.
- NFC punches are stored with `Description = "NFC tap"`, `LocationId` = the tag's Location, and `KioskDevice` = the phone model.

**Error codes**
- Error response body: `{ "code": "<CODE>", "message": "<text>" }`. Codes:
  - `NFC_REQUIRED` (403)
  - `TAG_NOT_FOUND` (404)
  - `EVENT_ID_CONFLICT` (409)
  - `TRANSITION_CONFLICT` (409)
  - `NOT_AN_EMPLOYEE` (403)
  - `TAG_MISSING`, `EVENT_ID_MISSING`, `EVENT_DATE_INVALID` (400)

**The NFC_REQUIRED rule**
- The rule applies only when the caller's JWT `personId` claim equals the DTO's `PersonId`. That claim exists only on the Mobile app's API JWT.
- Angular (Firebase token, no `personId` claim), manager entries for someone else, and kiosk punches (`/api/kiosk/.../clock`) are never affected.
- Known limit, accepted: the rule needs a site. That is the DTO `locationId`, or else today's schedule. With neither, the punch is allowed.

**Out of scope**
- No QR fallback, no Undo, no offline queue for taps (offline shows "No connection, try again"), and no crew punch.

**Build and environment**
- Mobile NFC needs a development/EAS build. Expo Go cannot use NFC.
- The committed `ShiftWork.Mobile/android/` folder (stale `com.joblogsmart.mobile`) is removed. Android is generated from `app.json` by EAS (Continuous Native Generation), as iOS already is.
- **No .NET SDK in the sandbox.** C# cannot be compiled or tested locally.
  - API implementers write carefully, say "not compiled locally" in their report, and push.
  - The controller opens a **draft PR** after Task 1 so `pr-tests.yml` compiles and tests every push, and checks CI with `gh api` before approving an API task.
- **Mobile translations:**
  - Add keys to `translations-source/strings.json`, then run `npm run validate && npm run generate:rn` in `translations-source/`.
  - Then run `git checkout -- ShiftWork.Kiosk/i18n`: the generator drops 11 kiosk keys that were added by hand earlier.
  - **Never** run `generate:angular`, which is lossy. Angular strings are added by hand to both `.xlf` files.

## Review Focus

1. **Double tap or double NFC dispatch.** A second tap within a minute must not clock the employee straight back out. Pinned by `SecondTapWithinAMinute_IsRepeated_AndRecordsNothing` (Task 3).
2. **Cold start from a tag while signed in.** The root layout's "restore session then go to dashboard" redirect must not replace the `/t/<key>` screen before the punch runs. Pinned by `isTagLaunchUrl` tests (Task 7) and the `_layout` change that uses it.
3. **Retry after a timeout the server actually saved.** "Try again" must reuse the same `eventLogId` and must not record a second punch. Pinned by `retry reuses the eventLogId` (Task 7) and `SameEventLogId_ReturnsOriginal` (Task 3).
4. **Angular saves the whole location object back** (it spreads `selectedLocation`, including `nfcTagKey`). A save must never change or clear the key. Pinned by `DtoToModel_IgnoresTagFields` and `Update_KeepsServerKey_WhenClientSendsAnother` (Task 1).
5. **Location permission denied or GPS slow.** The tap must still punch (flagged `Unknown`), not hang or fail. Pinned by `posts without geoLocation when there is no fix` (Task 7), `quick location times out` (Task 7) and `TapWithoutGps_IsRecorded_AsUnknown` (Task 3).

---

## File Structure

**API (`ShiftWork.Api`)**
- Modify `Models/Location.cs`: add `RequireNfc`, `NfcTagKey`, `NfcLastTappedAt`.
- Modify `Data/ShiftWorkContext.cs`: `NfcTagKey` max length 64 plus a unique index.
- Create `Migrations/20260930000100_AddNfcPunch.cs` and `.Designer.cs`; modify `Migrations/ShiftWorkContextModelSnapshot.cs`.
- Create `Helpers/NfcTagKeys.cs`: key generator and tag-URL constant.
- Modify `DTOs/LocationDto.cs`. Create `DTOs/NfcDtos.cs` (`NfcTagLinkDto`, `NfcPunchRequest`, `NfcPunchResponse`).
- Modify `Helpers/MappingProfiles.cs`: DTO→model ignores the tag fields.
- Modify `Services/LocationService.cs`: key on create/enable, regenerate, tag-link list.
- Modify `Controllers/LocationsController.cs`: `GET nfc-tags`, `POST {id}/nfc-tag/regenerate`.
- Create `Services/NfcRequiredException.cs`. Modify `Services/IShiftEventService.cs` and `Services/ShiftEventService.cs` (`EnsureNfcNotRequiredAsync` and the shared schedule lookup).
- Modify `Controllers/ShiftEventsController.cs`: apply the rule to own-phone punches.
- Create `Services/PunchTime.cs`: the shared date window. Modify `Services/KioskService.cs` to use it.
- Create `Services/NfcPunchService.cs` (with `INfcPunchService`) and `Services/NfcPunchRejectedException.cs`.
- Create `Controllers/NfcPunchController.cs`. Register in `Program.cs`.
- Create `Controllers/TagLinksController.cs`: AASA, assetlinks and the `/t/{key}` fallback page. Modify `appsettings.json` (`NfcTags` section).

**API tests (`ShiftWork.Api.Tests`)**
- `Locations/LocationServiceNfcTests.cs`
- `ShiftEvents/ShiftEventServiceNfcRequiredTests.cs`
- `ShiftEvents/ShiftEventsControllerNfcTests.cs`
- `Nfc/NfcPunchServiceTests.cs`
- `Nfc/NfcPunchControllerTests.cs`
- `Nfc/TagLinksControllerTests.cs`

**Angular (`ShiftWork.Angular/src`)**
- Modify:
  - `app/core/models/location.model.ts`
  - `app/core/services/location.service.ts`
  - `app/features/dashboard/locations/locations.component.{ts,html,css}`
  - `locale/messages.xlf` and `locale/messages.es.xlf`

**Mobile (`ShiftWork.Mobile`)**
- **Config and native:**
  - Modify `app.json` and `.gitignore`; delete `android/`.
  - Create `plugins/withNfcTagIntent.js` (+ `plugins/__tests__/withNfcTagIntent.test.js`).
  - Create `__mocks__/react-native-nfc-manager.ts`.
- **Utilities and services:**
  - Create `utils/nfcTag.ts` (+ test).
  - Create `services/nfc.service.ts` (+ test) and `services/nfc-punch.service.ts` (+ test).
  - Modify `types/api.ts` and `utils/location.utils.ts` (`getQuickLocation`, + test).
- **Tap flow:**
  - Create `store/pendingTagStore.ts`, `hooks/useNfcPunch.ts` (+ test) and `hooks/useNfcAvailability.ts`.
  - Create `components/screens/nfc/NfcPunchResultView.tsx` (+ test) and `app/t/[tagKey].tsx`.
  - Modify `app/_layout.tsx` and `app/(tabs)/_layout.tsx`.
- **Clock screen:**
  - Modify `hooks/queries/index.ts` (`useLocationDetails`, `useNfcTagLinks`), `hooks/useClockAction.ts` (+ test update) and `app/(tabs)/clock.tsx`.
  - Create `components/screens/clock/NfcClockPanel.tsx` (+ test).
- **Write tag:**
  - Create `app/nfc/write-tag.tsx` (+ test) and `components/screens/profile/NfcWriteTagEntry.tsx`.
  - Modify `app/(tabs)/profile.tsx`.
- **Strings:** modify `translations-source/strings.json`, which generates `ShiftWork.Mobile/i18n/translations/{en,es}.ts`.

**Docs**
- Create `Docs/nfc-tags-setup.md`: host, app-link files, keys needed from William, build and test on devices, writing tags, rollout order.

---

### Task 1: Location NFC fields, migration and tag-link management (API)

**Files:**
- Modify: `ShiftWork.Api/Models/Location.cs`
- Modify: `ShiftWork.Api/Data/ShiftWorkContext.cs:75`
- Create: `ShiftWork.Api/Migrations/20260930000100_AddNfcPunch.cs`
- Create: `ShiftWork.Api/Migrations/20260930000100_AddNfcPunch.Designer.cs`
- Modify: `ShiftWork.Api/Migrations/ShiftWorkContextModelSnapshot.cs` (the Location entity block that starts near line 915)
- Create: `ShiftWork.Api/Helpers/NfcTagKeys.cs`
- Modify: `ShiftWork.Api/DTOs/LocationDto.cs`
- Create: `ShiftWork.Api/DTOs/NfcDtos.cs`
- Modify: `ShiftWork.Api/Helpers/MappingProfiles.cs:33-35`
- Modify: `ShiftWork.Api/Services/LocationService.cs`
- Modify: `ShiftWork.Api/Controllers/LocationsController.cs`
- Test: `ShiftWork.Api.Tests/Locations/LocationServiceNfcTests.cs`

**Interfaces:**
- Produces:
  - `Location.RequireNfc` (bool), `Location.NfcTagKey` (string?) and `Location.NfcLastTappedAt` (DateTime?), with the same three on `LocationDto`.
  - `NfcTagKeys.NewKey(): string` and `NfcTagKeys.TagUrlBase = "https://t.loqzen.com/t/"`.
  - `NfcTagLinkDto { int LocationId; string Name; bool RequireNfc; string? TagUrl; DateTime? NfcLastTappedAt }`.
  - `ILocationService.RegenerateNfcTagAsync(string companyId, int locationId): Task<Location?>` and `ILocationService.GetNfcTagLinksAsync(string companyId): Task<List<NfcTagLinkDto>>`.
  - HTTP: `GET /api/companies/{companyId}/locations/nfc-tags` (policy `locations.update`) returns `NfcTagLinkDto[]`.
  - HTTP: `POST /api/companies/{companyId}/locations/{locationId}/nfc-tag/regenerate` (policy `locations.update`) returns `LocationDto`, or 404.

- [ ] **Step 1: Write the failing tests**

Create `ShiftWork.Api.Tests/Locations/LocationServiceNfcTests.cs`:

```csharp
using System.Text.RegularExpressions;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Locations;

public class LocationServiceNfcTests : IDisposable
{
    private const string CompanyId = "nfc-co";
    private static readonly Regex KeyShape = new("^[A-Za-z0-9_-]{22}$");
    private readonly ShiftWorkContext _context;
    private readonly LocationService _service;

    public LocationServiceNfcTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ShiftWorkContext(options);
        _service = new LocationService(_context, NullLogger<LocationService>.Instance);
    }

    public void Dispose() => _context.Dispose();

    private static Location NewLocation(int id, string companyId = CompanyId, bool requireNfc = false, string status = "Active") => new()
    {
        LocationId = id, CompanyId = companyId, Name = $"Site {id}", Address = "1 Main",
        City = "", State = "", Country = "US", ZipCode = "00000", GeoCoordinates = "{}",
        RatioMax = 100, Status = status, TimeZone = "UTC", RequireNfc = requireNfc,
    };

    [Fact]
    public async Task Add_WithRequireNfc_CreatesAUrlSafeKey()
    {
        var created = await _service.Add(NewLocation(1, requireNfc: true));
        Assert.Matches(KeyShape, created.NfcTagKey);
    }

    [Fact]
    public async Task Add_WithoutRequireNfc_HasNoKey()
    {
        var created = await _service.Add(NewLocation(1));
        Assert.Null(created.NfcTagKey);
    }

    [Fact]
    public async Task Update_TurningRequireNfcOn_CreatesTheKeyOnce()
    {
        await _service.Add(NewLocation(1));

        var first = await _service.Update(NewLocation(1, requireNfc: true));
        var key = first.NfcTagKey;
        var second = await _service.Update(NewLocation(1, requireNfc: true));

        Assert.Matches(KeyShape, key);
        Assert.Equal(key, second.NfcTagKey);
    }

    [Fact]
    public async Task Update_TurningRequireNfcOff_KeepsTheKey()
    {
        var created = await _service.Add(NewLocation(1, requireNfc: true));
        var key = created.NfcTagKey;

        var updated = await _service.Update(NewLocation(1, requireNfc: false));

        Assert.False(updated.RequireNfc);
        Assert.Equal(key, updated.NfcTagKey);
    }

    [Fact]
    public async Task Update_KeepsServerKey_WhenClientSendsAnother()
    {
        var created = await _service.Add(NewLocation(1, requireNfc: true));
        var key = created.NfcTagKey;
        var fromClient = NewLocation(1, requireNfc: true);
        fromClient.NfcTagKey = "client-chosen-key-000000";
        fromClient.NfcLastTappedAt = DateTime.UtcNow;

        var updated = await _service.Update(fromClient);

        Assert.Equal(key, updated.NfcTagKey);
        Assert.Null(updated.NfcLastTappedAt);
    }

    [Fact]
    public async Task Regenerate_ReplacesTheKey_AndClearsLastTapped()
    {
        var created = await _service.Add(NewLocation(1, requireNfc: true));
        var oldKey = created.NfcTagKey;
        created.NfcLastTappedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var regenerated = await _service.RegenerateNfcTagAsync(CompanyId, 1);

        Assert.NotNull(regenerated);
        Assert.Matches(KeyShape, regenerated!.NfcTagKey);
        Assert.NotEqual(oldKey, regenerated.NfcTagKey);
        Assert.Null(regenerated.NfcLastTappedAt);
    }

    [Fact]
    public async Task Regenerate_WorksOnAnOptionalSite_WithoutRequireNfc()
    {
        await _service.Add(NewLocation(1));
        var regenerated = await _service.RegenerateNfcTagAsync(CompanyId, 1);
        Assert.Matches(KeyShape, regenerated!.NfcTagKey);
        Assert.False(regenerated.RequireNfc);
    }

    [Fact]
    public async Task Regenerate_ForAnotherCompany_ReturnsNull()
    {
        await _service.Add(NewLocation(1, companyId: "other-co"));
        Assert.Null(await _service.RegenerateNfcTagAsync(CompanyId, 1));
    }

    [Fact]
    public async Task GetNfcTagLinks_ListsActiveSitesOfTheCompany_WithTagUrls()
    {
        var tagged = await _service.Add(NewLocation(1, requireNfc: true));
        await _service.Add(NewLocation(2));
        await _service.Add(NewLocation(3, status: "Inactive"));
        await _service.Add(NewLocation(4, companyId: "other-co", requireNfc: true));

        var links = await _service.GetNfcTagLinksAsync(CompanyId);

        Assert.Equal(new[] { 1, 2 }, links.Select(l => l.LocationId).OrderBy(i => i).ToArray());
        var first = links.Single(l => l.LocationId == 1);
        Assert.Equal("https://t.loqzen.com/t/" + tagged.NfcTagKey, first.TagUrl);
        Assert.True(first.RequireNfc);
        Assert.Null(links.Single(l => l.LocationId == 2).TagUrl);
    }

    [Fact]
    public void DtoToModel_IgnoresTagFields()
    {
        var mapper = new MapperConfiguration(cfg => cfg.AddProfile<MappingProfiles>()).CreateMapper();
        var dto = new LocationDto { LocationId = 1, Name = "Site", RequireNfc = true, NfcTagKey = "from-client", NfcLastTappedAt = DateTime.UtcNow };

        var model = mapper.Map<Location>(dto);

        Assert.True(model.RequireNfc);
        Assert.Null(model.NfcTagKey);
        Assert.Null(model.NfcLastTappedAt);
    }

    [Fact]
    public void ModelToDto_ExposesTagFields()
    {
        var mapper = new MapperConfiguration(cfg => cfg.AddProfile<MappingProfiles>()).CreateMapper();
        var tappedAt = DateTime.UtcNow;
        var model = NewLocation(1, requireNfc: true);
        model.NfcTagKey = "abc";
        model.NfcLastTappedAt = tappedAt;

        var dto = mapper.Map<LocationDto>(model);

        Assert.True(dto.RequireNfc);
        Assert.Equal("abc", dto.NfcTagKey);
        Assert.Equal(tappedAt, dto.NfcLastTappedAt);
    }
}
```

- [ ] **Step 2: Try to run the tests (expected: cannot run here)**

Run: `cd ShiftWork.Api.Tests && dotnet test --filter LocationServiceNfcTests`
Expected in the sandbox: `dotnet: command not found`. Record that in the report. The tests fail to compile against the current code (the members don't exist yet). CI or William's machine confirms red and then green.

- [ ] **Step 3: Add the model fields**

In `ShiftWork.Api/Models/Location.cs`, change the first line to `using System;` followed by `using System.Collections.Generic;`. After the `RequirePhoto` property, add:

```csharp
        /// <summary>
        /// When true, an employee's own phone punch at this site must come from an NFC tag tap
        /// (POST nfc-punch). Kiosk punches and manager entries are unaffected. Default false.
        /// </summary>
        public bool RequireNfc { get; set; } = false;

        /// <summary>
        /// Random URL-safe key in this site's tag link (https://t.loqzen.com/t/{key}). Server-owned:
        /// created when RequireNfc is first turned on or on regenerate; never taken from a client.
        /// </summary>
        public string? NfcTagKey { get; set; }

        /// <summary>Time of the last accepted NFC tap at this site (UTC).</summary>
        public DateTime? NfcLastTappedAt { get; set; }
```

- [ ] **Step 4: Configure the column and index**

In `ShiftWork.Api/Data/ShiftWorkContext.cs`, directly after `modelBuilder.Entity<Location>().ToTable("Locations");`, add:

```csharp
            modelBuilder.Entity<Location>().Property(l => l.NfcTagKey).HasMaxLength(64);
            modelBuilder.Entity<Location>().HasIndex(l => l.NfcTagKey).IsUnique();
```

- [ ] **Step 5: Create the key helper**

Create `ShiftWork.Api/Helpers/NfcTagKeys.cs`:

```csharp
using System;
using System.Security.Cryptography;

namespace ShiftWork.Api.Helpers
{
    public static class NfcTagKeys
    {
        public const string TagUrlBase = "https://t.loqzen.com/t/";

        /// <summary>128 random bits as base64url without padding (22 chars).</summary>
        public static string NewKey()
        {
            var bytes = RandomNumberGenerator.GetBytes(16);
            return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }
    }
}
```

- [ ] **Step 6: DTOs and mapping**

In `ShiftWork.Api/DTOs/LocationDto.cs`, add `using System;` at the top. After `RequirePhoto`, add:

```csharp
        public bool RequireNfc { get; set; }
        public string? NfcTagKey { get; set; }
        public DateTime? NfcLastTappedAt { get; set; }
```

Create `ShiftWork.Api/DTOs/NfcDtos.cs`:

```csharp
using System;

namespace ShiftWork.Api.DTOs
{
    /// <summary>One site as listed on the Mobile "Write tag" screen.</summary>
    public class NfcTagLinkDto
    {
        public int LocationId { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool RequireNfc { get; set; }
        /// <summary>Null until the site has a tag key.</summary>
        public string? TagUrl { get; set; }
        public DateTime? NfcLastTappedAt { get; set; }
    }
}
```

In `ShiftWork.Api/Helpers/MappingProfiles.cs`, replace the `CreateMap<LocationDto, Location>()` statement with:

```csharp
             CreateMap<LocationDto, Location>()
                .ForMember(dest => dest.GeoCoordinates, opt => opt.MapFrom(src =>
                    src.GeoCoordinates != null ? JsonSerializer.Serialize(src.GeoCoordinates, (JsonSerializerOptions)null) : null))
                // Server-owned: clients send the whole location back on save, but may never set these.
                .ForMember(dest => dest.NfcTagKey, opt => opt.Ignore())
                .ForMember(dest => dest.NfcLastTappedAt, opt => opt.Ignore());
```

- [ ] **Step 7: Service**

In `ShiftWork.Api/Services/LocationService.cs`:

1. Add `using ShiftWork.Api.Helpers;`.
2. Add to `ILocationService`:

```csharp
        /// <summary>Gives the site a new tag key (the old tag link stops working) and clears NfcLastTappedAt.</summary>
        Task<Location?> RegenerateNfcTagAsync(string companyId, int locationId);
        /// <summary>Active sites with their tag links, for the Mobile "Write tag" screen.</summary>
        Task<List<NfcTagLinkDto>> GetNfcTagLinksAsync(string companyId);
```

3. In `Add`, before `_context.Locations.Add(location);`:

```csharp
            location.NfcTagKey = location.RequireNfc ? NfcTagKeys.NewKey() : null;
            location.NfcLastTappedAt = null;
```

4. In `Update`, after `existingLocation.RequirePhoto = location.RequirePhoto;`:

```csharp
            existingLocation.RequireNfc = location.RequireNfc;
            // NfcTagKey/NfcLastTappedAt are never copied from the caller. Turning the rule off keeps
            // the key so a tag already on the wall keeps working at an optional site.
            if (existingLocation.RequireNfc && string.IsNullOrEmpty(existingLocation.NfcTagKey))
            {
                existingLocation.NfcTagKey = NfcTagKeys.NewKey();
            }
```

5. Add the two methods to the class, after `Delete`:

```csharp
        public async Task<Location?> RegenerateNfcTagAsync(string companyId, int locationId)
        {
            var location = await _context.Locations
                .FirstOrDefaultAsync(l => l.CompanyId == companyId && l.LocationId == locationId);
            if (location == null)
            {
                return null;
            }

            location.NfcTagKey = NfcTagKeys.NewKey();
            location.NfcLastTappedAt = null;
            await _context.SaveChangesAsync();
            _logger.LogInformation("NFC tag key regenerated for location {LocationId}.", locationId);
            return location;
        }

        public async Task<List<NfcTagLinkDto>> GetNfcTagLinksAsync(string companyId)
        {
            return await _context.Locations
                .AsNoTracking()
                .Where(l => l.CompanyId == companyId && l.Status == "Active")
                .OrderBy(l => l.Name)
                .Select(l => new NfcTagLinkDto
                {
                    LocationId = l.LocationId,
                    Name = l.Name,
                    RequireNfc = l.RequireNfc,
                    TagUrl = l.NfcTagKey == null ? null : NfcTagKeys.TagUrlBase + l.NfcTagKey,
                    NfcLastTappedAt = l.NfcLastTappedAt,
                })
                .ToListAsync();
        }
```

- [ ] **Step 8: Controller endpoints**

In `ShiftWork.Api/Controllers/LocationsController.cs`, add after `GetActiveSiteStatus`. The literal `nfc-tags` segment takes routing precedence over `{locationId}`.

```csharp
        /// <summary>Active sites with their NFC tag links, for the Mobile "Write tag" screen (managers).</summary>
        [HttpGet("nfc-tags")]
        [Authorize(Policy = "locations.update")]
        [ProducesResponseType(typeof(List<NfcTagLinkDto>), 200)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<List<NfcTagLinkDto>>> GetNfcTagLinks(string companyId)
        {
            try
            {
                return Ok(await _locationService.GetNfcTagLinksAsync(companyId));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listing NFC tag links for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>Creates a new tag key for the site. The previous tag link stops working immediately.</summary>
        [HttpPost("{locationId}/nfc-tag/regenerate")]
        [Authorize(Policy = "locations.update")]
        [ProducesResponseType(typeof(LocationDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<LocationDto>> RegenerateNfcTag(string companyId, int locationId)
        {
            try
            {
                var location = await _locationService.RegenerateNfcTagAsync(companyId, locationId);
                if (location == null)
                {
                    return NotFound($"Location with ID {locationId} not found.");
                }

                _memoryCache.Remove($"locations_{companyId}");
                _memoryCache.Remove($"location_{companyId}_{locationId}");
                return Ok(_mapper.Map<LocationDto>(location));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error regenerating NFC tag for location {LocationId} in company {CompanyId}.", locationId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
```

- [ ] **Step 9: Migration (hand-written; no SDK here)**

Create `ShiftWork.Api/Migrations/20260930000100_AddNfcPunch.cs`:

```csharp
using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddNfcPunch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "NfcLastTappedAt",
                table: "Locations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NfcTagKey",
                table: "Locations",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequireNfc",
                table: "Locations",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Locations_NfcTagKey",
                table: "Locations",
                column: "NfcTagKey",
                unique: true,
                filter: "[NfcTagKey] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Locations_NfcTagKey",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "NfcLastTappedAt",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "NfcTagKey",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "RequireNfc",
                table: "Locations");
        }
    }
}
```

Edit `ShiftWork.Api/Migrations/ShiftWorkContextModelSnapshot.cs`. Work only inside the **first** `modelBuilder.Entity("ShiftWork.Api.Models.Location", b =>` block, near line 915; the later occurrences are relationship blocks. Make three edits:

(a) Directly after the `Name` property of that block (`b.Property<string>("Name") .IsRequired() .HasColumnType("nvarchar(max)");`), insert:

```csharp

                    b.Property<DateTime?>("NfcLastTappedAt")
                        .HasColumnType("datetime2");

                    b.Property<string>("NfcTagKey")
                        .HasMaxLength(64)
                        .HasColumnType("nvarchar(64)");
```

(b) Directly before `b.Property<bool>("RequirePhoto")` in that block, insert:

```csharp
                    b.Property<bool>("RequireNfc")
                        .HasColumnType("bit");

```

(c) Directly after `b.HasIndex("CompanyId");` in that block, insert:

```csharp

                    b.HasIndex("NfcTagKey")
                        .IsUnique()
                        .HasFilter("[NfcTagKey] IS NOT NULL");
```

Then generate the Designer from the updated snapshot:

```bash
cd ShiftWork.Api/Migrations
sed -e 's/^using Microsoft.EntityFrameworkCore.Metadata;$/using Microsoft.EntityFrameworkCore.Metadata;\nusing Microsoft.EntityFrameworkCore.Migrations;/' \
    -e 's/^    partial class ShiftWorkContextModelSnapshot : ModelSnapshot$/    [Migration("20260930000100_AddNfcPunch")]\n    partial class AddNfcPunch/' \
    -e 's/protected override void BuildModel(ModelBuilder modelBuilder)/protected override void BuildTargetModel(ModelBuilder modelBuilder)/' \
    ShiftWorkContextModelSnapshot.cs > 20260930000100_AddNfcPunch.Designer.cs
grep -n 'using Microsoft.EntityFrameworkCore.Migrations;\|\[Migration("20260930000100_AddNfcPunch")\]\|partial class AddNfcPunch\|BuildTargetModel\|NfcTagKey\|RequireNfc' 20260930000100_AddNfcPunch.Designer.cs
```

Expected output: 1 `using ...Migrations;` line, the `[Migration(...)]` line, `partial class AddNfcPunch`, `BuildTargetModel`, 3 `NfcTagKey` lines (property plus index) and 1 `RequireNfc` line. The Designer must have the `using Microsoft.EntityFrameworkCore.Migrations;` line; its absence broke CI in PR #41.

- [ ] **Step 10: Commit and open the draft PR (for CI)**

```bash
git add ShiftWork.Api ShiftWork.Api.Tests/Locations/LocationServiceNfcTests.cs
git commit -m "feat(api): add NFC tag fields to Location with server-owned tag keys

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016LZHZKjFhKb8kPYF3sUF9v"
git push
```

The controller (not the implementer) opens a draft PR `feature/nfc-jobsite-punch` → `main` with `gh api repos/williamag929/baseshiftwork/pulls -f head=feature/nfc-jobsite-punch -f base=main -F draft=true -f title="NFC jobsite punch" -f body="..."`, and checks the `pr-tests.yml` run for this commit before approving the task.

---

### Task 2: NFC_REQUIRED rule for an employee's own phone punch (API)

**Files:**
- Create: `ShiftWork.Api/Services/NfcRequiredException.cs`
- Modify: `ShiftWork.Api/Services/IShiftEventService.cs`
- Modify: `ShiftWork.Api/Services/ShiftEventService.cs` (`ApplyStatusAndGeofenceAsync` schedule lookup and the new method)
- Modify: `ShiftWork.Api/Controllers/ShiftEventsController.cs`
- Test: `ShiftWork.Api.Tests/ShiftEvents/ShiftEventServiceNfcRequiredTests.cs`
- Test: `ShiftWork.Api.Tests/ShiftEvents/ShiftEventsControllerNfcTests.cs`

**Interfaces:**
- Consumes: `Location.RequireNfc` (Task 1).
- Produces:
  - `IShiftEventService.EnsureNfcNotRequiredAsync(ShiftEventDto dto): Task`, which throws `NfcRequiredException`.
  - `NfcRequiredException.Code == "NFC_REQUIRED"`.
  - `POST shiftevents` answers 403 `{ code: "NFC_REQUIRED", message }` for the employee's own phone punch at a RequireNfc site.

- [ ] **Step 1: Write the failing service tests**

Create `ShiftWork.Api.Tests/ShiftEvents/ShiftEventServiceNfcRequiredTests.cs`:

```csharp
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Moq;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.ShiftEvents;

public class ShiftEventServiceNfcRequiredTests : IDisposable
{
    private const string CompanyId = "nfc-rule-co";
    private const int PersonId = 7;
    private const int NfcSiteId = 1;
    private const int NormalSiteId = 2;
    private static readonly DateTime ShiftDay = new(2026, 1, 15, 12, 0, 0, DateTimeKind.Utc);
    private readonly ShiftWorkContext _context;

    public ShiftEventServiceNfcRequiredTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ShiftWorkContext(options);
        AddLocation(NfcSiteId, requireNfc: true);
        AddLocation(NormalSiteId, requireNfc: false);
        _context.SaveChanges();
    }

    public void Dispose() => _context.Dispose();

    private void AddLocation(int id, bool requireNfc) => _context.Locations.Add(new Location
    {
        LocationId = id, CompanyId = CompanyId, Name = id == NfcSiteId ? "North Tower" : "Depot",
        Address = "", City = "", State = "", Country = "US", ZipCode = "00000",
        GeoCoordinates = "40.758000,-73.985500", RatioMax = 150, Status = "Active", TimeZone = "UTC",
        RequireNfc = requireNfc,
    });

    private void AddTodaysShift(int locationId) => _context.ScheduleShifts.Add(new ScheduleShift
    {
        ScheduleShiftId = 1, ScheduleId = 1, CompanyId = CompanyId, PersonId = PersonId,
        LocationId = locationId, AreaId = 1,
        StartDate = ShiftDay.Date.AddHours(9), EndDate = ShiftDay.Date.AddHours(17), Status = "open",
    });

    private ShiftEventService Sut() => new(
        _context, new Mock<IMapper>().Object, new Mock<IPeopleService>().Object, new Mock<ICompanySettingsService>().Object);

    private static ShiftEventDto Punch(string eventType = "clockin", int? locationId = null) => new()
    {
        EventLogId = Guid.NewGuid(), CompanyId = CompanyId, PersonId = PersonId,
        EventType = eventType, EventDate = ShiftDay, LocationId = locationId,
    };

    [Fact]
    public async Task ExplicitNfcSite_Throws_WithTheSiteName()
    {
        var ex = await Assert.ThrowsAsync<NfcRequiredException>(() => Sut().EnsureNfcNotRequiredAsync(Punch(locationId: NfcSiteId)));
        Assert.Equal("NFC_REQUIRED", NfcRequiredException.Code);
        Assert.Contains("North Tower", ex.Message);
    }

    [Fact]
    public async Task ClockOut_AtAnNfcSite_AlsoThrows()
    {
        await Assert.ThrowsAsync<NfcRequiredException>(() => Sut().EnsureNfcNotRequiredAsync(Punch("clockout", NfcSiteId)));
    }

    [Fact]
    public async Task ExplicitNormalSite_IsAllowed()
    {
        await Sut().EnsureNfcNotRequiredAsync(Punch(locationId: NormalSiteId));
    }

    [Fact]
    public async Task NoLocationId_UsesTodaysScheduledSite()
    {
        AddTodaysShift(NfcSiteId);
        await _context.SaveChangesAsync();

        await Assert.ThrowsAsync<NfcRequiredException>(() => Sut().EnsureNfcNotRequiredAsync(Punch()));
    }

    [Fact]
    public async Task NoLocationAndNoSchedule_IsAllowed()
    {
        await Sut().EnsureNfcNotRequiredAsync(Punch());
    }

    [Fact]
    public async Task NonClockEvents_AreNotChecked()
    {
        await Sut().EnsureNfcNotRequiredAsync(Punch("break_start", NfcSiteId));
    }
}
```

- [ ] **Step 2: Write the failing controller tests**

Create `ShiftWork.Api.Tests/ShiftEvents/ShiftEventsControllerNfcTests.cs`:

```csharp
using System.Security.Claims;
using AutoMapper;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.ShiftEvents;

public class ShiftEventsControllerNfcTests
{
    private const string CompanyId = "co";
    private readonly Mock<IShiftEventService> _service = new();
    private readonly Mock<IMapper> _mapper = new();

    public ShiftEventsControllerNfcTests()
    {
        _service.Setup(s => s.CreateShiftEventAsync(It.IsAny<ShiftEventDto>()))
            .ReturnsAsync((ShiftEventDto d) => new ShiftEvent { EventLogId = d.EventLogId, PersonId = d.PersonId });
        _mapper.Setup(m => m.Map<ShiftEventDto>(It.IsAny<ShiftEvent>()))
            .Returns((ShiftEvent e) => new ShiftEventDto { EventLogId = e.EventLogId, PersonId = e.PersonId });
    }

    private ShiftEventsController Sut(params Claim[] claims)
    {
        var controller = new ShiftEventsController(_service.Object, NullLogger<ShiftEventsController>.Instance, _mapper.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")) },
        };
        return controller;
    }

    private static ShiftEventDto Punch(int personId) => new()
    {
        EventLogId = Guid.NewGuid(), CompanyId = CompanyId, PersonId = personId, EventType = "clockin", LocationId = 1,
    };

    [Fact]
    public async Task OwnPhonePunch_AtAnNfcSite_Is403_WithCode_AndNothingIsCreated()
    {
        _service.Setup(s => s.EnsureNfcNotRequiredAsync(It.IsAny<ShiftEventDto>()))
            .ThrowsAsync(new NfcRequiredException("North Tower"));

        var result = await Sut(new Claim("personId", "5")).CreateShiftEvent(CompanyId, Punch(5));

        var obj = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(403, obj.StatusCode);
        Assert.Contains("NFC_REQUIRED", System.Text.Json.JsonSerializer.Serialize(obj.Value));
        _service.Verify(s => s.CreateShiftEventAsync(It.IsAny<ShiftEventDto>()), Times.Never);
    }

    [Fact]
    public async Task OwnPhonePunch_AtANormalSite_IsChecked_AndCreated()
    {
        var result = await Sut(new Claim("personId", "5")).CreateShiftEvent(CompanyId, Punch(5));

        Assert.IsType<CreatedAtActionResult>(result.Result);
        _service.Verify(s => s.EnsureNfcNotRequiredAsync(It.IsAny<ShiftEventDto>()), Times.Once);
    }

    [Fact]
    public async Task ManagerTokenWithoutPersonIdClaim_IsNotChecked()
    {
        await Sut(new Claim(ClaimTypes.NameIdentifier, "firebase-uid")).CreateShiftEvent(CompanyId, Punch(5));
        _service.Verify(s => s.EnsureNfcNotRequiredAsync(It.IsAny<ShiftEventDto>()), Times.Never);
    }

    [Fact]
    public async Task PunchForSomeoneElse_IsNotChecked()
    {
        await Sut(new Claim("personId", "99")).CreateShiftEvent(CompanyId, Punch(5));
        _service.Verify(s => s.EnsureNfcNotRequiredAsync(It.IsAny<ShiftEventDto>()), Times.Never);
    }
}
```

- [ ] **Step 3: Try to run (expected: no SDK here)**

Run: `cd ShiftWork.Api.Tests && dotnet test --filter "ShiftEventServiceNfcRequiredTests|ShiftEventsControllerNfcTests"`. The expected result in the sandbox is `command not found`, and CI shows red and then green.

- [ ] **Step 4: Exception type**

Create `ShiftWork.Api/Services/NfcRequiredException.cs`:

```csharp
using System;

namespace ShiftWork.Api.Services
{
    /// <summary>An employee's own phone punch at a site that only accepts NFC tag taps.</summary>
    public class NfcRequiredException : Exception
    {
        public const string Code = "NFC_REQUIRED";

        public NfcRequiredException(string locationName)
            : base($"{locationName} requires tapping the NFC tag to clock in or out.")
        {
        }
    }
}
```

- [ ] **Step 5: Service method and the shared schedule lookup**

In `IShiftEventService.cs`, add after `CreateShiftEventAsync`:

```csharp
        /// <summary>
        /// Throws <see cref="NfcRequiredException"/> when a clock-in/out would land on a site with
        /// RequireNfc (the DTO's LocationId, else the person's schedule for that day). Callers decide
        /// who the rule applies to; the controller applies it to the employee's own phone punches only.
        /// </summary>
        Task EnsureNfcNotRequiredAsync(ShiftEventDto shiftEventDto);
```

In `ShiftEventService.cs`, inside `ApplyStatusAndGeofenceAsync`, replace:

```csharp
            var startOfDayUtc = nowUtc.Date;
            var endOfDayUtc = startOfDayUtc.AddDays(1);

            var scheduleShift = await _context.ScheduleShifts
                .Include(ss => ss.Location)
                .Where(ss => ss.PersonId == shiftEvent.PersonId &&
                             ss.StartDate < endOfDayUtc &&
                             ss.EndDate > startOfDayUtc)
                .OrderBy(ss => ss.StartDate)
                .FirstOrDefaultAsync();
```

with:

```csharp
            var scheduleShift = await FindScheduleShiftForDayAsync(shiftEvent.PersonId, nowUtc);
```

Keep the `var nowUtc = shiftEvent.EventDate;` line above it; it is used later for lateness. Then add these two members to the class:

```csharp
        public async Task EnsureNfcNotRequiredAsync(ShiftEventDto shiftEventDto)
        {
            var isClockEvent =
                string.Equals(shiftEventDto.EventType, "clockin", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(shiftEventDto.EventType, "clockout", StringComparison.OrdinalIgnoreCase);
            if (!isClockEvent)
            {
                return;
            }

            var locationId = shiftEventDto.LocationId;
            if (!locationId.HasValue)
            {
                var eventDate = shiftEventDto.EventDate == default ? DateTime.UtcNow : shiftEventDto.EventDate;
                locationId = (await FindScheduleShiftForDayAsync(shiftEventDto.PersonId, eventDate))?.LocationId;
            }
            if (!locationId.HasValue)
            {
                return;
            }

            var location = await _context.Locations.AsNoTracking()
                .FirstOrDefaultAsync(l => l.LocationId == locationId.Value);
            if (location is { RequireNfc: true })
            {
                throw new NfcRequiredException(location.Name);
            }
        }

        // "Today" is an overlap check on the UTC day to avoid timezone date mismatches.
        private async Task<ScheduleShift?> FindScheduleShiftForDayAsync(int personId, DateTime eventDateUtc)
        {
            var startOfDayUtc = eventDateUtc.Date;
            var endOfDayUtc = startOfDayUtc.AddDays(1);
            return await _context.ScheduleShifts
                .Include(ss => ss.Location)
                .Where(ss => ss.PersonId == personId &&
                             ss.StartDate < endOfDayUtc &&
                             ss.EndDate > startOfDayUtc)
                .OrderBy(ss => ss.StartDate)
                .FirstOrDefaultAsync();
        }
```

- [ ] **Step 6: Controller**

In `ShiftEventsController.cs`, add `using System.Security.Claims;`. In `CreateShiftEvent`, make the first statements inside `try`:

```csharp
                if (IsOwnPhonePunch(shiftEventDto))
                {
                    await _shiftEventService.EnsureNfcNotRequiredAsync(shiftEventDto);
                }
```

Add this as the **first** catch clause, before `catch (InvalidOperationException ex)`:

```csharp
            catch (NfcRequiredException ex)
            {
                return StatusCode(403, new { code = NfcRequiredException.Code, message = ex.Message });
            }
```

Add to the class:

```csharp
        // Only the Mobile app's API JWT carries a personId claim. Angular (Firebase) tokens don't, and
        // kiosk punches use /api/kiosk, so manager entries and kiosks never reach the NFC rule.
        private bool IsOwnPhonePunch(ShiftEventDto dto) =>
            int.TryParse(User.FindFirstValue("personId"), out var callerPersonId) && callerPersonId == dto.PersonId;
```

- [ ] **Step 7: Commit and push; the controller checks CI**

```bash
git add ShiftWork.Api ShiftWork.Api.Tests/ShiftEvents
git commit -m "feat(api): reject an employee's own phone punch at NFC-required sites

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016LZHZKjFhKb8kPYF3sUF9v"
git push
```

---

### Task 3: NFC punch endpoint (API)

**Files:**
- Create: `ShiftWork.Api/Services/PunchTime.cs`
- Modify: `ShiftWork.Api/Services/KioskService.cs` (use `PunchTime.Resolve`; remove `MaxClockSkew`, `MaxPunchAge` and `ResolveEventDate`)
- Modify: `ShiftWork.Api/DTOs/NfcDtos.cs` (append the request and response)
- Create: `ShiftWork.Api/Services/NfcPunchRejectedException.cs`
- Create: `ShiftWork.Api/Services/NfcPunchService.cs`
- Create: `ShiftWork.Api/Controllers/NfcPunchController.cs`
- Modify: `ShiftWork.Api/Program.cs` (register the service next to line 140, `AddScoped<IShiftEventService, ShiftEventService>()`)
- Test: `ShiftWork.Api.Tests/Nfc/NfcPunchServiceTests.cs`
- Test: `ShiftWork.Api.Tests/Nfc/NfcPunchControllerTests.cs`

**Interfaces:**
- Consumes: `Location.NfcTagKey`, `Location.NfcLastTappedAt` (Task 1); `IShiftEventService.CreateShiftEventAsync`; `IPeopleService.GetPersonStatusShiftWork`.
- Produces:
  - `POST /api/companies/{companyId}/nfc-punch` (policy `shift-events.create`).
  - Body: `NfcPunchRequest { string TagKey; Guid EventLogId; DateTime? EventDate; string? GeoLocation; string? Device }`.
  - 200 response: `NfcPunchResponse { Guid EventLogId; string EventType /* "clockin"|"clockout" */; DateTime EventDate; int LocationId; string LocationName; string GeofenceStatus /* Inside|Outside|Unknown */; bool Repeated }`.
  - Errors: `{ code, message }` using the codes in Global Constraints.
  - `PunchTime.Resolve(DateTime? requested, DateTime nowUtc): DateTime` throws `ArgumentException`.
  - `NfcPunchService.TapDescription = "NFC tap"` and `NfcPunchService.RepeatTapWindow = 60 s`.

- [ ] **Step 1: Write the failing service tests**

Create `ShiftWork.Api.Tests/Nfc/NfcPunchServiceTests.cs`:

```csharp
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
```

- [ ] **Step 2: Write the failing controller tests**

Create `ShiftWork.Api.Tests/Nfc/NfcPunchControllerTests.cs`:

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Nfc;

public class NfcPunchControllerTests
{
    private readonly Mock<INfcPunchService> _service = new();

    private NfcPunchController Sut(params Claim[] claims) => new(_service.Object, NullLogger<NfcPunchController>.Instance)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")) },
        },
    };

    private static NfcPunchRequest Tap() => new() { TagKey = "k", EventLogId = Guid.NewGuid() };

    [Fact]
    public async Task WithoutPersonIdClaim_Is403_AndServiceNotCalled()
    {
        var result = await Sut(new Claim(ClaimTypes.NameIdentifier, "firebase-uid")).Punch("co", Tap());

        var obj = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(403, obj.StatusCode);
        _service.Verify(s => s.PunchAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<NfcPunchRequest>()), Times.Never);
    }

    [Fact]
    public async Task Success_Is200_ForTheCallersPersonId()
    {
        _service.Setup(s => s.PunchAsync("co", 5, It.IsAny<NfcPunchRequest>()))
            .ReturnsAsync(new NfcPunchResponse { EventType = "clockin", LocationName = "North Tower" });

        var result = await Sut(new Claim("personId", "5")).Punch("co", Tap());

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal("clockin", ((NfcPunchResponse)ok.Value!).EventType);
    }

    [Fact]
    public async Task Rejection_MapsStatusAndCode()
    {
        _service.Setup(s => s.PunchAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<NfcPunchRequest>()))
            .ThrowsAsync(new NfcPunchRejectedException(404, "TAG_NOT_FOUND", "nope"));

        var result = await Sut(new Claim("personId", "5")).Punch("co", Tap());

        var obj = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(404, obj.StatusCode);
        Assert.Contains("TAG_NOT_FOUND", System.Text.Json.JsonSerializer.Serialize(obj.Value));
    }
}
```

- [ ] **Step 3: Try to run (expected: no SDK here)**

Run: `cd ShiftWork.Api.Tests && dotnet test --filter "NfcPunch|KioskService"`. The expected result in the sandbox is `command not found`; CI confirms. The kiosk tests are in the filter because Step 4 moves their date logic.

- [ ] **Step 4: Extract the shared date window**

Create `ShiftWork.Api/Services/PunchTime.cs`:

```csharp
using System;

namespace ShiftWork.Api.Services
{
    /// <summary>The client-reported punch time window shared by kiosk and NFC punches.</summary>
    public static class PunchTime
    {
        public static readonly TimeSpan MaxClockSkew = TimeSpan.FromMinutes(5);
        public static readonly TimeSpan MaxPunchAge = TimeSpan.FromDays(7);

        public static DateTime Resolve(DateTime? requested, DateTime nowUtc)
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
    }
}
```

In `KioskService.cs`:
- Delete the `MaxClockSkew` and `MaxPunchAge` fields and the private `ResolveEventDate` method.
- Replace the call `ResolveEventDate(request.EventDate, now)` with `PunchTime.Resolve(request.EventDate, now)`.
- Run `grep -n "MaxClockSkew\|MaxPunchAge\|ResolveEventDate" ShiftWork.Api/Services/KioskService.cs`, which should print nothing.

- [ ] **Step 5: DTOs and exception**

Append inside the namespace of `ShiftWork.Api/DTOs/NfcDtos.cs`:

```csharp
    public class NfcPunchRequest
    {
        public string TagKey { get; set; } = string.Empty;
        /// <summary>Client-generated id; a retry with the same id returns the original punch.</summary>
        public Guid EventLogId { get; set; }
        /// <summary>Tap time (UTC). Within 7 days back / 5 minutes ahead; defaults to server time.</summary>
        public DateTime? EventDate { get; set; }
        /// <summary>"lat,lng"; missing means the punch is flagged GeofenceStatus = Unknown.</summary>
        public string? GeoLocation { get; set; }
        public string? Device { get; set; }
    }

    public class NfcPunchResponse
    {
        public Guid EventLogId { get; set; }
        public string EventType { get; set; } = string.Empty;
        public DateTime EventDate { get; set; }
        public int LocationId { get; set; }
        public string LocationName { get; set; } = string.Empty;
        public string GeofenceStatus { get; set; } = "Unknown";
        /// <summary>True when this tap repeated the person's punch from the last minute and recorded nothing.</summary>
        public bool Repeated { get; set; }
    }
```

Create `ShiftWork.Api/Services/NfcPunchRejectedException.cs`:

```csharp
using System;

namespace ShiftWork.Api.Services
{
    public class NfcPunchRejectedException : Exception
    {
        public int StatusCode { get; }
        public string Code { get; }

        public NfcPunchRejectedException(int statusCode, string code, string message) : base(message)
        {
            StatusCode = statusCode;
            Code = code;
        }
    }
}
```

- [ ] **Step 6: Service**

Create `ShiftWork.Api/Services/NfcPunchService.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public interface INfcPunchService
    {
        Task<NfcPunchResponse> PunchAsync(string companyId, int personId, NfcPunchRequest request);
    }

    public class NfcPunchService : INfcPunchService
    {
        public const string TapDescription = "NFC tap";
        public static readonly TimeSpan RepeatTapWindow = TimeSpan.FromSeconds(60);

        private readonly ShiftWorkContext _context;
        private readonly IShiftEventService _shiftEventService;
        private readonly IPeopleService _peopleService;
        private readonly IMemoryCache _cache;

        public NfcPunchService(ShiftWorkContext context, IShiftEventService shiftEventService, IPeopleService peopleService, IMemoryCache cache)
        {
            _context = context;
            _shiftEventService = shiftEventService;
            _peopleService = peopleService;
            _cache = cache;
        }

        public async Task<NfcPunchResponse> PunchAsync(string companyId, int personId, NfcPunchRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.TagKey))
                throw new NfcPunchRejectedException(400, "TAG_MISSING", "The tag link has no key.");
            if (request.EventLogId == Guid.Empty)
                throw new NfcPunchRejectedException(400, "EVENT_ID_MISSING", "eventLogId is required.");

            var isEmployee = await _context.Persons.AsNoTracking()
                .AnyAsync(p => p.PersonId == personId && p.CompanyId == companyId);
            if (!isEmployee)
                throw new NfcPunchRejectedException(403, "NOT_AN_EMPLOYEE", "You are not an employee of this company.");

            // A retried request returns the original punch instead of recording a second one.
            var existing = await _context.ShiftEvents.AsNoTracking()
                .FirstOrDefaultAsync(e => e.EventLogId == request.EventLogId);
            if (existing != null)
                return await ExistingResultAsync(existing, companyId, personId);

            var location = await _context.Locations
                .FirstOrDefaultAsync(l => l.NfcTagKey == request.TagKey && l.CompanyId == companyId);
            if (location == null)
                throw new NfcPunchRejectedException(404, "TAG_NOT_FOUND", "This tag is not linked to a site in your company.");

            var now = DateTime.UtcNow;
            DateTime eventDate;
            try
            {
                eventDate = PunchTime.Resolve(request.EventDate, now);
            }
            catch (ArgumentException ex)
            {
                throw new NfcPunchRejectedException(400, "EVENT_DATE_INVALID", ex.Message);
            }

            // Phones can report one physical tap twice, and people tap again when unsure. With no Undo,
            // that second tap would clock them straight back out, so it returns the first punch instead.
            var repeatSince = now - RepeatTapWindow;
            var recentTap = await _context.ShiftEvents.AsNoTracking()
                .Where(e => e.CompanyId == companyId && e.PersonId == personId
                            && e.LocationId == location.LocationId
                            && e.Description == TapDescription
                            && e.CreatedAt >= repeatSince)
                .OrderByDescending(e => e.CreatedAt)
                .FirstOrDefaultAsync();
            if (recentTap != null)
                return ToResponse(recentTap, location, repeated: true);

            var status = await _peopleService.GetPersonStatusShiftWork(personId);
            var isOnShift = !string.IsNullOrEmpty(status) && status.StartsWith("OnShift", StringComparison.OrdinalIgnoreCase);

            var dto = new ShiftEventDto
            {
                EventLogId = request.EventLogId,
                EventDate = eventDate,
                EventType = isOnShift ? "clockout" : "clockin",
                CompanyId = companyId,
                PersonId = personId,
                Description = TapDescription,
                KioskDevice = request.Device,
                GeoLocation = request.GeoLocation,
                LocationId = location.LocationId,
            };

            ShiftEvent created;
            try
            {
                created = await _shiftEventService.CreateShiftEventAsync(dto);
            }
            catch (InvalidOperationException ex)
            {
                throw new NfcPunchRejectedException(409, "TRANSITION_CONFLICT", ex.Message);
            }
            catch (DbUpdateException)
            {
                // A concurrent retry with the same eventLogId was saved first: answer with that one.
                _context.ChangeTracker.Clear();
                var winner = await _context.ShiftEvents.AsNoTracking()
                    .FirstOrDefaultAsync(e => e.EventLogId == request.EventLogId);
                if (winner == null) throw;
                return await ExistingResultAsync(winner, companyId, personId);
            }

            location.NfcLastTappedAt = now;
            await _context.SaveChangesAsync();
            // Same keys LocationsController caches under, so the admin form shows the new "Last tapped".
            _cache.Remove($"locations_{companyId}");
            _cache.Remove($"location_{companyId}_{location.LocationId}");

            return ToResponse(created, location, repeated: false);
        }

        private async Task<NfcPunchResponse> ExistingResultAsync(ShiftEvent existing, string companyId, int personId)
        {
            if (existing.CompanyId != companyId || existing.PersonId != personId)
                throw new NfcPunchRejectedException(409, "EVENT_ID_CONFLICT", "This event id was already used for a different punch.");

            var location = existing.LocationId.HasValue
                ? await _context.Locations.AsNoTracking().FirstOrDefaultAsync(l => l.LocationId == existing.LocationId.Value)
                : null;
            return ToResponse(existing, location, repeated: false);
        }

        private static NfcPunchResponse ToResponse(ShiftEvent e, Location? location, bool repeated) => new()
        {
            EventLogId = e.EventLogId,
            EventType = e.EventType ?? string.Empty,
            EventDate = e.EventDate,
            LocationId = location?.LocationId ?? e.LocationId ?? 0,
            LocationName = location?.Name ?? string.Empty,
            GeofenceStatus = e.GeofenceStatus ?? "Unknown",
            Repeated = repeated,
        };
    }
}
```

- [ ] **Step 7: Controller and DI**

Create `ShiftWork.Api/Controllers/NfcPunchController.cs`:

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;
using System;
using System.Security.Claims;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/nfc-punch")]
    public class NfcPunchController : ControllerBase
    {
        private readonly INfcPunchService _nfcPunchService;
        private readonly ILogger<NfcPunchController> _logger;

        public NfcPunchController(INfcPunchService nfcPunchService, ILogger<NfcPunchController> logger)
        {
            _nfcPunchService = nfcPunchService;
            _logger = logger;
        }

        /// <summary>Clocks the signed-in employee in or out at the site whose NFC tag they tapped.</summary>
        [HttpPost]
        [Authorize(Policy = "shift-events.create")]
        [ProducesResponseType(typeof(NfcPunchResponse), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(403)]
        [ProducesResponseType(404)]
        [ProducesResponseType(409)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<NfcPunchResponse>> Punch(string companyId, [FromBody] NfcPunchRequest request)
        {
            // Only the Mobile app's API JWT identifies an employee (personId claim).
            if (!int.TryParse(User.FindFirstValue("personId"), out var personId))
            {
                return StatusCode(403, new { code = "NOT_AN_EMPLOYEE", message = "Sign in with the Loqzen app to use NFC tags." });
            }

            try
            {
                var result = await _nfcPunchService.PunchAsync(companyId, personId, request);
                _logger.LogInformation(
                    "NFC punch {EventLogId} PersonId={PersonId} LocationId={LocationId} Type={EventType} Geofence={GeofenceStatus} Repeated={Repeated}",
                    result.EventLogId, personId, result.LocationId, result.EventType, result.GeofenceStatus, result.Repeated);
                return Ok(result);
            }
            catch (NfcPunchRejectedException ex)
            {
                return StatusCode(ex.StatusCode, new { code = ex.Code, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error recording NFC punch for person {PersonId}", personId);
                return StatusCode(500, new { code = "SERVER_ERROR", message = "An internal server error occurred." });
            }
        }
    }
}
```

In `Program.cs`, after `builder.Services.AddScoped<IShiftEventService, ShiftEventService>();`, add:

```csharp
builder.Services.AddScoped<INfcPunchService, NfcPunchService>();
```

- [ ] **Step 8: Commit and push; the controller checks CI (including the kiosk tests)**

```bash
git add ShiftWork.Api ShiftWork.Api.Tests/Nfc
git commit -m "feat(api): add NFC punch endpoint with repeat-tap guard and shared punch window

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016LZHZKjFhKb8kPYF3sUF9v"
git push
```

---

### Task 4: Tag host (app-link files and fallback page) and the setup doc

**Files:**
- Create: `ShiftWork.Api/Controllers/TagLinksController.cs`
- Modify: `ShiftWork.Api/appsettings.json` (add an `NfcTags` section after `KioskSettings`)
- Test: `ShiftWork.Api.Tests/Nfc/TagLinksControllerTests.cs`
- Create: `Docs/nfc-tags-setup.md`

**Interfaces:**
- Produces:
  - `GET /.well-known/apple-app-site-association`: application/json, or 404 while `NfcTags:AppleTeamId` is empty.
  - `GET /.well-known/assetlinks.json`: application/json, or 404 while `NfcTags:AndroidCertFingerprints` is empty.
  - `GET /t/{tagKey}`: a static text/html page that never echoes the key.
  - Config keys: `NfcTags:AppleTeamId`, `NfcTags:AndroidCertFingerprints` (string array), `NfcTags:AppStoreUrl`, `NfcTags:PlayStoreUrl`.

- [ ] **Step 1: Write the failing tests**

Create `ShiftWork.Api.Tests/Nfc/TagLinksControllerTests.cs`:

```csharp
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using ShiftWork.Api.Controllers;
using Xunit;

namespace ShiftWork.Api.Tests.Nfc;

public class TagLinksControllerTests
{
    private static TagLinksController Sut(Dictionary<string, string?> settings) =>
        new(new ConfigurationBuilder().AddInMemoryCollection(settings).Build());

    private static readonly Dictionary<string, string?> Configured = new()
    {
        ["NfcTags:AppleTeamId"] = "ABCDE12345",
        ["NfcTags:AndroidCertFingerprints:0"] = "AA:BB:CC",
        ["NfcTags:AppStoreUrl"] = "https://apps.apple.com/app/id1",
        ["NfcTags:PlayStoreUrl"] = "https://play.google.com/store/apps/details?id=com.loqzen.mobile",
    };

    [Fact]
    public void AppleFile_IsNotFound_UntilTheTeamIdIsSet()
    {
        Assert.IsType<NotFoundResult>(Sut(new()).AppleAppSiteAssociation());
    }

    [Fact]
    public void AppleFile_ListsTheAppForTagPaths()
    {
        var result = Assert.IsType<ContentResult>(Sut(Configured).AppleAppSiteAssociation());

        Assert.Equal("application/json", result.ContentType);
        using var doc = JsonDocument.Parse(result.Content!);
        var detail = doc.RootElement.GetProperty("applinks").GetProperty("details")[0];
        Assert.Equal("ABCDE12345.com.loqzen.mobile", detail.GetProperty("appIDs")[0].GetString());
        Assert.Equal("/t/*", detail.GetProperty("components")[0].GetProperty("/").GetString());
        Assert.Equal("/t/*", detail.GetProperty("paths")[0].GetString());
    }

    [Fact]
    public void AssetLinks_IsNotFound_UntilAFingerprintIsSet()
    {
        Assert.IsType<NotFoundResult>(Sut(new()).AssetLinks());
    }

    [Fact]
    public void AssetLinks_ListsPackageAndFingerprint()
    {
        var result = Assert.IsType<ContentResult>(Sut(Configured).AssetLinks());

        Assert.Equal("application/json", result.ContentType);
        using var doc = JsonDocument.Parse(result.Content!);
        var target = doc.RootElement[0].GetProperty("target");
        Assert.Equal("android_app", target.GetProperty("namespace").GetString());
        Assert.Equal("com.loqzen.mobile", target.GetProperty("package_name").GetString());
        Assert.Equal("AA:BB:CC", target.GetProperty("sha256_cert_fingerprints")[0].GetString());
        Assert.Equal("delegate_permission/common.handle_all_urls", doc.RootElement[0].GetProperty("relation")[0].GetString());
    }

    [Fact]
    public void FallbackPage_IsHtml_WithStoreLinks_AndNeverEchoesTheKey()
    {
        var result = Sut(Configured).TagFallback("<script>alert(1)</script>");

        Assert.StartsWith("text/html", result.ContentType);
        Assert.Contains("Loqzen", result.Content);
        Assert.Contains("https://apps.apple.com/app/id1", result.Content);
        Assert.Contains("play.google.com", result.Content);
        Assert.DoesNotContain("<script>", result.Content);
    }

    [Fact]
    public void FallbackPage_WithoutStoreUrls_HasNoStoreButtons()
    {
        var result = Sut(new()).TagFallback("abc");
        Assert.DoesNotContain("App Store", result.Content);
        Assert.DoesNotContain("Google Play", result.Content);
    }
}
```

- [ ] **Step 2: Try to run (expected: no SDK here)**

Run: `cd ShiftWork.Api.Tests && dotnet test --filter TagLinksControllerTests`. In the sandbox this is expected to fail with `command not found`.

- [ ] **Step 3: Controller**

Create `ShiftWork.Api/Controllers/TagLinksController.cs`:

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Net;
using System.Text;
using System.Text.Json;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// Serves the NFC tag host (t.loqzen.com, routed to this API by the reverse proxy): the files that let
    /// iOS/Android open the Loqzen app from a tag link, and a page for phones without the app.
    /// </summary>
    [ApiController]
    [AllowAnonymous]
    public class TagLinksController : ControllerBase
    {
        private const string AppId = "com.loqzen.mobile";
        private const string TagPaths = "/t/*";
        private readonly IConfiguration _configuration;

        public TagLinksController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        [HttpGet("/.well-known/apple-app-site-association")]
        public IActionResult AppleAppSiteAssociation()
        {
            var teamId = _configuration["NfcTags:AppleTeamId"];
            if (string.IsNullOrWhiteSpace(teamId))
            {
                return NotFound();
            }

            var appId = $"{teamId.Trim()}.{AppId}";
            var body = new
            {
                applinks = new
                {
                    apps = Array.Empty<string>(),
                    details = new object[]
                    {
                        new
                        {
                            appIDs = new[] { appId },
                            components = new[] { new Dictionary<string, string> { ["/"] = TagPaths } },
                            // Older iOS versions read appID + paths instead of appIDs + components.
                            appID = appId,
                            paths = new[] { TagPaths },
                        },
                    },
                },
            };
            return Content(JsonSerializer.Serialize(body), "application/json");
        }

        [HttpGet("/.well-known/assetlinks.json")]
        public IActionResult AssetLinks()
        {
            var fingerprints = _configuration.GetSection("NfcTags:AndroidCertFingerprints").Get<string[]>() ?? Array.Empty<string>();
            if (fingerprints.Length == 0)
            {
                return NotFound();
            }

            var body = new[]
            {
                new
                {
                    relation = new[] { "delegate_permission/common.handle_all_urls" },
                    target = new
                    {
                        @namespace = "android_app",
                        package_name = AppId,
                        sha256_cert_fingerprints = fingerprints,
                    },
                },
            };
            return Content(JsonSerializer.Serialize(body), "application/json");
        }

        /// <summary>Shown only when the tag link opens in a browser (app not installed).</summary>
        [HttpGet("/t/{tagKey}")]
        public ContentResult TagFallback(string tagKey)
        {
            var buttons = new StringBuilder();
            AppendStoreButton(buttons, _configuration["NfcTags:AppStoreUrl"], "App Store");
            AppendStoreButton(buttons, _configuration["NfcTags:PlayStoreUrl"], "Google Play");

            var html = $@"<!doctype html>
<html lang=""en"">
<head>
<meta charset=""utf-8"">
<meta name=""viewport"" content=""width=device-width, initial-scale=1"">
<title>Loqzen</title>
<style>
  body {{ font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 32px 20px; background: #f5f5f7; color: #1d1d1f; text-align: center; }}
  main {{ max-width: 420px; margin: 0 auto; }}
  h1 {{ font-size: 24px; margin-bottom: 8px; }}
  p {{ font-size: 16px; line-height: 1.5; color: #444; }}
  a.btn {{ display: block; margin: 12px 0; padding: 14px; border-radius: 12px; background: #0a84ff; color: #fff; text-decoration: none; font-weight: 600; }}
</style>
</head>
<body>
<main>
  <h1>Loqzen</h1>
  <p>Open the Loqzen app to clock in or out at this jobsite.</p>
  <p>Abre la app Loqzen para marcar tu entrada o salida en este sitio.</p>
  {buttons}
</main>
</body>
</html>";
            return Content(html, "text/html; charset=utf-8");
        }

        private static void AppendStoreButton(StringBuilder buttons, string? url, string label)
        {
            if (string.IsNullOrWhiteSpace(url)) return;
            buttons.Append($@"<a class=""btn"" href=""{WebUtility.HtmlEncode(url)}"">{label}</a>");
        }
    }
}
```

- [ ] **Step 4: Config section**

In `ShiftWork.Api/appsettings.json`, add after the `KioskSettings` object (mind the comma):

```json
  "NfcTags": {
    "AppleTeamId": "",
    "AndroidCertFingerprints": [],
    "AppStoreUrl": "",
    "PlayStoreUrl": ""
  },
```

Run: `node -e "JSON.parse(require('fs').readFileSync('ShiftWork.Api/appsettings.json','utf8'))"`. It should exit 0 (the file is still valid JSON).

- [ ] **Step 5: Setup doc (server part)**

Create `Docs/nfc-tags-setup.md` with this content. Tasks 6 and 9 append their sections.

```markdown
# NFC jobsite tags: setup and rollout

Tags hold the link `https://t.loqzen.com/t/<tagKey>`. Tapping it opens the Loqzen app and clocks the
employee in or out at that site. The API serves everything on `t.loqzen.com`.

## 1. Tag host (one-time)

1. DNS: add `t.loqzen.com` pointing at the same server as `api.loqzen.com`.
2. TLS: a certificate covering `t.loqzen.com` (or a wildcard `*.loqzen.com`).
3. Reverse proxy: route `t.loqzen.com` to the API container, like `api.loqzen.com`. The paths used are
   `/.well-known/apple-app-site-association`, `/.well-known/assetlinks.json` and `/t/*`.
4. API settings (`NfcTags` section, or environment variables `NfcTags__AppleTeamId`,
   `NfcTags__AndroidCertFingerprints__0`, `NfcTags__AppStoreUrl`, `NfcTags__PlayStoreUrl`):
   - `AppleTeamId`: 10-character Team ID from developer.apple.com → Membership.
   - `AndroidCertFingerprints`: SHA-256 of the **release** signing certificate, like `AB:CD:...`.
     From `eas credentials -p android` (keystore SHA256), and if Google Play App Signing is on, **also**
     the "App signing key certificate" SHA-256 from Play Console → Setup → App integrity. List both.
   - `AppStoreUrl` / `PlayStoreUrl`: store links shown on the page for phones without the app.
5. Check. Each must answer `200` with no redirect:
   curl -sI https://t.loqzen.com/.well-known/apple-app-site-association
   curl -sI https://t.loqzen.com/.well-known/assetlinks.json
   curl -sI https://t.loqzen.com/t/test
   Apple caches the file through its CDN, so also check
   `https://app-site-association.cdn-apple.com/a/v1/t.loqzen.com` (can take a few hours to refresh).

Fallback if a new host is not wanted: point the same three paths at `api.loqzen.com` and change the host
in `ShiftWork.Api/Helpers/NfcTagKeys.cs`, `ShiftWork.Mobile/utils/nfcTag.ts`,
`ShiftWork.Mobile/app.json` (associatedDomains and intent filter), `ShiftWork.Mobile/plugins/withNfcTagIntent.js`
and `ShiftWork.Angular/.../locations.component.ts`.
```

- [ ] **Step 6: Commit and push; the controller checks CI**

```bash
git add ShiftWork.Api ShiftWork.Api.Tests/Nfc/TagLinksControllerTests.cs Docs/nfc-tags-setup.md
git commit -m "feat(api): serve app-link files and fallback page for NFC tag links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016LZHZKjFhKb8kPYF3sUF9v"
git push
```

---

### Task 5: Angular location form (Require NFC, tag link, regenerate)

**Files:**
- Modify: `ShiftWork.Angular/src/app/core/models/location.model.ts`
- Modify: `ShiftWork.Angular/src/app/core/services/location.service.ts`
- Modify: `ShiftWork.Angular/src/app/features/dashboard/locations/locations.component.ts` (form at lines 99-100, reset at 135-136, edit at 306-307)
- Modify: `ShiftWork.Angular/src/app/features/dashboard/locations/locations.component.html` (after the Kiosk form-group ending at line 243)
- Modify: `ShiftWork.Angular/src/app/features/dashboard/locations/locations.component.css`
- Modify: `ShiftWork.Angular/src/locale/messages.xlf` and `ShiftWork.Angular/src/locale/messages.es.xlf` (after the `locations.kiosk_hint` trans-unit)

**Interfaces:**
- Consumes: `LocationDto.requireNfc`, `nfcTagKey` and `nfcLastTappedAt`, plus `POST .../locations/{id}/nfc-tag/regenerate` returning `LocationDto` (Task 1).

- [ ] **Step 1: Model and service**

In `location.model.ts`, add after `requirePhoto?: boolean;`:

```ts
    requireNfc?: boolean;
    /** Server-owned; the tag link is https://t.loqzen.com/t/<nfcTagKey>. */
    nfcTagKey?: string | null;
    nfcLastTappedAt?: string | null;
```

In `location.service.ts`, add after `updateLocation`:

```ts
  /** New tag key for the site; the old tag link stops working immediately. Also creates the first key. */
  regenerateNfcTag(companyId: string, id: number): Observable<Location> {
    return this.http.post<Location>(`${this.apiUrl}/companies/${companyId}/locations/${id}/nfc-tag/regenerate`, {}, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }
```

- [ ] **Step 2: Component logic**

In `locations.component.ts`:
- In the form definition, after `requirePhoto: [true],`, add `requireNfc: [false],`.
- In the reset `patchValue`/`reset` object, after `requirePhoto: true,`, add `requireNfc: false,`.
- In `editLocation`, after `requirePhoto: location.requirePhoto ?? true`, add `,` and then `requireNfc: location.requireNfc ?? false`.
- Add these members to the class, after `saveLocation()`:

```ts
  readonly nfcTagUrlBase = 'https://t.loqzen.com/t/';
  nfcBusy = false;

  nfcTagUrl(location: Location | null): string | null {
    return location?.nfcTagKey ? this.nfcTagUrlBase + location.nfcTagKey : null;
  }

  copyNfcTagUrl(url: string): void {
    navigator.clipboard.writeText(url).then(
      () => this.toastr.success($localize`:@@locations.nfc_copied:Tag link copied.`),
      () => this.toastr.error($localize`:@@locations.nfc_copy_failed:Could not copy. Select the link and copy it.`),
    );
  }

  regenerateNfcTag(): void {
    const current = this.selectedLocation;
    if (!current || this.nfcBusy) {
      return;
    }
    if (current.nfcTagKey && !window.confirm($localize`:@@locations.nfc_regenerate_confirm:Create a new tag link? The current tag stops working right away and must be written again.`)) {
      return;
    }

    this.nfcBusy = true;
    this.locationService.regenerateNfcTag(this.activeCompany.companyId, current.locationId).subscribe({
      next: (updated) => {
        const merged = { ...current, nfcTagKey: updated.nfcTagKey, nfcLastTappedAt: updated.nfcLastTappedAt };
        this.selectedLocation = merged;
        const index = this.locations.findIndex(l => l.locationId === merged.locationId);
        if (index > -1) {
          this.locations[index] = { ...this.locations[index], nfcTagKey: merged.nfcTagKey, nfcLastTappedAt: merged.nfcLastTappedAt };
        }
        this.toastr.success($localize`:@@locations.nfc_regenerated:New tag link ready. Write it to the tag.`);
        this.nfcBusy = false;
      },
      error: () => {
        this.toastr.error($localize`:@@locations.nfc_regenerate_failed:Could not create the tag link.`);
        this.nfcBusy = false;
      },
    });
  }
```

- [ ] **Step 3: Template**

In `locations.component.html`, directly after the closing `</div>` of the Kiosk form-group (the one containing `@@locations.kiosk_hint`), insert:

```html
                <div class="form-group">
                  <label class="form-label">
                    <i class="fa fa-wifi"></i>
                    <ng-container i18n="@@locations.nfc_section">NFC tag</ng-container>
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" id="requireNfc" formControlName="requireNfc">
                    <ng-container i18n="@@locations.require_nfc">Require an NFC tag tap to clock in or out from phones</ng-container>
                  </label>
                  <small class="form-hint" i18n="@@locations.require_nfc_hint">When on, employees can't use the phone's clock button at this site. Kiosks and manager entries still work.</small>

                  <ng-container *ngIf="selectedLocation; else nfcAfterSave">
                    <div class="nfc-tag" *ngIf="nfcTagUrl(selectedLocation) as tagUrl; else noNfcTag">
                      <label for="nfcTagUrl" class="form-label" i18n="@@locations.nfc_tag_link">Tag link</label>
                      <div class="nfc-tag-row">
                        <input id="nfcTagUrl" class="form-input" type="text" [value]="tagUrl" readonly>
                        <button type="button" class="btn-cancel" (click)="copyNfcTagUrl(tagUrl)" i18n="@@locations.nfc_copy">Copy</button>
                        <button type="button" class="btn-cancel" (click)="regenerateNfcTag()" [disabled]="nfcBusy" i18n="@@locations.nfc_regenerate">Regenerate</button>
                      </div>
                      <small class="form-hint">
                        <ng-container i18n="@@locations.nfc_last_tapped">Last tapped:</ng-container>
                        {{ selectedLocation.nfcLastTappedAt ? (selectedLocation.nfcLastTappedAt | date:'medium') : '—' }}
                      </small>
                    </div>
                    <ng-template #noNfcTag>
                      <button type="button" class="btn-cancel" (click)="regenerateNfcTag()" [disabled]="nfcBusy" i18n="@@locations.nfc_create">Create tag link</button>
                    </ng-template>
                  </ng-container>
                  <ng-template #nfcAfterSave>
                    <small class="form-hint" i18n="@@locations.nfc_after_save">Save the location first, then create its tag link here.</small>
                  </ng-template>
                </div>
```

Append to `locations.component.css`:

```css
.nfc-tag-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.nfc-tag-row .form-input {
  flex: 1;
  min-width: 0;
  font-family: monospace;
}
```

- [ ] **Step 4: Translations (by hand; do not run generate:angular)**

In `messages.xlf`, after the `locations.kiosk_hint` trans-unit, add one `<trans-unit id="..." datatype="html"><source>EN</source></trans-unit>` per row below. In `messages.es.xlf`, add the same trans-units with `<source>EN</source>` and `<target state="translated">ES</target>`, following the neighbouring units' indentation.

| id | EN | ES |
|---|---|---|
| locations.nfc_section | NFC tag | Etiqueta NFC |
| locations.require_nfc | Require an NFC tag tap to clock in or out from phones | Exigir tocar la etiqueta NFC para marcar desde el teléfono |
| locations.require_nfc_hint | When on, employees can't use the phone's clock button at this site. Kiosks and manager entries still work. | Si está activo, los empleados no pueden usar el botón de marcar del teléfono en este sitio. Los kioscos y las entradas de gerentes siguen funcionando. |
| locations.nfc_tag_link | Tag link | Enlace de la etiqueta |
| locations.nfc_copy | Copy | Copiar |
| locations.nfc_regenerate | Regenerate | Regenerar |
| locations.nfc_last_tapped | Last tapped: | Último toque: |
| locations.nfc_create | Create tag link | Crear enlace de etiqueta |
| locations.nfc_after_save | Save the location first, then create its tag link here. | Guarda la ubicación primero y luego crea aquí su enlace de etiqueta. |
| locations.nfc_copied | Tag link copied. | Enlace copiado. |
| locations.nfc_copy_failed | Could not copy. Select the link and copy it. | No se pudo copiar. Selecciona el enlace y cópialo. |
| locations.nfc_regenerate_confirm | Create a new tag link? The current tag stops working right away and must be written again. | ¿Crear un nuevo enlace? La etiqueta actual deja de funcionar de inmediato y hay que volver a escribirla. |
| locations.nfc_regenerated | New tag link ready. Write it to the tag. | Nuevo enlace listo. Escríbelo en la etiqueta. |
| locations.nfc_regenerate_failed | Could not create the tag link. | No se pudo crear el enlace de la etiqueta. |

- [ ] **Step 5: Build (both locales)**

Run:
```bash
cd ShiftWork.Angular
npx ng build 2>&1 | tail -20
npx ng build --configuration es-SP 2>&1 | tail -20
```
Expected: both builds succeed, with no `Missing translation` warnings for the `locations.nfc_*` or `locations.require_nfc*` ids. If `es-SP` is not a build configuration in this workspace, run `npx ng build --localize` instead and record which command worked.

- [ ] **Step 6: Commit**

```bash
git add ShiftWork.Angular/src
git commit -m "feat(angular): manage Require NFC and the site's tag link on the location form

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016LZHZKjFhKb8kPYF3sUF9v"
```

---

### Task 6: Mobile foundation (NFC library, app config, tag utils, services, strings)

**Files:**
- Modify: `ShiftWork.Mobile/package.json` and `package-lock.json` (via npm)
- Modify: `ShiftWork.Mobile/app.json`
- Delete: `ShiftWork.Mobile/android/`; modify `ShiftWork.Mobile/.gitignore`
- Create: `ShiftWork.Mobile/plugins/withNfcTagIntent.js`
- Test: `ShiftWork.Mobile/plugins/__tests__/withNfcTagIntent.test.js`
- Create: `ShiftWork.Mobile/__mocks__/react-native-nfc-manager.ts`
- Create: `ShiftWork.Mobile/utils/nfcTag.ts`
- Test: `ShiftWork.Mobile/utils/__tests__/nfcTag.test.ts`
- Create: `ShiftWork.Mobile/services/nfc.service.ts`
- Test: `ShiftWork.Mobile/services/__tests__/nfc.service.test.ts`
- Create: `ShiftWork.Mobile/services/nfc-punch.service.ts`
- Test: `ShiftWork.Mobile/services/__tests__/nfc-punch.service.test.ts`
- Modify: `ShiftWork.Mobile/types/api.ts`
- Modify: `translations-source/strings.json`, then generate `ShiftWork.Mobile/i18n/translations/{en,es}.ts`
- Modify: `Docs/nfc-tags-setup.md` (append section 2)

**Interfaces:**
- Produces:
  - `utils/nfcTag.ts`: `NFC_TAG_HOST = 't.loqzen.com'`, `NFC_TAG_URL_BASE = 'https://t.loqzen.com/t/'`, `buildTagUrl(tagKey: string): string`, `parseTagKey(url?: string | null): string | null`, `isValidTagKey(key: string): boolean`.
  - `services/nfc.service.ts`: `type NfcAvailability = 'ready' | 'disabled' | 'unsupported'` and `nfcService.getAvailability(): Promise<NfcAvailability>`.
  - `nfcService.readTagKey(alertMessage: string): Promise<string | null>` rejects if the scan is cancelled or fails.
  - `nfcService.writeTagUrl(url: string, alertMessage: string, lock: boolean): Promise<void>` and `nfcService.cancel(): Promise<void>`.
  - `services/nfc-punch.service.ts`: `nfcPunchService.punch(companyId, req: NfcPunchRequest): Promise<NfcPunchResult>`, `nfcPunchService.getTagLinks(companyId): Promise<NfcTagLink[]>` and `nfcPunchService.createTagLink(companyId, locationId): Promise<LocationDto>`.
  - `types/api.ts`: `NfcPunchRequest`, `NfcPunchResult` and `NfcTagLink`; `LocationDto` gains `requireNfc?: boolean`, `nfcTagKey?: string | null`.
  - i18n keys `nfc.*`, listed in Step 9.

- [ ] **Step 1: Install**

```bash
cd ShiftWork.Mobile
npm ci
npm install react-native-nfc-manager@3.17.2
npx expo install expo-crypto
npx expo install --check
```
Expected: `npx expo install --check` reports that dependencies are up to date. If it flags `react-native-nfc-manager`, ignore that line; it is not an Expo SDK package.

- [ ] **Step 2: Write the failing tests**

Create `ShiftWork.Mobile/utils/__tests__/nfcTag.test.ts`:

```ts
import { buildTagUrl, isValidTagKey, parseTagKey, NFC_TAG_URL_BASE } from '../nfcTag';

const KEY = 'Ab3_-xyz0123456789ABCD';

describe('parseTagKey', () => {
  it.each([
    [`https://t.loqzen.com/t/${KEY}`],
    [`https://t.loqzen.com/t/${KEY}/`],
    [`https://t.loqzen.com/t/${KEY}?src=nfc`],
    [`https://T.LOQZEN.COM/t/${KEY}`],
    [`  https://t.loqzen.com/t/${KEY}  `],
  ])('reads the key from %s', (url) => {
    expect(parseTagKey(url)).toBe(KEY);
  });

  it.each([
    [null],
    [undefined],
    [''],
    [`http://t.loqzen.com/t/${KEY}`],
    [`https://t.loqzen.com.evil.com/t/${KEY}`],
    [`https://evil.com/t/${KEY}`],
    [`https://t.loqzen.com/x/${KEY}`],
    ['https://t.loqzen.com/t/'],
    ['https://t.loqzen.com/t/short'],
    ['https://t.loqzen.com/t/has%20space-000000000000'],
    [`https://t.loqzen.com/t/${KEY}/extra`],
    ['https://t.loqzen.com/t/%E0%A4%A'],
  ])('rejects %s', (url) => {
    expect(parseTagKey(url as string | null | undefined)).toBeNull();
  });
});

describe('buildTagUrl / isValidTagKey', () => {
  it('builds the link the server lists', () => {
    expect(buildTagUrl(KEY)).toBe(`https://t.loqzen.com/t/${KEY}`);
    expect(NFC_TAG_URL_BASE).toBe('https://t.loqzen.com/t/');
  });

  it('validates the key shape', () => {
    expect(isValidTagKey(KEY)).toBe(true);
    expect(isValidTagKey('bad key')).toBe(false);
    expect(isValidTagKey('x'.repeat(65))).toBe(false);
  });
});
```

Create `ShiftWork.Mobile/services/__tests__/nfc.service.test.ts`:

```ts
import NfcManager, { Ndef } from 'react-native-nfc-manager';
import { nfcService } from '../nfc.service';

const mocked = NfcManager as unknown as {
  isSupported: jest.Mock; isEnabled: jest.Mock; requestTechnology: jest.Mock; getTag: jest.Mock;
  cancelTechnologyRequest: jest.Mock; ndefHandler: { writeNdefMessage: jest.Mock; makeReadOnly: jest.Mock };
};
const ndef = Ndef as unknown as { isType: jest.Mock; uri: { decodePayload: jest.Mock }; encodeMessage: jest.Mock; uriRecord: jest.Mock };
const KEY = 'Ab3_-xyz0123456789ABCD';

beforeEach(() => {
  jest.clearAllMocks();
  mocked.isSupported.mockResolvedValue(true);
  mocked.isEnabled.mockResolvedValue(true);
  ndef.isType.mockReturnValue(true);
});

describe('getAvailability', () => {
  it('is ready when supported and enabled', async () => {
    expect(await nfcService.getAvailability()).toBe('ready');
  });
  it('is disabled when NFC is off', async () => {
    mocked.isEnabled.mockResolvedValue(false);
    expect(await nfcService.getAvailability()).toBe('disabled');
  });
  it('is unsupported without NFC hardware', async () => {
    mocked.isSupported.mockResolvedValue(false);
    expect(await nfcService.getAvailability()).toBe('unsupported');
  });
  it('is unsupported when the native module throws', async () => {
    mocked.isSupported.mockRejectedValue(new Error('no module'));
    expect(await nfcService.getAvailability()).toBe('unsupported');
  });
});

describe('readTagKey', () => {
  it('returns the key of the first Loqzen URI record and ends the session', async () => {
    mocked.getTag.mockResolvedValue({ ndefMessage: [{ tnf: 1, type: 'U', payload: [1] }] });
    ndef.uri.decodePayload.mockReturnValue(`https://t.loqzen.com/t/${KEY}`);

    await expect(nfcService.readTagKey('Hold near tag')).resolves.toBe(KEY);
    expect(mocked.requestTechnology).toHaveBeenCalledWith('Ndef', { alertMessage: 'Hold near tag' });
    expect(mocked.cancelTechnologyRequest).toHaveBeenCalled();
  });

  it('returns null for a tag that is not a Loqzen link', async () => {
    mocked.getTag.mockResolvedValue({ ndefMessage: [{ tnf: 1, type: 'U', payload: [1] }] });
    ndef.uri.decodePayload.mockReturnValue('https://example.com');
    await expect(nfcService.readTagKey('x')).resolves.toBeNull();
  });

  it('returns null for a blank tag', async () => {
    mocked.getTag.mockResolvedValue({ ndefMessage: [] });
    await expect(nfcService.readTagKey('x')).resolves.toBeNull();
  });

  it('rejects when the user cancels, and still ends the session', async () => {
    mocked.requestTechnology.mockRejectedValueOnce(new Error('cancelled'));
    await expect(nfcService.readTagKey('x')).rejects.toThrow('cancelled');
    expect(mocked.cancelTechnologyRequest).toHaveBeenCalled();
  });
});

describe('writeTagUrl', () => {
  it('writes one URI record and locks only when asked', async () => {
    ndef.encodeMessage.mockReturnValue([9, 9]);
    await nfcService.writeTagUrl(`https://t.loqzen.com/t/${KEY}`, 'Hold', false);

    expect(ndef.uriRecord).toHaveBeenCalledWith(`https://t.loqzen.com/t/${KEY}`);
    expect(mocked.ndefHandler.writeNdefMessage).toHaveBeenCalledWith([9, 9]);
    expect(mocked.ndefHandler.makeReadOnly).not.toHaveBeenCalled();
    expect(mocked.cancelTechnologyRequest).toHaveBeenCalled();
  });

  it('locks the tag after writing when asked', async () => {
    await nfcService.writeTagUrl(`https://t.loqzen.com/t/${KEY}`, 'Hold', true);
    expect(mocked.ndefHandler.makeReadOnly).toHaveBeenCalled();
  });

  it('ends the session when the write fails', async () => {
    mocked.ndefHandler.writeNdefMessage.mockRejectedValueOnce(new Error('tag lost'));
    await expect(nfcService.writeTagUrl('u', 'Hold', false)).rejects.toThrow('tag lost');
    expect(mocked.cancelTechnologyRequest).toHaveBeenCalled();
  });
});
```

Create `ShiftWork.Mobile/services/__tests__/nfc-punch.service.test.ts`:

```ts
jest.mock('../api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));

import { apiClient } from '../api-client';
import { nfcPunchService } from '../nfc-punch.service';

beforeEach(() => jest.clearAllMocks());

it('posts the tap to the company nfc-punch endpoint', async () => {
  (apiClient.post as jest.Mock).mockResolvedValue({ eventType: 'clockin' });
  const req = { tagKey: 'k', eventLogId: 'id-1', eventDate: '2026-09-30T12:00:00.000Z', geoLocation: '1,2', device: 'Pixel' };

  await nfcPunchService.punch('co-1', req);

  expect(apiClient.post).toHaveBeenCalledWith('/api/companies/co-1/nfc-punch', req);
});

it('lists tag links and creates one', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue([]);
  (apiClient.post as jest.Mock).mockResolvedValue({});

  await nfcPunchService.getTagLinks('co-1');
  await nfcPunchService.createTagLink('co-1', 7);

  expect(apiClient.get).toHaveBeenCalledWith('/api/companies/co-1/locations/nfc-tags', { params: { noCacheBust: true } });
  expect(apiClient.post).toHaveBeenCalledWith('/api/companies/co-1/locations/7/nfc-tag/regenerate');
});
```

Create `ShiftWork.Mobile/plugins/__tests__/withNfcTagIntent.test.js`:

```js
const { addNfcTagIntent } = require('../withNfcTagIntent');

const baseManifest = () => ({
  manifest: {
    application: [{ activity: [{ $: { 'android:name': '.MainActivity' }, 'intent-filter': [] }] }],
  },
});

it('adds the NDEF_DISCOVERED filter for tag links and an optional NFC feature', () => {
  const result = addNfcTagIntent(baseManifest());
  const filters = result.manifest.application[0].activity[0]['intent-filter'];
  const ndef = filters.find((f) => f.action[0].$['android:name'] === 'android.nfc.action.NDEF_DISCOVERED');

  expect(ndef.category[0].$['android:name']).toBe('android.intent.category.DEFAULT');
  expect(ndef.data[0].$).toEqual({ 'android:scheme': 'https', 'android:host': 't.loqzen.com', 'android:pathPrefix': '/t/' });
  expect(result.manifest['uses-feature']).toEqual([{ $: { 'android:name': 'android.hardware.nfc', 'android:required': 'false' } }]);
});

it('is idempotent', () => {
  const once = addNfcTagIntent(baseManifest());
  const twice = addNfcTagIntent(once);
  expect(twice.manifest.application[0].activity[0]['intent-filter']).toHaveLength(1);
  expect(twice.manifest['uses-feature']).toHaveLength(1);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest utils/__tests__/nfcTag.test.ts services/__tests__/nfc.service.test.ts services/__tests__/nfc-punch.service.test.ts plugins/__tests__/withNfcTagIntent.test.js`
Expected: FAIL with "Cannot find module '../nfcTag'" and similar errors for the other modules.

- [ ] **Step 4: Jest mock for the native module**

Create `ShiftWork.Mobile/__mocks__/react-native-nfc-manager.ts`. It sits next to `node_modules`, so Jest uses it automatically.

```ts
const NfcManager = {
  start: jest.fn(async () => undefined),
  isSupported: jest.fn(async () => true),
  isEnabled: jest.fn(async () => true),
  requestTechnology: jest.fn(async () => 'Ndef'),
  getTag: jest.fn(async () => null),
  cancelTechnologyRequest: jest.fn(async () => undefined),
  ndefHandler: {
    writeNdefMessage: jest.fn(async () => undefined),
    makeReadOnly: jest.fn(async () => undefined),
  },
};

export const NfcTech = { Ndef: 'Ndef' };

export const Ndef = {
  TNF_WELL_KNOWN: 0x01,
  RTD_URI: 'U',
  isType: jest.fn(() => true),
  uri: { decodePayload: jest.fn(() => '') },
  uriRecord: jest.fn((uri: string) => ({ tnf: 0x01, type: 'U', payload: [], uri })),
  encodeMessage: jest.fn(() => [] as number[]),
};

export default NfcManager;
```

- [ ] **Step 5: Tag utils**

Create `ShiftWork.Mobile/utils/nfcTag.ts`:

```ts
export const NFC_TAG_HOST = 't.loqzen.com';
export const NFC_TAG_URL_BASE = `https://${NFC_TAG_HOST}/t/`;

// Server keys are 22-char base64url; allow up to the 64-char column for future formats.
const TAG_KEY_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const TAG_URL_PATTERN = /^https:\/\/t\.loqzen\.com\/t\/([^/?#]+)\/?(?:[?#].*)?$/i;

export function isValidTagKey(tagKey: string): boolean {
  return TAG_KEY_PATTERN.test(tagKey);
}

export function buildTagUrl(tagKey: string): string {
  return NFC_TAG_URL_BASE + tagKey;
}

/** The tag key from a Loqzen tag link (https://t.loqzen.com/t/<key>), or null for anything else. */
export function parseTagKey(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = TAG_URL_PATTERN.exec(url.trim());
  if (!match) return null;
  let key: string;
  try {
    key = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return isValidTagKey(key) ? key : null;
}
```

- [ ] **Step 6: Types and services**

In `ShiftWork.Mobile/types/api.ts`, add to `LocationDto` after `isActive: boolean;`:

```ts
  /** Phone punches at this site must come from an NFC tag tap. */
  requireNfc?: boolean;
  /** Set when the site has a tag link (https://t.loqzen.com/t/<nfcTagKey>). */
  nfcTagKey?: string | null;
```

Append to `types/api.ts`:

```ts
export interface NfcPunchRequest {
  tagKey: string;
  /** Client-generated; reused on retry so a saved punch is never recorded twice. */
  eventLogId: string;
  /** Tap time, ISO UTC. */
  eventDate: string;
  geoLocation?: string;
  device?: string;
}

export interface NfcPunchResult {
  eventLogId: string;
  eventType: 'clockin' | 'clockout';
  eventDate: string;
  locationId: number;
  locationName: string;
  /** "Inside" | "Outside" | "Unknown" */
  geofenceStatus: string;
  /** True when the tap repeated a punch from the last minute and recorded nothing new. */
  repeated: boolean;
}

export interface NfcTagLink {
  locationId: number;
  name: string;
  requireNfc: boolean;
  tagUrl: string | null;
  nfcLastTappedAt: string | null;
}
```

Create `ShiftWork.Mobile/services/nfc-punch.service.ts`:

```ts
import { apiClient } from './api-client';
import type { LocationDto, NfcPunchRequest, NfcPunchResult, NfcTagLink } from '../types/api';

export const nfcPunchService = {
  punch(companyId: string, request: NfcPunchRequest): Promise<NfcPunchResult> {
    return apiClient.post<NfcPunchResult>(`/api/companies/${companyId}/nfc-punch`, request);
  },

  /** Managers only (locations.update); others get a 403. */
  getTagLinks(companyId: string): Promise<NfcTagLink[]> {
    return apiClient.get<NfcTagLink[]>(`/api/companies/${companyId}/locations/nfc-tags`, {
      params: { noCacheBust: true },
    });
  },

  /** Creates the site's first tag key, or replaces it (the old tag stops working). */
  createTagLink(companyId: string, locationId: number): Promise<LocationDto> {
    return apiClient.post<LocationDto>(`/api/companies/${companyId}/locations/${locationId}/nfc-tag/regenerate`);
  },
};
```

Create `ShiftWork.Mobile/services/nfc.service.ts`:

```ts
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import { parseTagKey } from '@/utils/nfcTag';

export type NfcAvailability = 'ready' | 'disabled' | 'unsupported';

let starting: Promise<void> | null = null;
const ensureStarted = () => (starting ??= NfcManager.start());

const endSession = () => NfcManager.cancelTechnologyRequest().catch(() => undefined);

export const nfcService = {
  async getAvailability(): Promise<NfcAvailability> {
    try {
      if (!(await NfcManager.isSupported())) return 'unsupported';
      await ensureStarted();
      return (await NfcManager.isEnabled()) ? 'ready' : 'disabled';
    } catch {
      return 'unsupported';
    }
  },

  /** Waits for a tag; resolves its Loqzen tag key, or null if it is not a Loqzen tag. Rejects on cancel. */
  async readTagKey(alertMessage: string): Promise<string | null> {
    await ensureStarted();
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef, { alertMessage });
      const tag = await NfcManager.getTag();
      for (const record of tag?.ndefMessage ?? []) {
        if (!Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI)) continue;
        const key = parseTagKey(Ndef.uri.decodePayload(Uint8Array.from(record.payload)));
        if (key) return key;
      }
      return null;
    } finally {
      await endSession();
    }
  },

  /** Writes one NDEF URI record; `lock` makes the tag read-only afterwards (permanent). */
  async writeTagUrl(url: string, alertMessage: string, lock: boolean): Promise<void> {
    await ensureStarted();
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef, { alertMessage });
      const bytes = Ndef.encodeMessage([Ndef.uriRecord(url)]);
      await NfcManager.ndefHandler.writeNdefMessage(bytes);
      if (lock) await NfcManager.ndefHandler.makeReadOnly();
    } finally {
      await endSession();
    }
  },

  cancel(): Promise<void> {
    return endSession();
  },
};
```

- [ ] **Step 7: Android intent plugin**

Create `ShiftWork.Mobile/plugins/withNfcTagIntent.js`:

```js
// Expo's app.json `intentFilters` can only express android.intent.action.* actions, and a tag tap
// arrives as android.nfc.action.NDEF_DISCOVERED. React Native's Linking reads that intent's URI, so
// expo-router opens /t/<key> the same way as a normal app link.
const TAG_HOST = 't.loqzen.com';
const TAG_PATH_PREFIX = '/t/';
const NDEF_DISCOVERED = 'android.nfc.action.NDEF_DISCOVERED';

function addNfcTagIntent(androidManifest) {
  const manifest = androidManifest.manifest;

  manifest['uses-feature'] = manifest['uses-feature'] || [];
  if (!manifest['uses-feature'].some((f) => f.$['android:name'] === 'android.hardware.nfc')) {
    // Optional, so the Play Store still offers the app to phones without NFC.
    manifest['uses-feature'].push({ $: { 'android:name': 'android.hardware.nfc', 'android:required': 'false' } });
  }

  const activity = manifest.application[0].activity.find((a) => a.$['android:name'] === '.MainActivity');
  activity['intent-filter'] = activity['intent-filter'] || [];
  const hasFilter = activity['intent-filter'].some((f) =>
    (f.action || []).some((a) => a.$['android:name'] === NDEF_DISCOVERED));
  if (!hasFilter) {
    activity['intent-filter'].push({
      action: [{ $: { 'android:name': NDEF_DISCOVERED } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      data: [{ $: { 'android:scheme': 'https', 'android:host': TAG_HOST, 'android:pathPrefix': TAG_PATH_PREFIX } }],
    });
  }
  return androidManifest;
}

function withNfcTagIntent(config) {
  const { withAndroidManifest } = require('expo/config-plugins');
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = addNfcTagIntent(cfg.modResults);
    return cfg;
  });
}

module.exports = withNfcTagIntent;
module.exports.addNfcTagIntent = addNfcTagIntent;
```

- [ ] **Step 8: app.json and removing the stale Android project**

In `ShiftWork.Mobile/app.json`:
- In `ios`, add `"associatedDomains": ["applinks:t.loqzen.com"]` after `"bundleIdentifier"`.
- In `android`, add after `"package": "com.loqzen.mobile",`:

```json
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [{ "scheme": "https", "host": "t.loqzen.com", "pathPrefix": "/t/" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ],
```

- In `plugins`, append these two entries at the end of the array:

```json
      [
        "react-native-nfc-manager",
        {
          "nfcPermission": "Loqzen reads the NFC tag at your jobsite to clock you in or out",
          "includeNdefEntitlement": false
        }
      ],
      "./plugins/withNfcTagIntent"
```

The library plugin adds `NFCReaderUsageDescription`, the iOS "NFC Tag Reading" entitlement (`TAG` format; `includeNdefEntitlement: false` avoids the App Store rejection of the NDEF format) and `android.permission.NFC`. Do not add those by hand.

Remove the committed native Android project. It is the old `com.joblogsmart.mobile` app, and EAS would build it instead of reading `app.json`.

```bash
git rm -r -q android
printf '\n# Native projects are generated by EAS from app.json (Continuous Native Generation)\n/android\n/ios\n' >> .gitignore
```

Verify the config resolves:

```bash
npx expo config --type public --json > /tmp/expo-public.json && node -e "
const c=require('/tmp/expo-public.json');
console.log(c.ios.associatedDomains, c.android.package, JSON.stringify(c.android.intentFilters));"
npx expo config --type introspect --json 2>/dev/null | grep -c 'NDEF_DISCOVERED\|NFCReaderUsageDescription\|android.permission.NFC'
```

The first command should print `[ 'applinks:t.loqzen.com' ] com.loqzen.mobile` and the VIEW filter. The second should print a count of 3 or more. If `introspect` fails offline, record that in the report; Step 2's plugin test still covers the NDEF filter.

- [ ] **Step 9: Strings**

In `translations-source/strings.json`, add these keys before the final `}`, with a comma after the previous last entry:

```json
  "nfc.tap_title":            { "en": "Tap the NFC tag",                                          "es": "Toca la etiqueta NFC" },
  "nfc.required_at_site":     { "en": "Tap the NFC tag at {{site}} to clock in or out",           "es": "Toca la etiqueta NFC en {{site}} para marcar entrada o salida" },
  "nfc.scan_button":          { "en": "Scan NFC tag",                                             "es": "Escanear etiqueta NFC" },
  "nfc.scan_prompt":          { "en": "Hold the top of your phone near the tag",                  "es": "Acerca la parte superior del teléfono a la etiqueta" },
  "nfc.unsupported":          { "en": "This phone can't read NFC tags. Use the kiosk or ask your manager.", "es": "Este teléfono no puede leer etiquetas NFC. Usa el kiosco o pide ayuda a tu gerente." },
  "nfc.disabled":             { "en": "NFC is turned off. Turn it on in your phone settings.",    "es": "El NFC está apagado. Actívalo en la configuración del teléfono." },
  "nfc.sending":              { "en": "Recording your punch…",                                    "es": "Registrando tu marca…" },
  "nfc.clocked_in":           { "en": "Clocked IN",                                               "es": "Entrada registrada" },
  "nfc.clocked_out":          { "en": "Clocked OUT",                                              "es": "Salida registrada" },
  "nfc.at_site_time":         { "en": "{{site}} at {{time}}",                                     "es": "{{site}} a las {{time}}" },
  "nfc.already_recorded":     { "en": "Already recorded a moment ago",                            "es": "Ya se registró hace un momento" },
  "nfc.outside_site":         { "en": "You seem to be away from the site. Your manager will review this punch.", "es": "Parece que no estás en el sitio. Tu gerente revisará esta marca." },
  "nfc.error_offline":        { "en": "No connection. Check your signal and try again.",          "es": "Sin conexión. Revisa tu señal e inténtalo de nuevo." },
  "nfc.error_unknown_tag":    { "en": "This tag isn't linked to a site in your company.",         "es": "Esta etiqueta no está vinculada a un sitio de tu empresa." },
  "nfc.error_not_loqzen":     { "en": "This isn't a Loqzen tag.",                                 "es": "Esta no es una etiqueta de Loqzen." },
  "nfc.error_failed":         { "en": "Could not record your punch. Try again.",                  "es": "No se pudo registrar tu marca. Inténtalo de nuevo." },
  "nfc.sign_in_first":        { "en": "Sign in to finish clocking in or out.",                    "es": "Inicia sesión para terminar de marcar." },
  "nfc.try_again":            { "en": "Try again",                                                "es": "Intentar de nuevo" },
  "nfc.done":                 { "en": "Done",                                                     "es": "Listo" },
  "nfc.write_title":          { "en": "Write NFC tag",                                            "es": "Escribir etiqueta NFC" },
  "nfc.write_entry":          { "en": "Write NFC tags for jobsites",                              "es": "Escribir etiquetas NFC para sitios" },
  "nfc.write_pick_site":      { "en": "Choose the site for this tag",                             "es": "Elige el sitio de esta etiqueta" },
  "nfc.write_no_link":        { "en": "No tag link yet",                                          "es": "Aún sin enlace" },
  "nfc.write_create_link":    { "en": "Create tag link",                                          "es": "Crear enlace" },
  "nfc.write_lock":           { "en": "Lock the tag after writing (it can't be changed later)",   "es": "Bloquear la etiqueta después de escribir (no se podrá cambiar)" },
  "nfc.write_button":         { "en": "Write tag",                                                "es": "Escribir etiqueta" },
  "nfc.write_prompt":         { "en": "Hold a blank tag to the top of your phone",                "es": "Acerca una etiqueta en blanco a la parte superior del teléfono" },
  "nfc.write_success":        { "en": "Tag written for {{site}}",                                 "es": "Etiqueta escrita para {{site}}" },
  "nfc.write_failed":         { "en": "Could not write the tag. Try again, holding the phone still.", "es": "No se pudo escribir la etiqueta. Inténtalo de nuevo sin mover el teléfono." },
  "nfc.write_managers_only":  { "en": "Only managers can write tags.",                            "es": "Solo los gerentes pueden escribir etiquetas." }
```

Generate the Mobile files, then restore the Kiosk files the generator would strip:

```bash
cd translations-source
npm run validate && npm run generate:rn
cd ..
git checkout -- ShiftWork.Kiosk/i18n
git status --short ShiftWork.Kiosk ShiftWork.Angular
```
Expected: the last command prints nothing, and only `ShiftWork.Mobile/i18n/translations/{en,es}.ts` and `strings.json` changed.

- [ ] **Step 10: Run the tests**

Run: `cd ShiftWork.Mobile && npx jest utils/__tests__/nfcTag.test.ts services/__tests__/nfc.service.test.ts services/__tests__/nfc-punch.service.test.ts plugins/__tests__/withNfcTagIntent.test.js i18n/__tests__/parity.test.ts`
Expected: PASS, with clean output.

Then run: `npx tsc --noEmit 2>&1 | grep -E "nfcTag|nfc\.service|nfc-punch|types/api" || echo "no type errors in new files"`. It should print `no type errors in new files`.

- [ ] **Step 11: Setup doc, mobile build section**

Append to `Docs/nfc-tags-setup.md`:

```markdown
## 2. Mobile app build

- Expo Go cannot use NFC. Build a development client: `eas build --profile development -p android` and
  `eas build --profile development -p ios`, then `npx expo start --dev-client`.
- The native projects are generated by EAS from `app.json`. The old committed `android/` folder
  (package `com.joblogsmart.mobile`) was removed so builds use `com.loqzen.mobile` and the NFC/app-link settings.
- iOS: EAS turns on the "NFC Tag Reading" and "Associated Domains" capabilities for `com.loqzen.mobile`
  when it manages the credentials. If credentials are managed by hand, enable both on the App ID first.
- iPhone behaviour: iPhone XS and later read the tag with the phone unlocked and show a "Open in Loqzen"
  banner; tapping it opens the punch. Older iPhones use the "Scan NFC tag" button on the Clock screen.
- Android: with the screen unlocked, a tap opens the app straight into the punch.
```

- [ ] **Step 12: Commit**

```bash
git add -A ShiftWork.Mobile translations-source/strings.json Docs/nfc-tags-setup.md
git commit -m "feat(mobile): add NFC library, tag-link config and NFC services

Removes the stale committed android/ project (com.joblogsmart.mobile) so EAS
generates Android from app.json like iOS.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016LZHZKjFhKb8kPYF3sUF9v"
```

---

### Task 7: Mobile tap flow (tag link → punch → result)

**Files:**
- Modify: `ShiftWork.Mobile/utils/location.utils.ts` (add `getQuickLocation`)
- Test: `ShiftWork.Mobile/utils/__tests__/quickLocation.test.ts`
- Create: `ShiftWork.Mobile/store/pendingTagStore.ts`
- Create: `ShiftWork.Mobile/hooks/useNfcPunch.ts`
- Test: `ShiftWork.Mobile/hooks/__tests__/useNfcPunch.test.tsx`
- Create: `ShiftWork.Mobile/components/screens/nfc/NfcPunchResultView.tsx`
- Test: `ShiftWork.Mobile/components/screens/nfc/__tests__/NfcPunchResultView.test.tsx`
- Create: `ShiftWork.Mobile/app/t/[tagKey].tsx`
- Modify: `ShiftWork.Mobile/utils/nfcTag.ts` (add `isTagLaunchUrl`) and `utils/__tests__/nfcTag.test.ts`
- Modify: `ShiftWork.Mobile/app/_layout.tsx` (cold-start redirect guard and the `t/[tagKey]` screen options)
- Modify: `ShiftWork.Mobile/app/(tabs)/_layout.tsx` (resume the pending tag after sign-in)

**Interfaces:**
- Consumes:
  - `nfcPunchService.punch` and `parseTagKey`/`isValidTagKey` (Task 6).
  - `shiftEventsKey(companyId, personId)` from `@/hooks/queries`.
  - `saveActiveClockInAt`/`clearActiveClockInAt` from `@/utils`.
  - `getToken`/`getUserData`/`getCompanyId` from `@/utils/storage.utils`.
- Produces:
  - `getQuickLocation(maxAgeMs?: number, timeoutMs?: number): Promise<string | null>`.
  - `usePendingTagStore`: `{ tagKey: string | null; setTagKey(k): void; take(): string | null }`.
  - `useNfcPunch(companyId, personId)` returns `{ state: NfcPunchState; punch(tagKey: string): Promise<void>; reset(): void }`.
  - `classifyNfcPunchError(err): NfcPunchErrorKind`.
  - `type NfcPunchErrorKind = 'offline' | 'unknown_tag' | 'signed_out' | 'failed'`.
  - `type NfcPunchState = { status: 'idle' } | { status: 'sending' } | { status: 'success'; result: NfcPunchResult } | { status: 'error'; kind: NfcPunchErrorKind; message?: string }`.
  - `<NfcPunchResultView state onRetry onDone />`.
  - `isTagLaunchUrl(url?: string | null): boolean`.
  - Route `/t/[tagKey]`.

- [ ] **Step 1: Write the failing tests**

Create `ShiftWork.Mobile/utils/__tests__/quickLocation.test.ts`:

```ts
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3, High: 4 },
}));

import * as Location from 'expo-location';
import { getQuickLocation } from '../location.utils';

const loc = Location as unknown as Record<string, jest.Mock>;
const fix = (lat: number, lng: number) => ({ coords: { latitude: lat, longitude: lng } });

beforeEach(() => {
  jest.clearAllMocks();
  loc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
});

it('uses a fresh cached fix without waiting for GPS', async () => {
  loc.getLastKnownPositionAsync.mockResolvedValue(fix(1.5, 2.5));
  await expect(getQuickLocation()).resolves.toBe('1.5,2.5');
  expect(loc.getCurrentPositionAsync).not.toHaveBeenCalled();
  expect(loc.getLastKnownPositionAsync).toHaveBeenCalledWith({ maxAge: 120000, requiredAccuracy: 200 });
});

it('takes a new fix when there is no cached one', async () => {
  loc.getLastKnownPositionAsync.mockResolvedValue(null);
  loc.getCurrentPositionAsync.mockResolvedValue(fix(3, 4));
  await expect(getQuickLocation()).resolves.toBe('3,4');
});

it('quick location times out and returns null instead of hanging', async () => {
  loc.getLastKnownPositionAsync.mockResolvedValue(null);
  loc.getCurrentPositionAsync.mockReturnValue(new Promise(() => undefined));
  await expect(getQuickLocation(120000, 20)).resolves.toBeNull();
});

it('returns null when permission is denied', async () => {
  loc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
  loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
  await expect(getQuickLocation()).resolves.toBeNull();
  expect(loc.getLastKnownPositionAsync).not.toHaveBeenCalled();
});
```

Create `ShiftWork.Mobile/hooks/__tests__/useNfcPunch.test.tsx`:

```tsx
jest.mock('@/services/nfc-punch.service', () => ({ nfcPunchService: { punch: jest.fn() } }));
jest.mock('@/utils', () => ({
  getQuickLocation: jest.fn(),
  saveActiveClockInAt: jest.fn().mockResolvedValue(undefined),
  clearActiveClockInAt: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/hooks/queries', () => ({
  shiftEventsKey: (companyId: string, personId: number) => ['shiftEvents', companyId, personId],
}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('expo-device', () => ({ modelName: 'Pixel 8' }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { nfcPunchService } from '@/services/nfc-punch.service';
import { getQuickLocation, saveActiveClockInAt, clearActiveClockInAt } from '@/utils';
import { classifyNfcPunchError, useNfcPunch } from '../useNfcPunch';

const punchMock = nfcPunchService.punch as jest.Mock;
const uuidMock = Crypto.randomUUID as jest.Mock;
const result = (over: Partial<Record<string, unknown>> = {}) => ({
  eventLogId: 'id-1', eventType: 'clockin', eventDate: '2026-09-30T12:00:00Z', locationId: 10,
  locationName: 'North Tower', geofenceStatus: 'Inside', repeated: false, ...over,
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['shiftEvents', 'co', 1], []);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useNfcPunch('co', 1), { wrapper });
  return { client, hook };
}

beforeEach(() => {
  jest.clearAllMocks();
  // mockReset, not just clear: leftover *Once values would leak between tests.
  punchMock.mockReset();
  uuidMock.mockReset();
  (getQuickLocation as jest.Mock).mockResolvedValue('1,2');
  uuidMock.mockReturnValueOnce('uuid-A').mockReturnValueOnce('uuid-B');
});

it('punches, shows success, and records the clock-in locally', async () => {
  punchMock.mockResolvedValue(result());
  const { client, hook } = setup();

  await act(() => hook.result.current.punch('KEY'));

  expect(punchMock).toHaveBeenCalledWith('co', expect.objectContaining({
    tagKey: 'KEY', eventLogId: 'uuid-A', geoLocation: '1,2', device: 'Pixel 8',
  }));
  expect(hook.result.current.state).toEqual({ status: 'success', result: result() });
  expect(saveActiveClockInAt).toHaveBeenCalledWith(new Date('2026-09-30T12:00:00Z').toISOString());
  expect(client.getQueryData<unknown[]>(['shiftEvents', 'co', 1])).toHaveLength(1);
});

it('clears the local clock-in after a clock-out', async () => {
  punchMock.mockResolvedValue(result({ eventType: 'clockout' }));
  const { hook } = setup();
  await act(() => hook.result.current.punch('KEY'));
  expect(clearActiveClockInAt).toHaveBeenCalled();
});

it('does not add a repeated tap to the event list', async () => {
  punchMock.mockResolvedValue(result({ repeated: true }));
  const { client, hook } = setup();
  await act(() => hook.result.current.punch('KEY'));
  expect(client.getQueryData<unknown[]>(['shiftEvents', 'co', 1])).toHaveLength(0);
});

it('posts without geoLocation when there is no fix', async () => {
  (getQuickLocation as jest.Mock).mockResolvedValue(null);
  punchMock.mockResolvedValue(result({ geofenceStatus: 'Unknown' }));
  const { hook } = setup();
  await act(() => hook.result.current.punch('KEY'));
  expect(punchMock.mock.calls[0][1].geoLocation).toBeUndefined();
  expect(hook.result.current.state.status).toBe('success');
});

it('retry reuses the eventLogId and tap time; reset starts a new punch', async () => {
  punchMock.mockRejectedValueOnce({ statusCode: 0, message: 'Network error' });
  const { hook } = setup();

  await act(() => hook.result.current.punch('KEY'));
  expect(hook.result.current.state).toEqual({ status: 'error', kind: 'offline', message: 'Network error' });

  punchMock.mockResolvedValueOnce(result());
  await act(() => hook.result.current.punch('KEY'));
  expect(punchMock.mock.calls[1][1].eventLogId).toBe('uuid-A');
  expect(punchMock.mock.calls[1][1].eventDate).toBe(punchMock.mock.calls[0][1].eventDate);

  act(() => hook.result.current.reset());
  punchMock.mockResolvedValueOnce(result());
  await act(() => hook.result.current.punch('KEY'));
  expect(punchMock.mock.calls[2][1].eventLogId).toBe('uuid-B');
});

it('ignores a second punch while one is in flight', async () => {
  let resolve!: (v: unknown) => void;
  punchMock.mockReturnValue(new Promise((r) => { resolve = r; }));
  const { hook } = setup();

  let first!: Promise<void>;
  act(() => { first = hook.result.current.punch('KEY'); });
  await act(() => hook.result.current.punch('KEY'));
  resolve(result());
  await act(() => first);

  expect(punchMock).toHaveBeenCalledTimes(1);
});

describe('classifyNfcPunchError', () => {
  it.each([
    [{ statusCode: 0 }, 'offline'],
    [{ statusCode: 404 }, 'unknown_tag'],
    [{ statusCode: 401 }, 'signed_out'],
    [{ statusCode: 409 }, 'failed'],
    [new Error('x'), 'failed'],
    [undefined, 'failed'],
  ])('%p → %s', (err, kind) => {
    expect(classifyNfcPunchError(err)).toBe(kind);
  });
});
```

Create `ShiftWork.Mobile/components/screens/nfc/__tests__/NfcPunchResultView.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NfcPunchResultView } from '../NfcPunchResultView';

const success = (over: Record<string, unknown> = {}) => ({
  status: 'success' as const,
  result: {
    eventLogId: 'e', eventType: 'clockin' as const, eventDate: '2026-09-30T12:00:00Z', locationId: 10,
    locationName: 'North Tower', geofenceStatus: 'Inside', repeated: false, ...over,
  },
});

it('shows the sending state', () => {
  const { getByText } = render(<NfcPunchResultView state={{ status: 'sending' }} onRetry={jest.fn()} onDone={jest.fn()} />);
  getByText('nfc.sending');
});

it('shows clocked in with Done and no Undo', () => {
  const onDone = jest.fn();
  const { getByText, queryByText } = render(<NfcPunchResultView state={success()} onRetry={jest.fn()} onDone={onDone} />);
  getByText('nfc.clocked_in');
  fireEvent.press(getByText('nfc.done'));
  expect(onDone).toHaveBeenCalled();
  expect(queryByText(/undo/i)).toBeNull();
  expect(queryByText('nfc.outside_site')).toBeNull();
});

it('shows clocked out, the repeat note and the outside note', () => {
  const { getByText } = render(
    <NfcPunchResultView state={success({ eventType: 'clockout', repeated: true, geofenceStatus: 'Outside' })} onRetry={jest.fn()} onDone={jest.fn()} />,
  );
  getByText('nfc.clocked_out');
  getByText('nfc.already_recorded');
  getByText('nfc.outside_site');
});

it('offers Try again when offline', () => {
  const onRetry = jest.fn();
  const { getByText } = render(
    <NfcPunchResultView state={{ status: 'error', kind: 'offline' }} onRetry={onRetry} onDone={jest.fn()} />,
  );
  getByText('nfc.error_offline');
  fireEvent.press(getByText('nfc.try_again'));
  expect(onRetry).toHaveBeenCalled();
});

it('does not offer Try again for an unknown tag', () => {
  const { getByText, queryByText } = render(
    <NfcPunchResultView state={{ status: 'error', kind: 'unknown_tag' }} onRetry={jest.fn()} onDone={jest.fn()} />,
  );
  getByText('nfc.error_unknown_tag');
  expect(queryByText('nfc.try_again')).toBeNull();
});

it('shows the server message for other failures', () => {
  const { getByText } = render(
    <NfcPunchResultView state={{ status: 'error', kind: 'failed', message: 'Person is already OnShift.' }} onRetry={jest.fn()} onDone={jest.fn()} />,
  );
  getByText('nfc.error_failed');
  getByText('Person is already OnShift.');
});
```

Add to `ShiftWork.Mobile/utils/__tests__/nfcTag.test.ts`:

```ts
import { isTagLaunchUrl } from '../nfcTag';

describe('isTagLaunchUrl', () => {
  it('is true for a tag link and false otherwise', () => {
    expect(isTagLaunchUrl('https://t.loqzen.com/t/Ab3_-xyz0123456789ABCD')).toBe(true);
    expect(isTagLaunchUrl('loqzen://dashboard')).toBe(false);
    expect(isTagLaunchUrl(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd ShiftWork.Mobile && npx jest utils/__tests__/quickLocation.test.ts hooks/__tests__/useNfcPunch.test.tsx components/screens/nfc utils/__tests__/nfcTag.test.ts`
Expected: FAIL with "getQuickLocation is not a function", "Cannot find module '../useNfcPunch'", "Cannot find module '../NfcPunchResultView'" and "isTagLaunchUrl is not a function".

- [ ] **Step 3: Quick location, tag-launch check, pending store**

Append to `ShiftWork.Mobile/utils/location.utils.ts`:

```ts
/**
 * A fast position for punches: a recent cached fix if there is one, else a balanced fix capped at
 * `timeoutMs`. Null (never a throw) when permission is denied or no fix arrives in time. The server
 * then flags the punch GeofenceStatus = Unknown instead of refusing it.
 */
export const getQuickLocation = async (maxAgeMs = 120_000, timeoutMs = 4_000): Promise<string | null> => {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    const granted = current.status === 'granted' || (await requestLocationPermission());
    if (!granted) return null;

    const cached = await Location.getLastKnownPositionAsync({ maxAge: maxAgeMs, requiredAccuracy: 200 });
    if (cached) return `${cached.coords.latitude},${cached.coords.longitude}`;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); });
    try {
      const fresh = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        timeout,
      ]);
      return fresh ? `${fresh.coords.latitude},${fresh.coords.longitude}` : null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
};
```

Append to `ShiftWork.Mobile/utils/nfcTag.ts`:

```ts
/** True when the app was opened by a tag link, so start-up must not navigate away from /t/<key>. */
export function isTagLaunchUrl(url: string | null | undefined): boolean {
  return parseTagKey(url) !== null;
}
```

Create `ShiftWork.Mobile/store/pendingTagStore.ts`:

```ts
import { create } from 'zustand';

/** A tag tapped while signed out; resumed after sign-in by the tabs layout. Memory only. */
interface PendingTagState {
  tagKey: string | null;
  setTagKey: (tagKey: string | null) => void;
  take: () => string | null;
}

export const usePendingTagStore = create<PendingTagState>((set, get) => ({
  tagKey: null,
  setTagKey: (tagKey) => set({ tagKey }),
  take: () => {
    const tagKey = get().tagKey;
    set({ tagKey: null });
    return tagKey;
  },
}));
```

- [ ] **Step 4: The punch hook**

Create `ShiftWork.Mobile/hooks/useNfcPunch.ts`:

```ts
import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { nfcPunchService } from '@/services/nfc-punch.service';
import { getQuickLocation, saveActiveClockInAt, clearActiveClockInAt } from '@/utils';
import { shiftEventsKey } from '@/hooks/queries';
import type { NfcPunchResult, ShiftEventDto } from '@/types/api';

export type NfcPunchErrorKind = 'offline' | 'unknown_tag' | 'signed_out' | 'failed';

export type NfcPunchState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'success'; result: NfcPunchResult }
  | { status: 'error'; kind: NfcPunchErrorKind; message?: string };

/** api-client rejects with { statusCode, message }; statusCode 0 means no response (offline). */
export function classifyNfcPunchError(error: unknown): NfcPunchErrorKind {
  const statusCode = (error as { statusCode?: number } | undefined)?.statusCode;
  if (statusCode === 0) return 'offline';
  if (statusCode === 404) return 'unknown_tag';
  if (statusCode === 401) return 'signed_out';
  return 'failed';
}

export function useNfcPunch(companyId: string | null, personId: number | null) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<NfcPunchState>({ status: 'idle' });
  // One tap = one id + tap time, kept across "Try again" so a punch the server already saved
  // (response lost to a timeout) is returned instead of recorded twice.
  const attempt = useRef<{ eventLogId: string; eventDate: string } | null>(null);
  const inFlight = useRef(false);

  const reset = useCallback(() => {
    attempt.current = null;
    setState({ status: 'idle' });
  }, []);

  const punch = useCallback(async (tagKey: string) => {
    if (!companyId || !personId || inFlight.current) return;
    inFlight.current = true;
    attempt.current ??= { eventLogId: Crypto.randomUUID(), eventDate: new Date().toISOString() };
    setState({ status: 'sending' });

    try {
      const geoLocation = await getQuickLocation();
      const result = await nfcPunchService.punch(companyId, {
        tagKey,
        eventLogId: attempt.current.eventLogId,
        eventDate: attempt.current.eventDate,
        geoLocation: geoLocation ?? undefined,
        device: Device.modelName ?? 'mobile-device',
      });

      if (!result.repeated) {
        if (result.eventType === 'clockin') {
          await saveActiveClockInAt(new Date(result.eventDate).toISOString());
        } else {
          await clearActiveClockInAt();
        }
        const event = {
          eventLogId: result.eventLogId,
          eventDate: new Date(result.eventDate),
          eventType: result.eventType,
          companyId,
          personId,
          locationId: result.locationId,
          geofenceStatus: result.geofenceStatus,
        } as ShiftEventDto;
        queryClient.setQueryData<ShiftEventDto[]>(shiftEventsKey(companyId, personId), (prev) => [event, ...(prev ?? [])]);
        queryClient.invalidateQueries({ queryKey: ['dashboard', companyId, personId] });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setState({ status: 'success', result });
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setState({ status: 'error', kind: classifyNfcPunchError(error), message: (error as { message?: string })?.message });
    } finally {
      inFlight.current = false;
    }
  }, [companyId, personId, queryClient]);

  return { state, punch, reset };
}
```

- [ ] **Step 5: Result view**

Create `ShiftWork.Mobile/components/screens/nfc/NfcPunchResultView.tsx`:

```tsx
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { colors, spacing } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import type { NfcPunchErrorKind, NfcPunchState } from '@/hooks/useNfcPunch';

const ERROR_TEXT: Record<NfcPunchErrorKind, string> = {
  offline: 'nfc.error_offline',
  unknown_tag: 'nfc.error_unknown_tag',
  signed_out: 'nfc.sign_in_first',
  failed: 'nfc.error_failed',
};

interface Props {
  state: NfcPunchState;
  onRetry: () => void;
  onDone: () => void;
}

export function NfcPunchResultView({ state, onRetry, onDone }: Props) {
  const { t } = useTranslation();

  if (state.status === 'idle' || state.status === 'sending') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.subtitle}>{t('nfc.sending')}</Text>
      </View>
    );
  }

  if (state.status === 'success') {
    const { result } = state;
    const isIn = result.eventType === 'clockin';
    const time = new Date(result.eventDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return (
      <View style={styles.center}>
        <Ionicons name={isIn ? 'log-in-outline' : 'log-out-outline'} size={96} color={isIn ? colors.success : colors.primary} />
        <Text style={styles.title}>{t(isIn ? 'nfc.clocked_in' : 'nfc.clocked_out')}</Text>
        <Text style={styles.subtitle}>{t('nfc.at_site_time', { site: result.locationName, time })}</Text>
        {result.repeated && <Text style={styles.note}>{t('nfc.already_recorded')}</Text>}
        {result.geofenceStatus === 'Outside' && <Text style={[styles.note, styles.warning]}>{t('nfc.outside_site')}</Text>}
        <Button label={t('nfc.done')} onPress={onDone} size="lg" fullWidth style={styles.button} />
      </View>
    );
  }

  const canRetry = state.kind === 'offline' || state.kind === 'failed';
  return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={96} color={colors.danger} />
      <Text style={styles.title}>{t(ERROR_TEXT[state.kind])}</Text>
      {state.kind === 'failed' && !!state.message && <Text style={styles.note}>{state.message}</Text>}
      {canRetry && <Button label={t('nfc.try_again')} onPress={onRetry} size="lg" fullWidth style={styles.button} />}
      <Button label={t('nfc.done')} onPress={onDone} variant="ghost" fullWidth style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, backgroundColor: colors.background },
  title: { fontSize: 30, fontWeight: '700', color: colors.text, marginTop: spacing.lg, textAlign: 'center' },
  subtitle: { fontSize: 18, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
  note: { fontSize: 15, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' },
  warning: { color: colors.warning },
  button: { marginTop: spacing.xl },
});
```

- [ ] **Step 6: Route**

Create `ShiftWork.Mobile/app/t/[tagKey].tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { NfcPunchResultView } from '@/components/screens/nfc/NfcPunchResultView';
import { useNfcPunch } from '@/hooks/useNfcPunch';
import { usePendingTagStore } from '@/store/pendingTagStore';
import { isValidTagKey } from '@/utils/nfcTag';
import { getCompanyId, getToken, getUserData } from '@/utils/storage.utils';

type Session = { companyId: string; personId: number };

/** Opened by a tag link (https://t.loqzen.com/t/<key>) or by the in-app scan button. */
export default function NfcTapScreen() {
  const router = useRouter();
  const { tagKey: rawKey } = useLocalSearchParams<{ tagKey: string }>();
  const tagKey = typeof rawKey === 'string' && isValidTagKey(rawKey) ? rawKey : null;
  // undefined = still reading storage; null = signed out.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const { state, punch, reset } = useNfcPunch(session?.companyId ?? null, session?.personId ?? null);

  // Read the stored sign-in directly: a tag can cold-start the app before the root layout restores it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, user, companyId] = await Promise.all([getToken(), getUserData(), getCompanyId()]);
      if (cancelled) return;
      setSession(token && user?.personId && companyId ? { companyId, personId: Number(user.personId) } : null);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (session === null && tagKey) {
      usePendingTagStore.getState().setTagKey(tagKey);
      router.replace('/(auth)/login' as any);
    }
  }, [session, tagKey, router]);

  useEffect(() => {
    if (!session || !tagKey) return;
    reset();
    punch(tagKey);
  }, [session, tagKey, punch, reset]);

  const done = () => router.replace('/(tabs)/clock' as any);

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <NfcPunchResultView
        state={tagKey ? state : { status: 'error', kind: 'unknown_tag' }}
        onRetry={() => { if (tagKey) punch(tagKey); }}
        onDone={done}
      />
    </>
  );
}
```

- [ ] **Step 7: Start-up and sign-in wiring**

In `ShiftWork.Mobile/app/_layout.tsx`:
1. Add the imports `import { Linking } from 'react-native';` and `import { isTagLaunchUrl } from '@/utils/nfcTag';`.
2. Replace `const [token, userData, companyId] = await Promise.all([getToken(), getUserData(), getCompanyId()]);` with:

```ts
        const [token, userData, companyId, initialUrl] = await Promise.all([
          getToken(),
          getUserData(),
          getCompanyId(),
          Linking.getInitialURL(),
        ]);
```

3. Replace the redirect condition `if (!authInitialized.current) {` (the one wrapping `router.replace('/(tabs)/dashboard' as any);`) with:

```ts
          // A tag tap cold-starts the app on /t/<key>; replacing it with the dashboard would drop the punch.
          if (!authInitialized.current && !isTagLaunchUrl(initialUrl)) {
```

4. In the `<Stack>`, add `<Stack.Screen name="t/[tagKey]" options={{ headerShown: false }} />` after the `(tabs)` screen.

In `ShiftWork.Mobile/app/(tabs)/_layout.tsx`:
1. Add the imports `import { useEffect } from 'react';`, `import { useRouter } from 'expo-router';` (merge with the existing `expo-router` import) and `import { usePendingTagStore } from '@/store/pendingTagStore';`.
2. Inside `TabsLayout`, after `useServerLocale();`, add:

```ts
  const router = useRouter();
  // Finish a tag tap that had to wait for sign-in (tabs mount only once signed in).
  useEffect(() => {
    const pending = usePendingTagStore.getState().take();
    if (pending) router.push(`/t/${pending}` as any);
  }, [router]);
```

- [ ] **Step 8: Run the tests**

Run: `cd ShiftWork.Mobile && npx jest utils hooks components/screens/nfc`
Expected: PASS (including the existing `useClockAction` test), with clean output.

Then run: `npx tsc --noEmit 2>&1 | grep -E "useNfcPunch|NfcPunchResultView|app/t/|pendingTagStore|location.utils|nfcTag|_layout" || echo "no type errors in touched files"`

- [ ] **Step 9: Commit**

```bash
git add ShiftWork.Mobile
git commit -m "feat(mobile): punch from an NFC tag link with retry-safe ids and quick GPS

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016LZHZKjFhKb8kPYF3sUF9v"
```

---

### Task 8: Mobile Clock screen by site type (NFC required, scan button)

**Files:**
- Modify: `ShiftWork.Mobile/hooks/queries/index.ts` (add `locationDetailsKey`, `useLocationDetails` and `nfcTagLinksKey`, `useNfcTagLinks`)
- Modify: `ShiftWork.Mobile/hooks/useClockAction.ts`
- Modify: `ShiftWork.Mobile/hooks/__tests__/useClockAction.test.ts`
- Create: `ShiftWork.Mobile/hooks/useNfcAvailability.ts`
- Create: `ShiftWork.Mobile/components/screens/clock/NfcClockPanel.tsx`
- Test: `ShiftWork.Mobile/components/screens/clock/__tests__/NfcClockPanel.test.tsx`
- Modify: `ShiftWork.Mobile/app/(tabs)/clock.tsx`

**Interfaces:**
- Consumes: `LocationDto.requireNfc`/`nfcTagKey`, `nfcService.getAvailability`/`readTagKey`, `NfcAvailability` and `nfcPunchService.getTagLinks` (Task 6).
- Produces:
  - `useLocationDetails(companyId, locationId)` and `useNfcTagLinks(companyId)` (TanStack queries; `retry: false` for tag links).
  - `nfcTagLinksKey(companyId)`.
  - `ClockActionData.siteRequiresNfc: boolean` and `ClockActionData.siteHasNfcTag: boolean`.
  - `useNfcAvailability(): NfcAvailability | null` (null while checking; re-checked when the app returns to the foreground).
  - `<NfcClockPanel siteName required availability scanning onScan />`.

- [ ] **Step 1: Write the failing tests**

In `ShiftWork.Mobile/hooks/__tests__/useClockAction.test.ts`, extend the `@/hooks/queries` mock to:

```ts
jest.mock('@/hooks/queries', () => ({
  useShiftEvents: jest.fn(() => ({ data: [], isLoading: false, isError: false, error: null })),
  useClockMutation: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useLocationName: jest.fn(() => ({ data: null })),
  useLocationDetails: jest.fn(() => ({ data: null })),
}));
```

and append:

```ts
import { useLocationDetails } from '@/hooks/queries';

describe('useClockAction NFC site flags', () => {
  it('is a normal site when the location has no NFC settings', () => {
    const { result } = renderHook(() => useClockAction());
    expect(result.current.siteRequiresNfc).toBe(false);
    expect(result.current.siteHasNfcTag).toBe(false);
  });

  it('reports an NFC-required site with a tag', () => {
    (useLocationDetails as jest.Mock).mockReturnValue({ data: { requireNfc: true, nfcTagKey: 'k' } });
    const { result } = renderHook(() => useClockAction());
    expect(result.current.siteRequiresNfc).toBe(true);
    expect(result.current.siteHasNfcTag).toBe(true);
  });
});
```

Create `ShiftWork.Mobile/components/screens/clock/__tests__/NfcClockPanel.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NfcClockPanel } from '../NfcClockPanel';

const base = { siteName: 'North Tower', required: true, scanning: false, onScan: jest.fn() };

it('tells the employee to tap the tag at an NFC-required site and offers the scan button', () => {
  const onScan = jest.fn();
  const { getByText } = render(<NfcClockPanel {...base} availability="ready" onScan={onScan} />);
  getByText('nfc.required_at_site');
  fireEvent.press(getByText('nfc.scan_button'));
  expect(onScan).toHaveBeenCalled();
});

it('explains that a phone without NFC cannot punch at a required site', () => {
  const { getByText, queryByText } = render(<NfcClockPanel {...base} availability="unsupported" />);
  getByText('nfc.unsupported');
  expect(queryByText('nfc.scan_button')).toBeNull();
});

it('asks to turn NFC on when it is off', () => {
  const { getByText } = render(<NfcClockPanel {...base} availability="disabled" />);
  getByText('nfc.disabled');
});

it('shows only the scan button at an optional tagged site', () => {
  const { getByText, queryByText } = render(<NfcClockPanel {...base} required={false} availability="ready" />);
  getByText('nfc.scan_button');
  expect(queryByText('nfc.required_at_site')).toBeNull();
});

it('renders nothing at an optional site when the phone cannot scan', () => {
  const { toJSON } = render(<NfcClockPanel {...base} required={false} availability="unsupported" />);
  expect(toJSON()).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd ShiftWork.Mobile && npx jest hooks/__tests__/useClockAction.test.ts components/screens/clock`
Expected: FAIL. `siteRequiresNfc` is undefined, and `../NfcClockPanel` is not found.

- [ ] **Step 3: Queries**

In `ShiftWork.Mobile/hooks/queries/index.ts`, add the import `import { nfcPunchService } from '@/services/nfc-punch.service';` and add after `useLocationName`:

```ts
export const locationDetailsKey = (companyId: string, locationId: string | number) =>
  ['locationDetails', companyId, String(locationId)] as const;

/** Full location (incl. requireNfc / nfcTagKey) for today's shift site. */
export function useLocationDetails(companyId?: string | null, locationId?: string | number | null) {
  return useQuery({
    queryKey: locationDetailsKey(companyId ?? '', locationId ?? ''),
    queryFn: () => locationService.getLocationById(companyId!, Number(locationId!)),
    enabled: !!companyId && !!locationId,
    staleTime: 5 * 60_000,
  });
}

export const nfcTagLinksKey = (companyId: string) => ['nfcTagLinks', companyId] as const;

/** Managers only: a 403 (not an error to retry) means the user can't write tags. */
export function useNfcTagLinks(companyId?: string | null) {
  return useQuery({
    queryKey: nfcTagLinksKey(companyId ?? ''),
    queryFn: () => nfcPunchService.getTagLinks(companyId!),
    enabled: !!companyId,
    retry: false,
    staleTime: 60_000,
  });
}
```

Also add `['locationDetails', companyId, locationId]` and `['nfcTagLinks', companyId]` to the key list in the file header comment.

- [ ] **Step 4: useClockAction flags**

In `ShiftWork.Mobile/hooks/useClockAction.ts`:
- Change the import to `import { useLocationName, useLocationDetails } from './queries';`.
- Add `siteRequiresNfc: boolean;` and `siteHasNfcTag: boolean;` to `ClockActionData` after `isClockedIn: boolean;`.
- After the `useLocationName` line, add:

```ts
  // ── NFC settings of today's shift site ──
  const { data: shiftLocation = null } = useLocationDetails(companyId, todayShift?.locationId);
  const siteRequiresNfc = !!shiftLocation?.requireNfc;
  const siteHasNfcTag = !!shiftLocation?.nfcTagKey;
```

- In the returned object, add `siteRequiresNfc,` and `siteHasNfcTag,` after `isClockedIn,`.

- [ ] **Step 5: Availability hook and panel**

Create `ShiftWork.Mobile/hooks/useNfcAvailability.ts`:

```ts
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { nfcService, type NfcAvailability } from '@/services/nfc.service';

/** null while checking. Re-checked on return to the app, since people turn NFC on in Settings. */
export function useNfcAvailability(): NfcAvailability | null {
  const [availability, setAvailability] = useState<NfcAvailability | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = () => nfcService.getAvailability().then((value) => { if (!cancelled) setAvailability(value); });
    check();
    const subscription = AppState.addEventListener('change', (next) => { if (next === 'active') check(); });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return availability;
}
```

Create `ShiftWork.Mobile/components/screens/clock/NfcClockPanel.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { colors, radius, spacing } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import type { NfcAvailability } from '@/services/nfc.service';

interface Props {
  siteName: string | null;
  /** The site rejects the phone's clock button; the tag is the only way to punch. */
  required: boolean;
  availability: NfcAvailability | null;
  scanning: boolean;
  onScan: () => void;
}

export function NfcClockPanel({ siteName, required, availability, scanning, onScan }: Props) {
  const { t } = useTranslation();
  const canScan = availability === 'ready';

  if (!required && !canScan) return null;

  return (
    <View style={styles.card}>
      {required && (
        <View style={styles.header}>
          <Ionicons name="phone-portrait-outline" size={22} color={colors.primary} />
          <Text style={styles.title}>
            {siteName ? t('nfc.required_at_site', { site: siteName }) : t('nfc.tap_title')}
          </Text>
        </View>
      )}
      {required && availability === 'unsupported' && <Text style={styles.message}>{t('nfc.unsupported')}</Text>}
      {availability === 'disabled' && <Text style={styles.message}>{t('nfc.disabled')}</Text>}
      {canScan && (
        <Button label={t('nfc.scan_button')} onPress={onScan} loading={scanning} size="lg" fullWidth variant={required ? 'primary' : 'secondary'} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.text },
  message: { fontSize: 15, color: colors.textSecondary },
});
```

- [ ] **Step 6: Clock screen**

In `ShiftWork.Mobile/app/(tabs)/clock.tsx`:
1. Change the React Native import to include nothing new. Add these imports: `import { useState } from 'react';`, `import { useRouter } from 'expo-router';`, `import { NfcClockPanel } from '@/components/screens/clock/NfcClockPanel';`, `import { useNfcAvailability } from '@/hooks/useNfcAvailability';`, `import { nfcService } from '@/services/nfc.service';` and `import { useToast } from '@/hooks/useToast';`.
2. Add `siteRequiresNfc,` and `siteHasNfcTag,` to the `useClockAction()` destructuring.
3. After the destructuring, add:

```tsx
  const router = useRouter();
  const toast = useToast();
  const nfcAvailability = useNfcAvailability();
  const [scanning, setScanning] = useState(false);

  const scanTag = async () => {
    setScanning(true);
    try {
      const tagKey = await nfcService.readTagKey(t('nfc.scan_prompt'));
      if (tagKey) router.push(`/t/${tagKey}` as any);
      else toast.error(t('nfc.error_not_loqzen'));
    } catch {
      // Scan cancelled by the employee or timed out: nothing to report.
    } finally {
      setScanning(false);
    }
  };
```

4. Change the Safety questionnaire condition from `{!!todayShift && !isClockedIn && (` to `{!!todayShift && !isClockedIn && !siteRequiresNfc && (`. Its answers are submitted only with the phone's clock button.
5. Replace the `{/* Clock button */}` block (`<View style={styles.clockBtnArea}> ... </View>`) with:

```tsx
        {/* Clock button: hidden where the site only accepts NFC taps (the server rejects it too) */}
        {!siteRequiresNfc && (
          <View style={styles.clockBtnArea}>
            <ClockButton
              isClockedIn={isClockedIn}
              loading={loading}
              onPress={handleClock}
              photoUri={photoUri}
              onPhotoPress={() => setCameraOpen(true)}
              onRemovePhoto={() => setPhotoUri(null)}
            />
          </View>
        )}

        {(siteRequiresNfc || siteHasNfcTag) && (
          <NfcClockPanel
            siteName={shiftLocationName}
            required={siteRequiresNfc}
            availability={nfcAvailability}
            scanning={scanning}
            onScan={scanTag}
          />
        )}
```

- [ ] **Step 7: Run the tests**

Run: `cd ShiftWork.Mobile && npx jest hooks components/screens/clock`
Expected: PASS, with clean output.

Then run: `npx tsc --noEmit 2>&1 | grep -E "clock.tsx|NfcClockPanel|useNfcAvailability|useClockAction|queries/index" || echo "no type errors in touched files"`

- [ ] **Step 8: Commit**

```bash
git add ShiftWork.Mobile
git commit -m "feat(mobile): NFC-required clock screen and in-app tag scan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016LZHZKjFhKb8kPYF3sUF9v"
```

---

### Task 9: Mobile "Write tag" screen for managers, plus the setup doc

**Files:**
- Create: `ShiftWork.Mobile/app/nfc/write-tag.tsx`
- Test: `ShiftWork.Mobile/app/nfc/__tests__/write-tag.test.tsx`
- Create: `ShiftWork.Mobile/components/screens/profile/NfcWriteTagEntry.tsx`
- Modify: `ShiftWork.Mobile/app/(tabs)/profile.tsx` (after the `CredentialsSection` block)
- Modify: `Docs/nfc-tags-setup.md` (append sections 3 and 4)

**Interfaces:**
- Consumes:
  - `useNfcTagLinks` and `nfcTagLinksKey` (Task 8).
  - `nfcPunchService.createTagLink` and `nfcService.writeTagUrl` (Task 6).
  - `useNfcAvailability` (Task 8).
- Produces: route `/nfc/write-tag` and `<NfcWriteTagEntry />`. The entry is shown only when the tag-link list loads (manager) and the phone can read NFC.

- [ ] **Step 1: Write the failing test**

Create `ShiftWork.Mobile/app/nfc/__tests__/write-tag.test.tsx`:

```tsx
jest.mock('@/hooks/queries', () => ({
  useNfcTagLinks: jest.fn(),
  nfcTagLinksKey: (companyId: string) => ['nfcTagLinks', companyId],
}));
jest.mock('@/hooks/useNfcAvailability', () => ({ useNfcAvailability: jest.fn(() => 'ready') }));
jest.mock('@/services/nfc.service', () => ({ nfcService: { writeTagUrl: jest.fn(), cancel: jest.fn() } }));
jest.mock('@/services/nfc-punch.service', () => ({ nfcPunchService: { createTagLink: jest.fn() } }));
jest.mock('@/store/authStore', () => ({ useAuthStore: jest.fn(() => ({ companyId: 'co' })) }));
jest.mock('@/hooks/useToast', () => {
  const toast = { success: jest.fn(), error: jest.fn() };
  return { useToast: () => toast, __toast: toast };
});
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: 's' } }));
jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNfcTagLinks } from '@/hooks/queries';
import { useNfcAvailability } from '@/hooks/useNfcAvailability';
import { nfcService } from '@/services/nfc.service';
import { nfcPunchService } from '@/services/nfc-punch.service';
import WriteTagScreen from '../write-tag';

const toast = jest.requireMock('@/hooks/useToast').__toast;
const links = [
  { locationId: 1, name: 'North Tower', requireNfc: true, tagUrl: 'https://t.loqzen.com/t/AAAAAAAAAAAAAAAAAAAAAA', nfcLastTappedAt: null },
  { locationId: 2, name: 'Depot', requireNfc: false, tagUrl: null, nfcLastTappedAt: null },
];

function renderScreen() {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}><WriteTagScreen /></QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  (useNfcTagLinks as jest.Mock).mockReturnValue({ data: links, isLoading: false, error: null });
  (useNfcAvailability as jest.Mock).mockReturnValue('ready');
});

it('writes the chosen site link without locking by default', async () => {
  const { getByText } = renderScreen();
  fireEvent.press(getByText('North Tower'));
  await act(async () => { fireEvent.press(getByText('nfc.write_button')); });

  expect(nfcService.writeTagUrl).toHaveBeenCalledWith(links[0].tagUrl, 'nfc.write_prompt', false);
  expect(toast.success).toHaveBeenCalledWith('nfc.write_success');
});

it('locks the tag when the switch is on', async () => {
  const { getByText, getByRole } = renderScreen();
  fireEvent.press(getByText('North Tower'));
  fireEvent(getByRole('switch'), 'valueChange', true);
  await act(async () => { fireEvent.press(getByText('nfc.write_button')); });

  expect(nfcService.writeTagUrl).toHaveBeenCalledWith(links[0].tagUrl, 'nfc.write_prompt', true);
});

it('offers to create a link for a site without one', async () => {
  (nfcPunchService.createTagLink as jest.Mock).mockResolvedValue({});
  const { getByText, queryByText } = renderScreen();
  fireEvent.press(getByText('Depot'));
  expect(queryByText('nfc.write_button')).toBeNull();
  await act(async () => { fireEvent.press(getByText('nfc.write_create_link')); });

  expect(nfcPunchService.createTagLink).toHaveBeenCalledWith('co', 2);
});

it('reports a failed write', async () => {
  (nfcService.writeTagUrl as jest.Mock).mockRejectedValue(new Error('tag lost'));
  const { getByText } = renderScreen();
  fireEvent.press(getByText('North Tower'));
  await act(async () => { fireEvent.press(getByText('nfc.write_button')); });

  expect(toast.error).toHaveBeenCalledWith('nfc.write_failed');
});

it('tells non-managers that only managers can write tags', () => {
  (useNfcTagLinks as jest.Mock).mockReturnValue({ data: undefined, isLoading: false, error: { statusCode: 403 } });
  const { getByText } = renderScreen();
  getByText('nfc.write_managers_only');
});

it('explains when the phone cannot write tags', () => {
  (useNfcAvailability as jest.Mock).mockReturnValue('unsupported');
  const { getByText } = renderScreen();
  getByText('nfc.unsupported');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd ShiftWork.Mobile && npx jest app/nfc`
Expected: FAIL with "Cannot find module '../write-tag'".

- [ ] **Step 3: Screen**

Create `ShiftWork.Mobile/app/nfc/write-tag.tsx`:

```tsx
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import { colors, radius, spacing } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useNfcTagLinks, nfcTagLinksKey } from '@/hooks/queries';
import { useNfcAvailability } from '@/hooks/useNfcAvailability';
import { nfcService } from '@/services/nfc.service';
import { nfcPunchService } from '@/services/nfc-punch.service';

/** Managers write a site's tag link onto a blank NFC tag. */
export default function WriteTagScreen() {
  const { t } = useTranslation();
  const { companyId } = useAuthStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  const availability = useNfcAvailability();
  const { data: links, isLoading, error } = useNfcTagLinks(companyId);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lock, setLock] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected = links?.find((l) => l.locationId === selectedId) ?? null;
  const forbidden = (error as { statusCode?: number } | null)?.statusCode === 403;

  const createLink = async () => {
    if (!companyId || !selected) return;
    setBusy(true);
    try {
      await nfcPunchService.createTagLink(companyId, selected.locationId);
      await queryClient.invalidateQueries({ queryKey: nfcTagLinksKey(companyId) });
    } catch (e: any) {
      toast.error(e?.message ?? t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const writeTag = async () => {
    if (!selected?.tagUrl) return;
    setBusy(true);
    try {
      await nfcService.writeTagUrl(selected.tagUrl, t('nfc.write_prompt'), lock);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('nfc.write_success', { site: selected.name }));
    } catch {
      toast.error(t('nfc.write_failed'));
    } finally {
      setBusy(false);
    }
  };

  let body: ReactNode;
  if (forbidden) {
    body = <Text style={styles.message}>{t('nfc.write_managers_only')}</Text>;
  } else if (availability === 'unsupported') {
    body = <Text style={styles.message}>{t('nfc.unsupported')}</Text>;
  } else if (isLoading || availability === null) {
    body = <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />;
  } else {
    body = (
      <>
        {availability === 'disabled' && <Text style={styles.message}>{t('nfc.disabled')}</Text>}
        <Text style={styles.sectionTitle}>{t('nfc.write_pick_site')}</Text>
        {(links ?? []).map((link) => (
          <Pressable
            key={link.locationId}
            onPress={() => setSelectedId(link.locationId)}
            style={[styles.row, link.locationId === selectedId && styles.rowSelected]}
            accessibilityRole="radio"
            accessibilityState={{ selected: link.locationId === selectedId }}
          >
            <Text style={styles.rowTitle}>{link.name}</Text>
            {!link.tagUrl && <Text style={styles.rowHint}>{t('nfc.write_no_link')}</Text>}
            {link.locationId === selectedId && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
          </Pressable>
        ))}

        {selected && !selected.tagUrl && (
          <Button label={t('nfc.write_create_link')} onPress={createLink} loading={busy} fullWidth style={styles.action} />
        )}

        {selected?.tagUrl && (
          <>
            <View style={styles.lockRow}>
              <Text style={styles.lockText}>{t('nfc.write_lock')}</Text>
              <Switch value={lock} onValueChange={setLock} accessibilityRole="switch" />
            </View>
            <Button
              label={t('nfc.write_button')}
              onPress={writeTag}
              loading={busy}
              disabled={availability !== 'ready'}
              size="lg"
              fullWidth
              style={styles.action}
            />
          </>
        )}
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('nfc.write_title') }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>{body}</ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginVertical: spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.lg,
    borderRadius: radius.lg, backgroundColor: colors.surface, marginBottom: spacing.sm,
  },
  rowSelected: { borderWidth: 2, borderColor: colors.primary },
  rowTitle: { flex: 1, fontSize: 16, color: colors.text },
  rowHint: { fontSize: 13, color: colors.muted },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  lockText: { flex: 1, fontSize: 15, color: colors.text },
  action: { marginTop: spacing.lg },
  message: { fontSize: 16, color: colors.textSecondary, marginVertical: spacing.lg, textAlign: 'center' },
});
```

- [ ] **Step 4: Profile entry**

Create `ShiftWork.Mobile/components/screens/profile/NfcWriteTagEntry.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import { useNfcTagLinks } from '@/hooks/queries';
import { useNfcAvailability } from '@/hooks/useNfcAvailability';

/** Shown to managers (the tag-link list loads only with locations.update) on phones that can read NFC. */
export function NfcWriteTagEntry({ companyId }: { companyId?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data } = useNfcTagLinks(companyId);
  const availability = useNfcAvailability();

  if (!data || availability === null || availability === 'unsupported') return null;

  return (
    <View style={styles.section}>
      <Pressable style={styles.row} onPress={() => router.push('/nfc/write-tag' as any)} accessibilityRole="button">
        <Ionicons name="pricetag-outline" size={20} color={colors.primary} />
        <Text style={styles.label}>{t('nfc.write_entry')}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.lg,
    borderRadius: radius.lg, backgroundColor: colors.surface,
  },
  label: { flex: 1, fontSize: 16, color: colors.text },
});
```

In `ShiftWork.Mobile/app/(tabs)/profile.tsx`, add the import `import { NfcWriteTagEntry } from '@/components/screens/profile/NfcWriteTagEntry';`. Directly after the `CredentialsSection` `Animated.View` block, insert:

```tsx
      <Animated.View entering={FadeInDown.delay(210).duration(350)}>
        <NfcWriteTagEntry companyId={companyId ?? undefined} />
      </Animated.View>
```

- [ ] **Step 5: Run the tests**

Run: `cd ShiftWork.Mobile && npx jest app/nfc`
Expected: PASS.

Then run the full suite once: `npx jest 2>&1 | tail -15`. It should report all suites passing.

Then run: `npx tsc --noEmit 2>&1 | grep -E "write-tag|NfcWriteTagEntry|profile.tsx" || echo "no type errors in touched files"`

- [ ] **Step 6: Setup doc: tags, testing and rollout**

Append to `Docs/nfc-tags-setup.md`:

```markdown
## 3. Writing tags

- Tags: NTAG213 (enough for the link), NTAG215 or NTAG216 stickers or cards. For metal surfaces use
  "on-metal" (anti-metal) tags.
- In Loqzen (managers): Profile → "Write NFC tags for jobsites" → choose the site → "Create tag link" if it has
  none → "Write tag" → hold a blank tag to the top of the phone. Turn on "Lock the tag" only for the final
  tag on the wall; a locked tag can never be rewritten.
- Backup: in the Angular admin, open the location and copy its tag link, then write it as a **URL/URI record**
  with a free app such as NFC Tools (iOS/Android).
- Regenerate (Angular location form) makes the old tag stop working immediately; write the new link.

## 4. Device test checklist (development build)

Phones: an NFC Android, an iPhone XS or later, and an older iPhone (scan button only).

| # | Case | Expected |
|---|------|----------|
| 1 | Android, app closed, tap tag | App opens on "Clocked IN, <site> at <time>" |
| 2 | iPhone XS+, app closed, tap tag | "Open in Loqzen" banner → tap → Clocked IN |
| 3 | Tap again within a minute | "Already recorded a moment ago", no second punch |
| 4 | Tap again after a minute | Clocked OUT |
| 5 | Older iPhone: Clock tab → "Scan NFC tag" | Punch recorded |
| 6 | Airplane mode, tap | "No connection…" + Try again; after reconnecting, Try again records once |
| 7 | Location permission off | Punch recorded; admin shows geofence Unknown |
| 8 | Tap far from the site (tag carried away) | Punch recorded and flagged Outside |
| 9 | Signed out, tap | Sign in → punch completes |
| 10 | RequireNfc site: Clock tab | Button replaced by "Tap the NFC tag at <site>…" |
| 11 | RequireNfc site: old app build uses the clock button | Server refuses with "requires tapping the NFC tag" |
| 12 | Regenerate in Angular, tap the old tag | "This tag isn't linked to a site in your company." |
| 13 | Kiosk and Angular manager entry at a RequireNfc site | Work as before |

## 5. Rollout order

1. Deploy the API (the migration `AddNfcPunch` adds three Location columns and a filtered unique index).
   Before deploying, run `dotnet ef migrations has-pending-model-changes` in `ShiftWork.Api`: it must say
   there are no changes (the migration was written by hand).
2. Set up the tag host (section 1) and the `NfcTags` settings; check the three URLs.
3. Deploy Angular. Build the mobile app with EAS and install it on the test phones; run section 4.
4. Create tag links and write tags. Turn on "Require NFC" per site only after its tag is on the wall and
   employees have the new app version (older app versions can't punch at a RequireNfc site from the phone).
```

- [ ] **Step 7: Commit**

```bash
git add ShiftWork.Mobile Docs/nfc-tags-setup.md
git commit -m "feat(mobile): manager screen to write NFC tags for jobsites

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016LZHZKjFhKb8kPYF3sUF9v"
git push
```

---

## Self-Review (done while writing)

**Spec coverage:**
- §1 data: Task 1.
- §1 `nfc-punch` endpoint: Task 3.
  - Tenant scoping: `UnknownOrOtherCompanyTag_Is404`.
  - In/Out: `FirstTap_ClocksIn` and `Tap_WhenOnShift_ClocksOut`.
  - Idempotency and 409: Task 3 tests.
  - Date window: `PunchTime`.
  - Geofence flag: Outside and Unknown tests.
  - `NfcLastTappedAt`: Task 3.
- §1 NFC_REQUIRED rule, and that manager and kiosk punches are unaffected: Task 2.
- §1 regenerate and DTO fields: Task 1. The tag host and fallback page: Task 4.
- §2 Angular: Task 5.
- §3 Mobile:
  - Tap flow: Task 7.
  - Signed-out resume: Tasks 7 (store and tabs).
  - Scan button and clock screen by site type: Task 8.
  - Write tag and errors: Tasks 7 and 9.
  - No Undo: asserted in the `NfcPunchResultView` test.
- §4 testing: the per-task tests plus the device checklist (Task 9 doc).
- §5 tag domain: app.json and plugin (Task 6); well-known files (Task 4); needed values and DNS (doc).
- Open item "self-service vs manager": settled in Global Constraints and Task 2 (`personId` claim equals DTO `PersonId`).

**Additions beyond the spec (to confirm with William):**
- The 60 s repeat-tap window.
- The NFC punch working at optional tagged sites.
- Removal of the stale `android/` folder.
- Hiding the safety questionnaire at RequireNfc sites.

**Type consistency:**
- `NfcPunchResult` fields match `NfcPunchResponse` in camelCase.
- `nfcTagLinksKey` and `useNfcTagLinks` are defined in Task 8 and consumed in Task 9.
- `NfcAvailability` is defined in Task 6 and consumed in Tasks 8 and 9.
- `isTagLaunchUrl` is defined and used in Task 7.
