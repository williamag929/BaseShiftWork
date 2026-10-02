# Mobile Lineup — Design Spec

Date: 2026-09-29
Status: Draft for review (design sections 1–4 approved in conversation)
Repo: williamag929/BaseShiftWork (Angular web, React Native mobile, .NET 8 API)

## 1. Intent

Many people who run crews work from their phones all day, but scheduling only exists in the Angular web app. This feature adds a fast, tap-based **Lineup** screen to the mobile app: pick a date, see the job sites, see who is free that day, and put people onto sites in a few taps. The idea is a "pick your squad" interaction, not a full schedule editor.

Success: a foreman can build tomorrow's lineup on one hand, in under a minute, without a conflict they didn't know about.

What the user said:
- Access depends on permissions. Foremen do not always have full control of the schedule. Supervisors, project managers, and office staff do.
- The "field" is **Locations (job sites)** for the selected date. Crews are quick-fill.
- Available means: no other shift for the selected date.

Assumptions (not stated by the user; confirm at review):
- The Angular schedule remains the full-featured admin view; Lineup is a companion.
- "Project" in the user's vocabulary maps to a Location.

## 2. Scope

In scope (v1):
- Lineup screen in `ShiftWork.Mobile`, gated by permissions.
- New API: `GET lineup`, `POST lineup/commit`.
- Three new permissions and a location-scope table.
- One shared availability service.
- Angular admin screen to assign job-site scope to users.
- Gating the currently unprotected `replacement-candidates` endpoints.

Out of scope (v1):
- Drag-and-drop, copy-yesterday's-lineup, persisting drafts across app restarts.
- Shared or approval-based drafts (a server-side draft entity). This can layer on later without changing this design.
- Changes to the full Angular schedule.
- Fixing the `useScheduleGrid` placeholder people (unrelated to Lineup).

## 3. Current state that shapes the design

- **Crews are standing teams.** `Crew` and `PersonCrew` have no location and no per-day membership. A daily assignment is a `Schedule` row (person, location, area, times); the lineup does not write `ScheduleShift` (Amendment H).
- **Permissions** are evaluated by `PermissionAuthorizationHandler` through CompanyUser → UserRole → Role → RolePermission → Permission, and are company-wide only. There is no per-location scoping and no person/user-to-location link anywhere (only Area → Location).
- **The mobile app cannot see permissions yet.** `UserClaimsDto` already exposes `Permissions`, but `authStore` does not store them.
- **Shift creation** (`POST schedule-shifts`) creates one shift per call, requires `ScheduleId`, `AreaId`, and times, runs `ScheduleValidationService`, and rejects the request on any error **or warning**. If `CompanySettings.AutoApproveShifts` is on, it sets status "Published" and sends a push notification; otherwise the shift is "unpublished".
- **Three existing "who is available" implementations disagree:**
  - Crew availability: non-void `Schedules` overlap plus approved `TimeOffRequests`, for crew members only.
  - Replacement candidates: `ScheduleShifts` overlap (any status) plus `ShiftEvents` of type sick/timeoff on that date. It ignores `TimeOffRequests`, does not filter inactive people, and does not use its `locationId` and `areaId` parameters. It also has no permission policy.
  - Validation: shift overlap checks `ScheduleShifts`; schedule overlap checks `Schedules`.
- Time zones exist at three levels: `Company.TimeZone`, `CompanySettings.DefaultTimeZone`, and `Location.TimeZone`. Shifts are stored as `DateTime`.

## 4. Permissions and scope

New permission keys, seeded in `PermissionSeedService` (`resource.action` naming):

| Key | Allows |
|---|---|
| `lineup.view` | Open the Lineup screen; see shifts, crews, bench, unavailable people |
| `lineup.edit` | Build and commit lineups (create and remove shifts) |
| `lineup.all-locations` | Bypass location scoping; see every job site |

