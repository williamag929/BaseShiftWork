# UTC Date/Time Refactor Impact & Plan

> **Context:** The Angular schedule grid was refactored to use UTC-as-wall-clock convention — all schedule `startDate`/`endDate` values are now created via `Date.UTC(...)` so that the UTC hours **are** the intended shift hours (e.g. a 9 AM — 5 PM shift is stored as `2026-03-12T09:00:00.000Z`, not the local-offset equivalent). This document analyses how that change ripples into the mobile app and kiosk, and defines the phases to bring every client into full consistency.

---

## 1. The Convention Defined

| Layer | Convention | Example |
|-------|-----------|---------|
| Angular schedule grid (now) | UTC wall-clock | 9:00 AM shift → `T09:00:00.000Z` |
| API `ScheduleShift.StartDate` | Stored as received | Depends on caller |
| Mobile `formatScheduleTime` | Reads `getUTCHours()` | ✅ Already aligned |
| Kiosk today-matching | Mixed local/UTC | ⚠️ Partially broken |
| Mobile week-range queries | Local `setHours` | ⚠️ Timezone-offset risk |

---

## 2. Full Impact Analysis

### 2.1 Mobile — Schedule Display (`formatScheduleTime`)

**File:** `ShiftWork.Mobile/utils/date.utils.ts`

`formatScheduleTime` already reads `getUTCHours()` / `getUTCMinutes()`, so it correctly renders the wall-clock value from the UTC-convention dates.

**Status: ✅ No change needed — already aligned.**

---

### 2.2 Mobile — Week-Range API Queries (`useDashboardData.ts`)

**File:** `ShiftWork.Mobile/hooks/useDashboardData.ts`

```ts
const weekStart = getStartOfWeek(now);   // uses local setDate / getDay
const weekEnd = getEndOfWeek(now);       // uses local setHours(23,59,59,999)
const next7End = new Date(now);
next7End.setDate(now.getDate() + 7);    // local
```

`getStartOfWeek` / `getEndOfWeek` from `date.utils.ts` use **local** `setHours(0,0,0,0)` and `setDate`. The resulting ISO string passed to `formatDateForApi` (which calls `.toISOString()`) is correct UTC, **but the day selected is the local calendar day**.

**Impact:** On a device in UTC-6 (e.g., CDT), "Sunday midnight local" = `2026-03-08T06:00:00.000Z`. A schedule stored as `2026-03-08T09:00:00.000Z` (9 AM UTC = 9 AM wall-clock) would still be included since `T09 >= T06`. However if the device is UTC+6, "Sunday midnight local" = `2026-03-07T18:00:00.000Z`, which could pull in Saturday schedules.

**Status: ⚠️ Low-risk today (Eastern timezone); becomes a bug for users in UTC+ zones or when company spans timezones.**

---

### 2.3 Mobile — SQLite Offline Cache Date Queries (`db.ts`)

**File:** `ShiftWork.Mobile/services/db.ts`

```sql
datetime(startDate) >= datetime(?)
```

`fromISO` / `toISO` are already ISO strings. SQLite's `datetime()` without the `'utc'` modifier interprets the string by its suffix. Since the app always stores `.toISOString()` (which includes the `Z` suffix), SQLite will handle them as UTC already.

