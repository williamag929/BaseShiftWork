# Lineup Admin (API + Angular) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins give foremen a job-site scope, set each location's default shift, and grant the `lineup.*` permissions from the Angular web app, so the Lineup screen on mobile is usable by non-admin users.

**Architecture:** Two small API surfaces are added: a default-shift write path on locations (merged into the existing `Location.Settings` JSON, which today nothing writes and `PUT location` silently wipes) and a read/replace endpoint for `UserLocationScope` rows on company users. The Angular app gets three UI changes: a "Lineup" permission group in the role editor, a default-shift section on the location form, and a "Locations" scope dialog on the company-users admin page.

**Tech Stack:** .NET 9 / EF Core / AutoMapper / xUnit + EF InMemory + Moq (API); Angular 19 (NgModules, Angular Material 19, ngrx store, Karma/Jasmine, native i18n `i18n="@@key"`) (web).

**Spec:** `docs/superpowers/specs/2026-09-29-mobile-lineup-design.md` (§4 Permissions and scope: "Admin. The Angular app gets a screen to assign job-site scope to a user"; §8/§9 default shift behavior; Amendments F, H). Built on `feature/mobile-lineup-api`; the mobile side is already on `feature/mobile-lineup-app`.

## Global Constraints

- Work on a new branch `feature/lineup-admin` created from `feature/mobile-lineup-api` (it holds `UserLocationScope`, `LineupAccessService`, `LocationDefaultShift`, `DefaultShiftDto`, the lineup permissions). Do not touch `ShiftWork.Mobile`.
- **Default shift JSON shape is fixed by the reader** `ShiftWork.Api/Services/LocationDefaultShift.cs`: `Location.Settings` is a JSON object; the key is `"defaultShift"` with `{"start":"HH:mm","end":"HH:mm","areaId":<int, optional>}`. Times are exactly `"HH:mm"` (24h). The writer must produce JSON that `LocationDefaultShift.TryParse` reads back, and must preserve every other key in `Settings`.
- Default shift rules: `start == end` is invalid; `end` earlier than `start` is an overnight shift and is valid (Amendment H). A set `areaId` must be an `Area` of the same company **and** the same location.
- Permissions (`resource.action`): read scopes with `company-users.read`; write scopes with `company-users.roles.update`; write default shift with `locations.update`. No new permission keys. The three lineup keys already exist: `lineup.view`, `lineup.edit`, `lineup.all-locations`.
- `UserLocationScope` is keyed by `CompanyUserId` (string), with `CompanyId`; users are addressed in routes by `{uid}` (`CompanyUser.Uid`), as the existing roles endpoints do. Unique index `(CompanyId, CompanyUserId, LocationId)`.
- Every query is filtered by `companyId`. Controllers stay thin; logic lives in services; DTOs separate from models (repo CLAUDE.md).
- `LocationsController` caches `locations_{companyId}` and `location_{companyId}_{id}` for 5 minutes; every new write path evicts both.
- Strings: add keys to `translations-source/strings.json` (`en` and real `es`), then `cd translations-source && npm run validate && npm run generate:all`. Generated files (`ShiftWork.Angular/src/locale/messages*.xlf`, Mobile and Kiosk `en.ts`/`es.ts`) are committed and must only **gain** keys. Never hand-edit generated files. In templates use `i18n="@@feature.screen.element"` (plurals `_one`/`_other`).
- Angular specs must be registered in `ShiftWork.Angular/src/test.ts` (it imports specs explicitly). Component specs follow `features/dashboard/active-sites/active-sites.component.spec.ts` (jasmine spies, `provideMockStore`, `NO_ERRORS_SCHEMA`); service specs follow `core/services/active-site.service.spec.ts` (`HttpClientTestingModule`).
- Environment: there is no .NET SDK, so API code is desk-checked and CI is the real check (report "not run"). For Angular, try `cd ShiftWork.Angular && npm ci --legacy-peer-deps`, then Chromium at `/opt/pw-browsers` with a temporary no-sandbox Karma config kept **outside the repo** (do not edit `karma.conf.js`): `CHROME_BIN=<chromium path> npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --karma-config=<temp config> --include=<spec>`. If the browser cannot run, desk-check and report "not run".
- Commit message trailers on every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01FtV7vcBiBWJN4cAkEcehv1`. Do not push from a task.

## Review Focus

1. **Editing a location must not wipe its default shift.** Today `PUT location` nulls `Settings` on every save (the DTO has no Settings and `LocationService.Update` copies it). Pinned in Task 1 (`Update_preserves_settings` and a mapping test that `LocationDto -> Location` never sets `Settings`).
2. **Overnight vs zero-length default shift.** `22:00–06:00` is accepted, `07:00–07:00` is rejected, both on the server (Task 1) and in the Angular form (Task 4).
3. **Area from another location.** A default shift cannot point at another location's area, on the server (Task 1) and in the dropdown, which resets when the location changes (Task 4).
4. **Scope save edge cases.** Unknown location ids → 400 with no partial write; duplicate ids saved once; an inactive location stays in the scope; saving an empty list removes all scope rows and the dialog warns that the user will see no sites (Tasks 2 and 5).
5. **Double save / failure.** The scope dialog and the default-shift section disable their save button while a request is in flight and show the server error without closing (Tasks 4 and 5).

---

## File Structure

| File | Responsibility |
|---|---|
| `ShiftWork.Api/DTOs/LocationDto.cs` (modify) | add read-only `DefaultShift` |
| `ShiftWork.Api/Helpers/MappingProfiles.cs` (modify) | map `Settings -> DefaultShift`; never map `Settings` from DTO |
| `ShiftWork.Api/Services/LocationService.cs` (+ interface) | stop overwriting `Settings`; `SetDefaultShiftAsync`, `ClearDefaultShiftAsync` |
| `ShiftWork.Api/Controllers/LocationsController.cs` (modify) | `PUT/DELETE {locationId}/default-shift` |
| `ShiftWork.Api/DTOs/UserLocationScopeDto.cs`, `Services/UserLocationScopeService.cs` (new) | scope read/replace |
| `ShiftWork.Api/Controllers/CompanyUsersController.cs` (modify) | `GET/PUT {uid}/location-scopes` |
| `ShiftWork.Api/Program.cs` (modify) | register `IUserLocationScopeService` |
| `ShiftWork.Angular/src/app/core/models/location.model.ts`, `services/location.service.ts`, `services/company-users.service.ts` (modify) | models and HTTP wrappers |
| `features/dashboard/profiles/profiles.component.ts` (modify) | "Lineup" permission group |
| `features/dashboard/locations/locations.component.{ts,html}` (modify) | default-shift section |
| `features/admin/components/user-location-scope-dialog/*` (new), `company-users-admin.component.*`, `admin.module.ts` (modify) | scope dialog and entry button |
| `translations-source/strings.json` (modify) + generated files | new strings |

---

### Task 1: Default shift write path (API)

**Files:**
- Modify: `ShiftWork.Api/DTOs/LocationDto.cs`, `Helpers/MappingProfiles.cs`, `Services/LocationService.cs` (and `ILocationService`), `Controllers/LocationsController.cs`
- Test: `ShiftWork.Api.Tests/Locations/LocationDefaultShiftServiceTests.cs`, `ShiftWork.Api.Tests/Locations/LocationsControllerDefaultShiftTests.cs`

**Interfaces:**
- Consumes: `LocationDefaultShift.TryParse(string?)`, `DefaultShiftDto(string Start, string End, int? AreaId)` (`DTOs/LineupDtos.cs`), `LineupTestData.NewContext()/Company/Location` (`Lineup/LineupTestData.cs`).
- Produces:
  - `LocationDto.DefaultShift` (`DefaultShiftDto?`), filled from `Settings` on read; ignored on write.
  - `Task<DefaultShiftDto?> LocationService.SetDefaultShiftAsync(string companyId, int locationId, DefaultShiftDto input)` — `null` when the location is not in the company; throws `ArgumentException` (message safe to show) for invalid input.
  - `Task<bool> LocationService.ClearDefaultShiftAsync(string companyId, int locationId)` — `false` when the location is not found.
  - `PUT api/companies/{companyId}/locations/{locationId}/default-shift` (body `DefaultShiftDto`; 200 with the stored `DefaultShiftDto`, 400 `{message}`, 404) and `DELETE …/default-shift` (204, 404), both `[Authorize(Policy = "locations.update")]`, both evicting the two cache keys.

- [ ] **Step 1: Write failing service tests** (names and assertions):
  - `Set_writes_json_that_TryParse_reads_back`: set `07:00`/`15:30`/area 12 on a location with `Settings = null`; `LocationDefaultShift.TryParse(location.Settings)` equals `(07:00, 15:30, 12)`.
  - `Set_preserves_other_settings_keys`: start with `{"theme":"x"}`; after set, the JSON still has `theme == "x"` and a `defaultShift` object.
  - `Set_replaces_an_existing_default_shift`; `Set_with_invalid_existing_json_starts_a_fresh_object`.
  - `Set_accepts_overnight` (`22:00`–`06:00`); `Set_rejects_equal_times` (`07:00`–`07:00` throws `ArgumentException`); `Set_rejects_non_HHmm` (`7:00`, `07:00:00`, `"abc"`, null).
  - `Set_rejects_area_from_another_location` and `Set_rejects_area_from_another_company`; `Set_accepts_null_area`.
  - `Set_returns_null_for_unknown_location` and `Set_returns_null_for_other_companys_location`.
  - `Clear_removes_only_the_defaultShift_key` (other key kept; when only `defaultShift` existed `Settings` becomes null); `Clear_returns_false_for_unknown_location`.
  - `Update_preserves_settings`: a location with `Settings = {"defaultShift":{...}}` saved through `LocationService.Update(location with Settings == null)` still has the original `Settings`.
  - Mapping: `Location -> LocationDto` fills `DefaultShift` with `"07:00"/"15:30"/12` and leaves it null for bad/missing JSON; `LocationDto(DefaultShift != null) -> Location` leaves `Settings` null (use `new MapperConfiguration(c => c.AddProfile<MappingProfiles>())`).
- [ ] **Step 2: Write failing controller tests**: policy attribute is `locations.update` on both actions (reflection, as in `LineupControllerTests`); `PUT` maps `null` → 404, `ArgumentException` → 400 with its message, success → 200 with the DTO; `DELETE` false → 404, true → 204; after a successful `PUT` and `DELETE` the cache keys `locations_{companyId}` and `location_{companyId}_{id}` are gone from a seeded `IMemoryCache`.
- [ ] **Step 3: Run** `dotnet test ShiftWork.Api.Tests --filter "FullyQualifiedName~Locations"` — Expected: FAIL (members missing). If no SDK is available, record "not run".
- [ ] **Step 4: Implement** the members above. `LocationService.Update` no longer assigns `Settings`. Merge `Settings` with `System.Text.Json.Nodes.JsonNode`: parse the existing text as an object (anything else becomes a new object), set or remove only `"defaultShift"`, write times as `HH:mm` with `CultureInfo.InvariantCulture`, and store `null` when the object ends up empty. Validate area with `Areas.Any(a => a.AreaId == id && a.CompanyId == companyId && a.LocationId == locationId)`.
- [ ] **Step 5: Run** the same tests — Expected: PASS (or desk-checked, "not run").
- [ ] **Step 6: Commit** `feat(locations): default shift write path and stop Settings wipe`

---

### Task 2: Location scope endpoints (API)

**Files:**
- Create: `ShiftWork.Api/DTOs/UserLocationScopeDto.cs`, `ShiftWork.Api/Services/UserLocationScopeService.cs` (with `IUserLocationScopeService`)
- Modify: `ShiftWork.Api/Controllers/CompanyUsersController.cs`, `ShiftWork.Api/Program.cs`, `docs/superpowers/specs/2026-09-29-mobile-lineup-design.md`
- Test: `ShiftWork.Api.Tests/Lineup/UserLocationScopeServiceTests.cs`, `ShiftWork.Api.Tests/Lineup/CompanyUsersLocationScopeControllerTests.cs`

**Interfaces:**
- Consumes: `UserLocationScope(UserLocationScopeId, CompanyId, CompanyUserId, LocationId)`, `ShiftWorkContext.UserLocationScopes`, `CompanyUser.Uid/CompanyUserId`.
- Produces:
  - `record UserLocationScopeDto(List<int> LocationIds)`.
  - `Task<List<int>?> IUserLocationScopeService.GetAsync(string companyId, string uid)` — sorted ids; `null` when the user is not in the company.
  - `Task<List<int>?> IUserLocationScopeService.ReplaceAsync(string companyId, string uid, IEnumerable<int> locationIds)` — replaces the user's rows; returns the sorted stored ids; `null` for an unknown user; throws `InvalidOperationException("Unknown locations: 3, 9")` when any id is not a location of that company (inactive locations are allowed).
  - `GET api/companies/{companyId}/users/{uid}/location-scopes` → `UserLocationScopeDto` (`company-users.read`); `PUT …/location-scopes` body `UserLocationScopeDto` → `UserLocationScopeDto` (`company-users.roles.update`); 404 unknown user, 400 `{message}` on `InvalidOperationException`.

- [ ] **Step 1: Write failing service tests**: `Get_returns_sorted_ids`; `Get_ignores_other_users_and_other_companies`; `Get_returns_null_for_unknown_user`; `Replace_adds_removes_and_keeps_in_one_save` (existing `[1,2]`, replace with `[2,3]` → rows exactly `{2,3}`); `Replace_dedupes_ids`; `Replace_with_empty_list_removes_all_rows`; `Replace_rejects_unknown_location_and_writes_nothing` (existing rows unchanged, message `"Unknown locations: 9"`); `Replace_rejects_location_of_another_company`; `Replace_keeps_inactive_location`; `Replace_does_not_touch_other_users`; `Replace_returns_null_for_unknown_user`.
- [ ] **Step 2: Write failing controller tests**: both actions carry the policies above (reflection); `GET` 200/404; `PUT` 200 with ids, 404, and 400 carrying the exception message.
- [ ] **Step 3: Run** `dotnet test ShiftWork.Api.Tests --filter "FullyQualifiedName~LocationScope"` — Expected: FAIL (or "not run").
- [ ] **Step 4: Implement** the service (resolve the user by `Uid` and `CompanyId`, validate ids against `Locations` of the company, one `SaveChangesAsync`), the two controller actions (inject `IUserLocationScopeService` into `CompanyUsersController`; keep the existing constructor parameters), and `builder.Services.AddScoped<IUserLocationScopeService, UserLocationScopeService>()` next to the lineup registrations. Append **Amendment J** to the spec: default shift is written through `PUT/DELETE locations/{id}/default-shift` and merged into `Settings`; `PUT location` no longer touches `Settings`; scope is managed through `GET/PUT users/{uid}/location-scopes`.
- [ ] **Step 5: Run** the same tests — Expected: PASS (or desk-checked).
- [ ] **Step 6: Commit** `feat(company-users): location scope endpoints`

---

### Task 3: Angular models and services

**Files:**
- Modify: `ShiftWork.Angular/src/app/core/models/location.model.ts`, `core/services/location.service.ts`, `core/services/company-users.service.ts`, `core/models/area.model.ts` (`locationId?: number | string`), `src/test.ts`
- Test: `core/services/location.service.default-shift.spec.ts`, `core/services/company-users.service.location-scopes.spec.ts`

**Interfaces:**
- Produces:
  - `export interface DefaultShift { start: string; end: string; areaId: number | null; }` and `Location.defaultShift?: DefaultShift | null` (`location.model.ts`).
  - `LocationService.setDefaultShift(companyId: string, locationId: number, shift: DefaultShift): Observable<DefaultShift>` → `PUT ${environment.apiUrl}/companies/${companyId}/locations/${locationId}/default-shift`.
  - `LocationService.clearDefaultShift(companyId: string, locationId: number): Observable<void>` → `DELETE` same URL.
  - `CompanyUsersService.getLocationScopes(companyId: string, uid: string): Observable<number[]>` → `GET …/companies/${companyId}/users/${uid}/location-scopes`, returning `response.locationIds`.
  - `CompanyUsersService.setLocationScopes(companyId: string, uid: string, locationIds: number[]): Observable<number[]>` → `PUT` same URL with `{ locationIds }`, returning the response ids.

- [ ] **Step 1: Write failing specs** with `HttpTestingController`: each method hits the exact URL and verb with the exact body (`{ start: '07:00', end: '15:30', areaId: 12 }`, `{ locationIds: [1, 3] }`), maps the response as above, and propagates an HTTP 400 error to the subscriber.
- [ ] **Step 2: Register both specs in `src/test.ts`; run** them (command in Global Constraints) — Expected: FAIL (methods missing).
- [ ] **Step 3: Implement** the models and methods, reusing each service's existing `handleError`/error pattern.
- [ ] **Step 4: Run** the specs — Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): location default-shift and user location-scope services`

---

### Task 4: Default-shift section on the location form

**Files:**
- Modify: `features/dashboard/locations/locations.component.{ts,html}` (and its module if a Material module is missing), `translations-source/strings.json` (+ generated files), `src/test.ts`
- Test: `features/dashboard/locations/locations.component.default-shift.spec.ts`

**Interfaces:**
- Consumes: `LocationService.setDefaultShift/clearDefaultShift` (Task 3), `AreaService.getAreas(companyId)`, `Location.defaultShift`.
- Produces: in the location edit form (existing locations only): a separate "Default shift" section with its own form group `defaultShiftForm = { start: string, end: string, areaId: number | null }` (time inputs in `HH:mm`), "Save default shift" and "Clear" buttons, an area select listing only areas with `Number(area.locationId) === selectedLocation.locationId`, and the component members `saveDefaultShift(): void`, `clearDefaultShift(): void`, `defaultShiftSaving: boolean`, `defaultShiftError: string | null`. Strings (`en`/`es`): `locations.default_shift.title`, `.help`, `.start`, `.end`, `.area`, `.area_none`, `.save`, `.clear`, `.saved`, `.cleared`, `.error_equal`, `.error_required`.

- [ ] **Step 1: Write failing component specs**:
  - selecting a location with `defaultShift { start:'07:00', end:'15:30', areaId: 12 }` fills the form; one without leaves it empty;
  - `saveDefaultShift()` calls `setDefaultShift(companyId, locationId, { start: '07:00', end: '15:30', areaId: 12 })` once and shows the saved toast; a second call while `defaultShiftSaving` is true does nothing;
  - overnight `22:00`–`06:00` is allowed; `07:00`–`07:00` marks the form invalid (`error_equal`) and does not call the service; a start without an end is invalid (`error_required`);
  - the area options contain only the areas of the selected location (areas with `locationId` `'7'` and `7` both match location 7, location 8's area is excluded); switching the selected location resets `areaId` to `null` when it does not belong to the new location;
  - `clearDefaultShift()` calls the service and empties the form;
  - a service error (`{ error: { message: 'Area does not belong to this location.' } }`) sets `defaultShiftError` to that message and keeps the values;
  - the main location save (`updateLocation`) is not called by these buttons, and the section is absent when creating a new location.
- [ ] **Step 2: Register the spec; run it** — Expected: FAIL.
- [ ] **Step 3: Implement** the section in the existing component and template (follow the file's current form and `toastr` style); add the strings and run `cd translations-source && npm run validate && npm run generate:all`, then check `git diff --stat` shows the generated files only gain lines.
- [ ] **Step 4: Run** the spec — Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): default shift editor on locations`

---

### Task 5: Scope dialog on the company-users page

**Files:**
- Create: `features/admin/components/user-location-scope-dialog/user-location-scope-dialog.component.{ts,html,css,spec.ts}`
- Modify: `features/admin/admin.module.ts` (declare the dialog; import `MatDialogModule`, `MatCheckboxModule`, `MatListModule`; make `HasPermissionDirective` available if not already), `features/admin/components/company-users-admin/company-users-admin.component.{ts,html}`, `translations-source/strings.json` (+ generated), `src/test.ts`
- Test: the dialog spec above and `company-users-admin.component.location-scope.spec.ts`

**Interfaces:**
- Consumes: `CompanyUsersService.getLocationScopes/setLocationScopes` (Task 3), `LocationService.getLocations(companyId)`, `CompanyUser.uid`, `*appHasPermission="'company-users.roles.update'"`.
- Produces:
  - `UserLocationScopeDialogComponent` opened with `MAT_DIALOG_DATA = { companyId: string; user: CompanyUser }`; closes with the saved `number[]` or `undefined` on cancel. Members: `locations: Location[]`, `selected: Set<number>`, `loading`, `saving`, `error: string | null`, `toggle(id: number)`, `save()`, `selectAll()`, `clear()`.
  - A "Locations" icon button on each user row of `company-users-admin`, shown only with `company-users.roles.update`, opening the dialog.
  - Strings (`en`/`es`): `company_users_admin.scope.button`, `.title`, `.help`, `.help_all_locations`, `.select_all`, `.clear`, `.none_warning`, `.inactive`, `.save`, `.saved`, `.error_load`.

- [ ] **Step 1: Write failing dialog specs**: on init it loads the company's locations and the user's current scope and pre-checks them; the list shows inactive locations marked and sorted after active ones, and a scoped inactive location stays checked; `toggle` adds/removes; `save()` calls `setLocationScopes(companyId, user.uid, [ids sorted])` once, disables the button while saving (second call ignored), and closes with the returned ids; a 400 error shows its message in `error` and keeps the dialog open; saving with nothing selected is allowed and the `none_warning` text is visible; load failure shows `error_load`; `selectAll` and `clear` work.
- [ ] **Step 2: Write failing page spec**: the button renders per user row when the permission service reports `company-users.roles.update`, is absent without it, and clicking it calls `MatDialog.open(UserLocationScopeDialogComponent, { data: { companyId, user } })`.
- [ ] **Step 3: Register both specs; run them** — Expected: FAIL.
- [ ] **Step 4: Implement** the dialog and wiring, following the layout of the existing users admin page; add the strings and run `npm run validate && npm run generate:all`; verify generated files only gain lines.
- [ ] **Step 5: Run** both specs — Expected: PASS.
- [ ] **Step 6: Commit** `feat(web): user location scope dialog`

---

### Task 6: Lineup permissions in the role editor

**Files:**
- Modify: `features/dashboard/profiles/profiles.component.ts` (`availablePermissions` at ~line 36; `getPermissionLabel` at ~line 302), `translations-source/strings.json` (+ generated) if the group heading is translated like the others, `src/test.ts`
- Test: `features/dashboard/profiles/profiles.component.lineup.spec.ts`

**Interfaces:**
- Produces: `availablePermissions['Lineup'] = ['lineup.view', 'lineup.edit', 'lineup.all-locations']`, and `getPermissionLabel('lineup.view') === 'View'`, `getPermissionLabel('lineup.edit') === 'Edit'`, `getPermissionLabel('lineup.all-locations') === 'All locations'`.

- [ ] **Step 1: Write failing spec**: the `Lineup` group exists with exactly those keys; the role form builds a `FormControl` for each; loading a role whose `permissions` include `lineup.edit` checks that control; saving sends the checked lineup keys in `permissions`; the three labels above.
- [ ] **Step 2: Register the spec; run it** — Expected: FAIL.
- [ ] **Step 3: Implement**: add the group (keep the existing groups' ordering/format) and make the label function turn dashes into spaces with a leading capital without changing the other keys' labels (the existing label tests, if any, must still pass).
- [ ] **Step 4: Run** the new spec plus the existing `profiles` specs — Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): lineup permissions in the role editor`

---

## Self-Review

- **Spec coverage:** §4 "Angular admin screen to assign job-site scope" (Tasks 2, 3, 5); §9 "no default shift: users with `lineup.all-locations` are prompted to set one" needs a place to set it (Tasks 1, 3, 4); §11 step 2 "Angular admin: assign job-site scope; set a location's default shift (required before foremen use Lineup)" is the whole plan; Task 6 closes the gap that no role except Admin could hold `lineup.*` keys.
- **Gaps accepted:** scope changes are not audit-logged (role changes are); a user's effective `lineup.all-locations` is not shown in the scope dialog (the Angular client can only see its own claims), so the dialog only carries a help line; the mobile "prompt to set a default shift" is not built.
- **Type consistency:** `DefaultShift { start, end, areaId }` (web) mirrors `DefaultShiftDto(Start, End, AreaId)` (API, camelCase JSON); `UserLocationScopeDto(LocationIds)` ↔ `{ locationIds }`; service names `setDefaultShift/clearDefaultShift/getLocationScopes/setLocationScopes` are used identically in Tasks 3–5.