Typical roles: foreman = `lineup.view` + `lineup.edit` scoped to assigned sites. Supervisor, project manager, office staff = all three. Employees = none (no tab).

**Location scope.** New table `UserLocationScope (CompanyUserId, LocationId, CompanyId)`. A user without `lineup.all-locations` sees and edits only their scoped locations. A user with `lineup.view` and no scoped locations sees an empty state explaining who to ask.

**Enforcement is server-side.** `GET lineup` filters to scope. `POST lineup/commit` checks scope per assignment; an out-of-scope assignment is rejected individually and the rest proceed. `lineup.edit` alone authorizes creating and removing shifts through the lineup endpoint; the user does not need `schedule-shifts.create` or `schedule-shifts.delete` (foremen may not hold them). The mobile app stores `Permissions` from claims to show or hide the tab and the edit controls; this is cosmetic only.

**Fix alongside:** add a permission policy to `GET schedule-shifts/replacement-candidates` (both routes), requiring `schedule-shifts.read`.

**Admin.** The Angular app gets a screen to assign job-site scope to a user (on the existing user/role management UI).

## 5. Availability

A single `IAvailabilityService` is the source of truth. A person is **available for a date** when they:
1. have `Person.Status == "Active"`;
2. have no `ScheduleShift` or `Schedule` row overlapping the day, excluding status "void" (Amendment H);
3. (see Amendment H; Amendment A is superseded);
4. have no approved `TimeOffRequest` overlapping the day;
5. have no `ShiftEvent` of type sick or timeoff on that date.

Unavailable people are returned with a human-readable reason, so nobody looks missing. People who already have a shift at an in-scope location appear on that location's card, not in `unavailable`. People whose conflict is at an in-scope location can show its name ("Shift at 145 Main St, 7:00–15:30"); if the conflict is at a location outside the caller's scope, the reason is generic ("Assigned to another site") so location names never leak across scope. Time off shows as "Time off".

The lineup endpoints use this service. The replacement-candidates endpoints and crew availability are switched to it in the same phase, so the three can no longer disagree. (Note: this changes replacement-candidates behavior by excluding inactive people and honoring `TimeOffRequests`; call this out in release notes.)

**Day boundaries.** "Date" is a calendar date in the company's time zone (`Company.TimeZone`, falling back to `CompanySettings.DefaultTimeZone`). The window `[00:00, 24:00)` in that zone is used for all overlap queries; shift times are floating wall-clock values (Amendment F), compared directly. A location's default shift times are interpreted as wall-clock times when a schedule is created. If a shift's end time is earlier than or equal to its start time, it is treated as an overnight shift ending the next calendar day. An overnight shift counts against availability on both calendar days it touches.

## 6. API

Both routes live under `api/companies/{companyId}/lineup`.

### 6.1 `GET lineup?date=YYYY-MM-DD`

Policy: `lineup.view`. Returns only data within the caller's scope.

```json
{
  "date": "2026-10-01",
  "timeZone": "America/New_York",
  "canEdit": true,
  "locations": [
    {
      "locationId": 7,
      "name": "145 Main St",
      "defaultShift": { "start": "07:00", "end": "15:30", "areaId": 12 },
      "shifts": [
        { "shiftId": 501, "personId": 33, "name": "Ana R", "start": "2026-10-01T11:00:00Z", "end": "2026-10-01T19:30:00Z", "status": "Published" }
      ]
    }
  ],
  "bench": [ { "personId": 41, "name": "Luis M", "crewIds": [2] } ],
  "unavailable": [ { "personId": 44, "name": "Diego S", "reason": "Shift at 145 Main St, 7:00–15:30" } ],
  "crews": [ { "crewId": 2, "name": "Alpha", "memberIds": [41, 44, 52] } ]
}
```

`defaultShift` is null for a location that has none configured. `canEdit` reflects `lineup.edit`.

### 6.2 `POST lineup/commit`

Policy: `lineup.edit`.