**Status: ✅ Works. Minor improvement: explicitly pass `'utc'` modifier for defense-in-depth (covered in MOBILE_BUG_FIX_PLAN.md #39).**

---

### 2.4 Mobile — Clock-In/Out Timestamps (`shift-event.service.ts`)

**File:** `ShiftWork.Mobile/services/shift-event.service.ts`

```ts
eventDate: new Date(),   // JS Date → serialized to UTC ISO string by JSON.stringify
```

Clock events use **actual real-world UTC timestamps** (not the UTC-as-wall-clock convention). This is correct — a user clocking in at 9:03 AM local should record `2026-03-12T14:03:00.000Z` if they are in UTC-5.

**Status: ✅ No change needed. Clock-in times are always real UTC instants.**

---

### 2.5 Mobile — Status Displayed After Clock (elapsed timer)

**File:** `ShiftWork.Mobile/hooks/useDashboardData.ts`

`activeClockInAt` is stored via `saveActiveClockInAt(new Date(result.eventDate).toISOString())` — a real UTC ISO string. Elapsed time calculated via `Date.now() - new Date(activeClockInAt).getTime()` — millisecond arithmetic, timezone-safe.

**Status: ✅ No change needed.**

---

### 2.6 Kiosk — Today's Event Filtering (`photo-schedule.component.ts`)

**File:** `ShiftWork.Angular/src/app/features/kiosk/photo-schedule/photo-schedule.component.ts`

```ts
// Line 169-177
const today = new Date();
today.setHours(0, 0, 0, 0);           // ← LOCAL midnight
const endOfDay = new Date(today);
endOfDay.setDate(endOfDay.getDate() + 1);  // ← LOCAL midnight + 1 day
const todays = (events || []).filter(ev => {
  const dt = new Date(ev.eventDate);
  return dt >= today && dt < endOfDay;
});
```

Clock-in events have **real UTC timestamps** (e.g., `2026-03-12T14:00:00.000Z`). Comparing them against local-midnight boundaries is correct for determining "today's events" **in the kiosk's local timezone** — which is exactly the right behavior for a kiosk (users interact with it in real local time).

**Status: ✅ This is intentionally correct. Local midnight IS the right boundary for daily event filtering on a kiosk.**

---

### 2.7 Kiosk — Today's Schedule Matching (`photo-schedule.component.ts`)

**File:** `ShiftWork.Angular/src/app/features/kiosk/photo-schedule/photo-schedule.component.ts`

```ts
// Lines 184-190
const today = new Date();
const todayUTCDate = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
this.employeeSchedule = this.selectedEmployee.scheduleDetails.find(s => {
  const scheduleDate = new Date(s.startDate);
  const schedUTCDate = scheduleDate.getUTCFullYear() * 10000 + (scheduleDate.getUTCMonth() + 1) * 100 + scheduleDate.getUTCDate();
  return s.personId === this.selectedEmployee?.personId && schedUTCDate === todayUTCDate;
}) || null;
```

**Bug:** `todayUTCDate` is derived from **local** `getFullYear() / getMonth() / getDate()` despite being named "UTC". `schedUTCDate` correctly uses `getUTCFullYear()` etc. because schedule dates use the UTC-as-wall-clock convention.

**Scenario:** Kiosk in UTC-5, date is March 12 11:00 PM local (= March 13 04:00 UTC).
- `todayUTCDate` = 20260312 (local March 12)
- A schedule for March 13 has `schedUTCDate` = 20260313
- The March 13 schedule is NOT shown at 11 PM on the previous day ✅ (that's actually correct behavior)

**Scenario:** Kiosk in UTC+6, date is March 12 01:00 AM local (= March 11 19:00 UTC).
- `todayUTCDate` = 20260312 (local March 12)
- A schedule stored as `2026-03-12T09:00:00.000Z` (March 12 schedule) has `schedUTCDate` = 20260312
- Match found ✅

**Scenario:** Kiosk in UTC+6, it is 11:00 PM local March 12 (= 17:00 UTC March 12).
- `todayUTCDate` = 20260312
- A March 12 schedule: `schedUTCDate` = 20260312 ✅

**Conclusion:** Because the UTC-wall-clock convention means UTC date = intended calendar date, and the kiosk compares local calendar date (`todayUTCDate` which isn't actually UTC) against the UTC calendar date from the schedule, this accidentally works correctly for most timezones. **The naming is misleading but the logic is sound.**

**Status: ⚠️ Works correctly but is unmaintainable and misleading. Should be renamed and documented.**

---

### 2.8 API — Schedule Shift Status Calculation (`ShiftEventService.cs`)

**File:** `ShiftWork.Api/Services/ShiftEventService.cs`

```csharp
var nowUtc = shiftEvent.EventDate;          // Real UTC timestamp from mobile/kiosk
var startOfDayUtc = nowUtc.Date;            // UTC day boundary
var scheduleShift = await _context.ScheduleShifts
    .Where(ss => ss.PersonId == shiftEvent.PersonId &&
                 ss.StartDate < endOfDayUtc &&
                 ss.EndDate > startOfDayUtc)
```

`shiftEvent.EventDate` is a real UTC instant. `ss.StartDate` uses the UTC-wall-clock convention. Comparing `ss.StartDate < endOfDayUtc` where both are UTC values works correctly — finding any schedule that overlaps "today UTC."

The Late/Early/OnTime diff:
```csharp
var diffMinutes = (nowUtc - startUtc).TotalMinutes;
```
`nowUtc` is a real clock time in UTC. `startUtc` is the UTC-wall-clock schedule start. If the user is in UTC-5 and their shift starts at "9:00 AM local," the schedule is stored as `T09:00Z`. The user clocks in at 9:03 AM local = `T14:03Z`. The diff would be **+303 minutes** — reporting them as very late.

**THIS IS THE CRITICAL BUG introduced by the UTC change.**

**Status: 🔴 CRITICAL — Late/Early/OnTime calculation is broken for users not in UTC timezone.**

---

### 2.9 API — Schedule Search Range (`ScheduleShiftService.cs`)

```csharp
query = query.Where(s => s.StartDate >= startDate.Value);
```

`startDate` arrives from the mobile as a local-timezone ISO string (from `getStartOfWeek` using local methods). The API's EF Core will compare it against UTC-stored `StartDate` values naively. On SQL Server, both values are `datetime2` columns — the comparison is numeric on the stored value without timezone context, so the result is correct **as long as both the client-sent boundary and the schedule's stored value are consistent UTC values**.

Since `.toISOString()` in JS always emits UTC strings regardless of local timezone, and EF Core parses ISO strings to UTC DateTime, this is safe.

**Status: ✅ Range queries are correct.**

---

## 3. Summary of Issues Found

| # | Severity | Component | Issue |
|---|----------|-----------|-------|
| UTC-1 | 🔴 Critical | API `ShiftEventService.cs` | Late/Early/OnTime diff compares real UTC clock-in against UTC-wall-clock schedule time — always shows wrong timing for non-UTC timezones |
| UTC-2 | 🟡 Medium | Mobile `date.utils.ts` | `getStartOfWeek` / `getEndOfWeek` use local day boundaries — off-by-one risk for UTC+ users |
| UTC-3 | 🟡 Medium | Mobile `date.utils.ts` | `getStartOfDay` / `getEndOfDay` use local `setHours` — used for SQLite range queries, may miss events near midnight |
| UTC-4 | 🟢 Low | Kiosk `photo-schedule.component.ts` | Variable `todayUTCDate` is misleadingly named — uses local methods not UTC |
| UTC-5 | 🟢 Low | Mobile `db.ts` | SQLite `datetime()` without `'utc'` modifier — works with `Z` suffix strings but fragile |
| UTC-6 | 🟢 Low | Mobile `hooks/useDashboardData.ts` | `next7End.setDate(...)` uses local method — should be UTC to match schedule storage |

---

## 4. Refactor Phases

---

### Phase 1 — Fix Critical Timing Calculation (API)

**Goal:** Correct the Late/Early/OnTime status calculation so it works regardless of the user's timezone.

**Root cause:** After the UTC-wall-clock change, schedule `startDate` values encode "the intended local shift start hour" in the UTC field (e.g., `T09:00Z` = "this shift starts at 9 AM"). Clock-in events encode the **actual real UTC moment** (e.g., `T14:03Z` = user clocked in at 9:03 AM in UTC-5). Comparing these directly gives a wrong diff.

**Fix required:** The API needs a `timezone` field on the `ScheduleShift` or `Company` model to know the offset, OR adopt a different convention where schedule times are stored as real UTC instants. The cleanest fix for the current codebase (minimum refactor) is to add a `timezone` field to `Company` and convert the UTC-wall-clock schedule start to a real UTC instant for comparison:

```csharp
// In ShiftEventService.cs
// Convert schedule wall-clock to a real UTC instant for accurate diff
var companyTimezone = await _settingsService.GetCompanyTimezone(shiftEvent.CompanyId);
var tz = TimeZoneInfo.FindSystemTimeZoneById(companyTimezone ?? "UTC");
var schedStartAsUtcInstant = TimeZoneInfo.ConvertTimeToUtc(
    DateTime.SpecifyKind(scheduleShift.StartDate, DateTimeKind.Unspecified),
    tz
);
var diffMinutes = (nowUtc - schedStartAsUtcInstant).TotalMinutes;
```

**Files to change:**
- `ShiftWork.Api/Services/ShiftEventService.cs` — fix diff calculation
- `ShiftWork.Api/Models/Company.cs` — add `Timezone` field (nullable string)
- `ShiftWork.Api/DTOs/CompanyDto.cs` — expose `Timezone` in DTO
- `ShiftWork.Api/Migrations/` — new EF Core migration to add `Timezone` column
- `ShiftWork.Api/Services/CompanySettingsService.cs` — add `GetCompanyTimezone()` method

**Acceptance criteria:**
- A user in UTC-5 clocking in at exactly 9:00 AM local shows `OnTime`
- A user in UTC+9 clocking in at exactly 9:00 AM local shows `OnTime`
- Timing status is unaffected for UTC timezone users

---

### Phase 2 — Fix Mobile Date Range Utilities

**Goal:** Make `getStartOfWeek`, `getEndOfWeek`, `getStartOfDay`, `getEndOfDay` in `date.utils.ts` produce UTC-boundary ISO strings that align with the UTC-wall-clock schedule convention.

**Problem:** Using local `setHours(0,0,0,0)` on a device in UTC+6 produces week START as `2026-03-06T18:00:00.000Z` (UTC Saturday 6 PM), not `2026-03-07T00:00:00.000Z` (UTC Sunday midnight). Schedules stored with UTC date keys would be missed.

**Fix:**

```ts
// date.utils.ts — new UTC-boundary variants
export const getStartOfWeekUTC = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
};

export const getEndOfWeekUTC = (date: Date): Date => {
  const start = getStartOfWeekUTC(date);
  return new Date(Date.UTC(
    start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6,
    23, 59, 59, 999
  ));
};

export const getStartOfDayUTC = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export const getEndOfDayUTC = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
```

**Update callers:**
- `hooks/useDashboardData.ts` — replace `getStartOfWeek` / `getEndOfWeek` with UTC variants; replace `next7End.setDate(...)` with UTC method
- `services/db.ts` (getUpcomingShifts — caller already passes ISO strings; no change needed there)
- `app/(tabs)/dashboard.tsx` — any date range construction for schedule cards

**Files to change:**
- `ShiftWork.Mobile/utils/date.utils.ts`
- `ShiftWork.Mobile/hooks/useDashboardData.ts`

**Acceptance criteria:**
- Device in UTC+6 at Mon Jan 1 01:00 sees the same week of schedules as a device in UTC-6
- Week shown on dashboard is the UTC calendar week, not the local-shifted one

---

### Phase 3 — Fix Kiosk Misleading Variable Names & Add Guard

**Goal:** Remove the misleading UTC naming and document the convention; add a comment explaining why local date is correct for the kiosk use case.

**Files to change:**
- `ShiftWork.Angular/src/app/features/kiosk/photo-schedule/photo-schedule.component.ts`

```ts
// Before
const todayUTCDate = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
// ...
const schedUTCDate = scheduleDate.getUTCFullYear() * ...

// After
// Kiosk uses local calendar day intentionally — employees interact in local time.
// Schedules use UTC-wall-clock convention so UTC date == intended calendar date.
const todayLocalDate = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
// UTC date of schedule == stored calendar date (UTC-wall-clock convention).
const schedCalendarDate = scheduleDate.getUTCFullYear() * 10000 + (scheduleDate.getUTCMonth() + 1) * 100 + scheduleDate.getUTCDate();
return s.personId === this.selectedEmployee?.personId && schedCalendarDate === todayLocalDate;
```

**Acceptance criteria:**
- No behavior change
- Variable names clearly communicate intent

---

### Phase 4 — Harden SQLite Datetime Queries

**Goal:** Explicitly pass `'utc'` modifier to all `datetime()` calls in `db.ts` to prevent ambiguity on hypothetical non-UTC SQLite builds.

**File:** `ShiftWork.Mobile/services/db.ts`

```sql
-- Before
datetime(eventDate) DESC
datetime(startDate) ASC
datetime(startDate) >= datetime(?)
-- After
datetime(eventDate, 'utc') DESC
datetime(startDate, 'utc') ASC
datetime(startDate, 'utc') >= datetime(?, 'utc')
```

**Note:** This is a defensive improvement. The `Z` suffix in stored ISO strings already signals UTC to SQLite, so no data changes.

**Acceptance criteria:**
- Offline queries return same results as before
- No regression in `getRecentEvents`, `getUpcomingShifts`, `getEventsInRange`

---

### Phase 5 — Add `timezone` to Company Settings (API + Angular + Mobile)

**Goal:** Expose the company timezone so all three clients can convert UTC-wall-clock schedule times to real UTC instants for accurate display and computation.

**This phase is a prerequisite for Phase 1 to be production-safe.**

**API changes:**
- Add `Timezone` string field to `Company` model and DTO
- Migration: `ALTER TABLE Companies ADD COLUMN Timezone NVARCHAR(100) NULL`
- Default value: `'UTC'` for existing companies
- Expose in `GET /api/companies/{companyId}` and company settings endpoint

**Angular changes:**
- Add timezone selector in Company Settings admin screen
- Populate it with IANA timezone names
- Use it in schedule grid's `formatScheduleTime` formatter (optional — current UTC display is correct if convention is communicated)

**Mobile changes:**
- Read `timezone` from company settings (`services/company-settings.service.ts`)
- Pass it to `formatScheduleTime` in `date.utils.ts` so times can optionally be shown in company timezone

**Acceptance criteria:**
- Admin can set company timezone via Angular UI
- API Late/Early/OnTime uses the timezone for calculation (Phase 1 safety net)
- Mobile schedule times display correctly for non-UTC companies

---

## 5. Migration Notes for Existing Data

> If schedules were created **before** the UTC grid change, their `startDate` values may encode local time with a UTC offset (e.g., a 9 AM shift in UTC-5 stored as `T14:00:00.000Z`). Those schedules will display as **2:00 PM** on any client using `getUTCHours()`.

**Recommended data migration (run once, per company, one-time script):**

```sql
-- For companies in UTC-5:
-- Shift all ScheduleShift startDate/endDate back by 5 hours to normalize old local-stored times to UTC wall-clock
UPDATE ScheduleShifts
SET StartDate = DATEADD(HOUR, -(-5), StartDate),   -- subtract the UTC offset
    EndDate   = DATEADD(HOUR, -(-5), EndDate)
WHERE CompanyId = 'your-company-id'
  AND StartDate < '2026-03-01';  -- only rows created before the cutover date
```

**This migration MUST be run before Phase 5 is deployed.**

---

## 6. File Change Summary

| Phase | Files | Effort |
|-------|-------|--------|
| 1 — API timing fix | `ShiftEventService.cs`, `Company.cs`, `CompanyDto.cs`, new migration | Medium |
| 2 — Mobile UTC ranges | `date.utils.ts`, `useDashboardData.ts` | Small |
| 3 — Kiosk naming | `photo-schedule.component.ts` | Trivial |
| 4 — SQLite `utc` modifier | `db.ts` | Trivial |
| 5 — Timezone field | API model + migration + Angular settings + mobile settings service | Large |

---

## 7. Verification Checklist

- [ ] User in UTC-5 clocks in "on time" → status shows `OnTime`
- [ ] User in UTC+9 clocks in "on time" → status shows `OnTime`
- [ ] Mobile dashboard in UTC+6 device shows the correct week of schedules
- [ ] Kiosk `photo-schedule` shows today's schedule at 11:59 PM local time
- [ ] SQLite offline fallback returns same schedule window as live API
- [ ] Angular schedule grid creates/displays schedules at correct wall-clock hours
- [ ] Old schedules (pre-cutover) display at correct times after data migration
- [ ] `tsc --noEmit` clean on mobile after `date.utils.ts` changes
- [ ] `dotnet build` clean after API model changes