Request:
```json
{
  "date": "2026-10-01",
  "assignments": [
    { "personId": 41, "locationId": 7, "areaId": 12, "start": "07:00", "end": "15:30", "acceptWarnings": false }
  ],
  "removals": [ 501 ]
}
```

Response: one result per assignment and per removal.
```json
{
  "results": [
    { "personId": 41, "locationId": 7, "status": "created", "shiftId": 610, "errors": [], "warnings": [] },
    { "personId": 52, "locationId": 7, "status": "needs-confirmation", "warnings": ["Exceeds weekly hours limit"] },
    { "personId": 44, "locationId": 7, "status": "rejected", "errors": ["Overlaps an existing shift"] },
    { "shiftId": 501, "status": "removed" }
  ]
}
```

Result statuses: `created`, `unchanged` (idempotent repeat), `needs-confirmation`, `rejected`, `removed`.

## 7. Commit semantics

- **Partial success.** Each assignment and removal is processed independently; one failure never blocks the others. There is no all-or-nothing transaction.
- **Validation.** Each assignment runs `ScheduleValidationService.ValidateSchedule`. **Errors** (for example overlapping shift) are final: status `rejected`. **Warnings** (for example overtime) return `needs-confirmation`; the client may resend that assignment with `acceptWarnings: true`, which creates it despite warnings. Errors can never be overridden. This differs from `POST schedule-shifts`, which blocks on warnings.
- **Times.** An assignment without `start`/`end`/`areaId` uses the location's default shift. If the location has no default shift and none is supplied, the assignment is `rejected` with the error "No shift time set for this location".
- **Unit of work.** Each assignment creates one `Schedule` row for that person, location, area and times (name "Lineup YYYY-MM-DD", type "Shift", status per below). No `ScheduleShift` is written (Amendment H). `shiftId` in the commit request and response is a `Schedule` id.
- **Status and publishing.** Follows `CompanySettings.AutoApproveShifts`: on → "Published" and a push to the assigned person via `NotifyShiftAssignedAsync` (Amendment H); off → "unpublished".
- **Idempotency.** An assignment for a person who already has a non-void shift at that location with the same start and end returns `unchanged`. A double-tap cannot create duplicates.
- **Removals.** Only shifts within scope, belonging to the company, and starting in the future (start after now in UTC). Removing sets no special status: it deletes the `Schedule` row. Void schedules are never removed ("Shift not found.", so the audit trail stays). Past or in-progress shifts return `rejected`.
- **Default shift storage.** Stored in the existing `Location.Settings` JSON under the key `defaultShift` (`start`, `end`, `areaId`). Writers must merge into the JSON, never overwrite unrelated keys. Setting it requires `lineup.all-locations` and is exposed through the Angular admin; the mobile app never writes it.
- **Tenant isolation.** Every query filters by `companyId`; scope checks use the caller's `CompanyUser` for that company.

## 8. Mobile

A new Lineup screen (Expo Router, alongside the existing tabs), visible only when claims include `lineup.view`. Users with `lineup.view` but not `lineup.edit` get the same screen read-only.

Layout, top to bottom:
1. **Date strip.** Swipe between days; changing the date reloads the screen.
2. **Location cards** (the field). One per in-scope job site, showing its people and a count. Tapping a card makes it the active target (highlighted).
3. **Bench.** Available people. Tap a name to move them onto the active location; tap a name on a card to send them back.
4. **Unavailable people.** Greyed out below the bench with the reason from the API.
5. **Crew quick-fill.** An "Add crew" button on each location card opens a crew list. Choosing one adds its available members and reports the rest ("3 of 5 added, 2 busy").
6. **Commit bar.** "Publish N shifts" appears when the draft has changes.

State and data flow:
- Server data: TanStack React Query for `GET lineup`, refetched on screen focus.
- Draft: a small Zustand store holding `assignments` and `removals` for the selected date. It is in-memory only.
- On commit, send the draft to `POST lineup/commit`. A results sheet lists created, rejected (with reasons), and `needs-confirmation` (with a confirm button that resends with `acceptWarnings: true`). Rejected and unconfirmed items remain in the draft; created and removed items clear.
- Services: a new `lineup.service.ts` (Axios client, one file per resource, per project convention).
- Strings: all user-visible text through the existing i18n pipeline, English and Spanish.
- Permissions: `Permissions` from `UserClaimsDto` stored in `authStore` on login and refreshed with `PermissionsVersion`.

## 9. Error handling

- **403 / out of scope:** the app hides the tab or location up front; if scope changes mid-session, the next refresh drops that location.
- **Stale data:** commit re-validates; anyone who became unavailable returns `rejected` with the reason.
- **No default shift:** the location is shown but cannot receive assignments. Users with `lineup.all-locations` are prompted to set one; foremen see "Ask your supervisor to set a shift time."
- **Offline:** show a banner; keep the draft; disable commit.
- **Time zones:** covered in section 5; tested around midnight and daylight saving changes.

## 10. Testing

API (`ShiftWork.Api.Tests`):
- Availability: shift overlap, non-void `Schedule` overlap, approved time-off, sick/timeoff events, inactive person, void shifts excluded, cross-midnight and DST days, company-time-zone day boundaries.
- Scope: foreman sees only scoped locations; `lineup.all-locations` sees all; out-of-scope commit rejected per assignment.
- Commit: partial success, idempotent repeat returns `unchanged`, warning → `needs-confirmation` → `acceptWarnings` creates, error never overridable, publish versus unpublished per `AutoApproveShifts`, removal of past shift rejected.
- Tenant isolation by `companyId`.
- `replacement-candidates` now requires a permission; behavior parity after moving to the shared service.

Mobile (Jest):
- Draft store: add, remove, crew quick-fill skips busy people, results handling keeps rejected items.
- Permission gating: tab hidden without `lineup.view`; edit controls hidden without `lineup.edit`.

## 11. Build order

Each step is shippable on its own.
1. **API foundation:** three permissions, `UserLocationScope` table and migration, `IAvailabilityService`, `GET lineup`, permission policy on `replacement-candidates` (and switch it and crew availability to the shared service).
2. **Angular admin:** assign job-site scope; set a location's default shift. (Required before foremen use Lineup.)
3. **Mobile read-only Lineup:** permissions in `authStore`, screen, bench, unavailable, crews. Supervisors and office staff can already see who is free.
4. **Commit and edit:** `POST lineup/commit`, tap-to-assign, crew quick-fill, results sheet.

## 12. Decisions to confirm at review

1. **Warnings override.** Foremen can accept warnings (such as overtime) per person; errors are never overridable. (Alternative: a separate `lineup.override-warnings` permission.)
2. **`lineup.edit` alone can create and remove shifts** through the lineup endpoint, without `schedule-shifts.create` or `.delete`.
3. ~~Schedule resolution rule~~ Superseded by Amendment H: the lineup creates and removes `Schedule` rows directly.
4. **Availability consolidation** changes `replacement-candidates` behavior (excludes inactive people, honors `TimeOffRequests`).
5. **Removals** delete the `Schedule` row (never a void one) (as today) rather than voiding it.


## Amendments (2026-09-29, after approval; found while writing the API plan)

- **A. (Superseded by H.) Availability ignores `Schedule` rows.** §5 rule 3 is removed. A `Schedule` is a container that commit reuses or creates (§7); counting it as a busy signal contradicted that. A person is busy only through a non-void `ScheduleShift`, an approved `TimeOffRequest`, or a sick/timeoff `ShiftEvent`.
- **B. Only `Person.Status == "Active"` people appear** on the bench. Inactive people appear nowhere.
- **C. Errors are final.** `acceptWarnings` overrides validation warnings only; errors (overlap, rest time, daily hours) never.
- **D. Crew availability endpoint is not moved in the API plan.** It is off the lineup path; the switch to the shared service is a small follow-up. Until then it can disagree with lineup.
- **E. Unavailable list names no sites.** Since people with a shift at a visible site sit on that card, `unavailable` only contains people busy elsewhere or on time off, with the generic reasons "Assigned to another site" and "Time off".
- **F. Shift times are floating "UTC wall-clock".** Found during implementation: the Angular grid, kiosk and mobile all store a typed 08:00 as `…T08:00:00Z` and read the UTC hours back as the wall time; the backend does no zone conversion. The lineup therefore follows that convention instead of true UTC: §5 "Day boundaries" and §6/§7 example times change. A default shift 07:00–15:30 on 2026-10-01 is stored and returned as `2026-10-01T07:00:00Z`–`15:30:00Z` (not 11:00Z–19:30Z). The shift-overlap window for a date is `[date 00:00Z, date+1 00:00Z)`. Real instants are used only where the data is a real instant: `ShiftEvent.EventDate` (window = the company-time-zone day) and the "removal only for future shifts" check (the stored wall time is read as local time in the location's zone). Approved time off matches by calendar date. If the product later migrates to true UTC, only the `LineupTime.Wall*` helpers need to change back.
- **G. Validator limits in tests.** `ScheduleValidationService` computes daily/weekly hours with `EF.Functions.DateDiffMinute`, which the EF InMemory provider cannot run, so commit tests null out those two limits and exercise the warning path through the consecutive-days rule. The daily/weekly limits are not covered by unit tests (SQL Server behaviour is unchanged).
- **H. `Schedule` rows are the lineup's unit of work (supersedes A).** Commit creates and removes `Schedule` rows, not `ScheduleShift` rows, because that is what the Angular grid and the web app actually read and write. Consequences:
  - Availability counts non-void `Schedule` rows **and** `ScheduleShift` rows (legacy writers) as busy, plus approved `TimeOffRequest`s and sick/timeoff `ShiftEvent`s.
  - Partial-day time off is overlap-based: a request blocks a shift only when it overlaps the shift window, not the whole calendar day.
  - The `ShiftEvent` window is widened to the whole company-time-zone day, so an event anywhere in that day is seen.
  - Commit re-checks time off (final, never overridable by `acceptWarnings`) in addition to availability at read time.
  - An explicit `start == end` is invalid ("Invalid shift time."); only a default or an end earlier than start is overnight.
  - Push uses `NotifyShiftAssignedAsync`, because `NotifySchedulePublishedAsync` finds recipients through `ScheduleShift` rows and would notify nobody for a `Schedule`.
  - Lineup writes clear the grid's `schedules_{companyId}` (and, on delete, `schedule_{companyId}_{id}`) cache keys. A site time zone that is blank or unknown falls back to the company zone, not UTC.
- **I. Concurrent double-tap is not locked server-side.** Idempotency (same person, site and times, non-void, returns `unchanged`) covers sequential repeats only. Two simultaneous commits can both pass the check and create duplicates; there is no lock or unique index. The mobile app must disable the commit button while a request is in flight.
- **J. Lineup admin write paths (2026-10-02).** A location's default shift is written through `PUT/DELETE api/companies/{companyId}/locations/{id}/default-shift` and merged into `Settings` (other keys preserved); `PUT location` no longer touches `Settings` (it used to wipe it). A user's location scope is managed through `GET/PUT api/companies/{companyId}/users/{uid}/location-scopes` with body `{ "locationIds": [..] }`: read needs `company-users.read`, write needs `company-users.roles.update`. The write replaces the user's rows in one save, de-duplicates ids, rejects ids that are not locations of the company with 400 `{ "message": "Unknown locations: 3, 9" }` (inactive locations are allowed), and returns 404 for a user outside the company. No new permission keys.
