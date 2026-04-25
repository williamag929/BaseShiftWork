# Week 1 Prioritized Backlog

> Branch: `feature/professional-w1-baseline`
> Source: `W1_GAP_CHECKLIST.md` + `PROFESSIONAL_DAILY_USE_PLAN.md`
> Workstreams: WS1 (Parity), WS2 (Quality), WS3 (Security), WS4 (Observability)

---

## Priority Key

| Label | Meaning |
|---|---|
| P1 | Release blocker — must resolve before any production use |
| P2 | High-impact gap — resolve within Weeks 2–3 |
| P3 | Quality improvement — resolve before Week 6 stabilization |

---

## P1 — Release Blockers

### B-01 · Add frontend permission gating to all four Angular v2 components
- **WS:** WS3 (Security)
- **Gap ref:** G2
- **Scope:** `bulletins.component.ts/.html`, `daily-reports.component.ts/.html`, `documents.component.ts/.html`, `safety.component.ts/.html`
- **What:** Inject a `PermissionService` (or use existing `AuthService.hasPermission()`). Hide create/delete/approve/archive controls with `*ngIf` when user lacks the required permission key.
  - Bulletins: hide "New Bulletin" without `bulletins.create`; hide delete without `bulletins.delete`
  - Daily Reports: hide Approve button without `reports.approve`
  - Documents: hide "Upload" without `documents.upload`; hide Archive without `documents.archive`
  - Safety: hide "New Content" without `safety.create`; hide Archive without `safety.delete`
- **Acceptance:** Manager sees all controls; employee sees read-only view for each module.

### B-02 · Add frontend permission gating to Mobile v2 screens
- **WS:** WS3 (Security)
- **Gap ref:** G2
- **Scope:** `ShiftWork.Mobile/app/(tabs)/bulletins.tsx`, `daily-report.tsx`, `safety.tsx`
- **What:** Read the current user's role from the Zustand auth store. Conditionally render manager-only actions (approve, delete, create) based on role/permissions.
- **Acceptance:** Employee role cannot see Approve or Create buttons; API 403s are no longer the first line of defense in the UI.

### B-03 · Create API integration tests for v2 service/controller pairs
- **WS:** WS2 (Quality)
- **Gap ref:** G1
- **Scope:** `ShiftWork.Api.Tests/` — 4 new test class files
- **What:** Add `BulletinServiceTests.cs`, `DailyReportServiceTests.cs`, `DocumentServiceTests.cs`, `SafetyServiceTests.cs`. Cover: happy path CRUD, idempotent mark-read/ack, permission enforcement (forbidden on wrong company), and soft-delete/archive.
- **Acceptance:** `dotnet test` passes; new tests cover at minimum: create, get list, get by id, mark-read or ack, archive/delete per module.

### B-04 · Create Angular service specs for v2 services
- **WS:** WS2 (Quality)
- **Gap ref:** G1
- **Scope:** `ShiftWork.Angular/src/app/core/services/` — 4 new `.spec.ts` files
- **What:** Add `bulletin.service.spec.ts`, `daily-report.service.spec.ts`, `document.service.spec.ts`, `safety.service.spec.ts`. Use `HttpClientTestingModule`. Test: correct URL construction, error propagation, mark-read/ack calls.
- **Acceptance:** `ng test` passes for all new specs without `fdescribe`/`fit`.

---

## P2 — High-Impact Gaps

### B-05 · Add pagination to all four API list endpoints
- **WS:** WS1 (Parity)
- **Gap ref:** G3
- **Scope:** `BulletinsController`, `DailyReportsController`, `DocumentsController`, `SafetyController` + their services
- **What:** Add `page` (1-based) and `limit` (default 25, max 100) query params to each GET list endpoint. Return a `PagedResult<T>` envelope: `{ items, totalCount, page, limit }`. Wire through services.
- **Acceptance:** `GET /bulletins?page=2&limit=10` returns 10 items from offset 10; `totalCount` reflects full filtered set.

### B-06 · Add pagination controls to Angular v2 list components
- **WS:** WS1 (Parity)
- **Gap ref:** G3
- **Scope:** `bulletins.component`, `documents.component`, `safety.component` (daily-reports uses single-record view — no pagination needed)
- **What:** Add `mat-paginator` bound to `pageIndex`/`pageSize`. Reload data on page change.
- **Acceptance:** Navigating pages reloads data; total count shown correctly.

### B-07 · Add persistent error banner to all four Angular v2 components
- **WS:** WS1 (Parity)
- **Gap ref:** G4
- **Scope:** `bulletins.component.html/.ts`, `daily-reports.component.html/.ts`, `documents.component.html/.ts`, `safety.component.html/.ts`
- **What:** Add an `errorMessage: string | null` property and a consistent error-banner template block. Populate on load failure. Toastr can remain for transient actions (e.g., delete failure) but list-load failures need a visible retry state.
- **Acceptance:** If `loadBulletins()` rejects, an inline error banner with a Retry button appears instead of a blank screen.

### B-08 · Add error UI states to Mobile v2 screens
- **WS:** WS1 (Parity)
- **Gap ref:** G4
- **Scope:** `ShiftWork.Mobile/app/(tabs)/bulletins.tsx`, `daily-report.tsx`, `safety.tsx`, `app/documents/index.tsx`
- **What:** Add an `error: string | null` state to each screen. Render an error card with a "Try Again" button when load fails.
- **Acceptance:** Simulating network failure shows error card; tap "Try Again" re-fetches.

### B-09 · Add service-level structured logging to v2 API services
- **WS:** WS4 (Observability)
- **Gap ref:** G5
- **Scope:** `BulletinService.cs`, `DailyReportService.cs`, `DocumentService.cs`, `SafetyService.cs`
- **What:** Add `_logger.LogInformation()` at key milestones:
  - bulletin created / marked read
  - safety content assigned / acknowledged
  - report submitted / approved
  - document opened / downloaded / archived
  - Use structured log format: `"Bulletin {BulletinId} marked read by Person {PersonId} at Company {CompanyId}"`
- **Acceptance:** Key actions emit `Information`-level log entries with resource IDs.

### B-10 · Add Angular v2 component specs (smoke-level)
- **WS:** WS2 (Quality)
- **Gap ref:** G1
- **Scope:** `bulletins.component.spec.ts`, `daily-reports.component.spec.ts`, `documents.component.spec.ts`, `safety.component.spec.ts`
- **What:** Smoke-level specs: component creates, renders loading state, renders empty state, renders error state when service rejects. Mock services with `jasmine.createSpyObj`.
- **Acceptance:** `ng test` passes for all four new spec files.

---

## P3 — Quality Improvements

### B-11 · Add documents entry point to Mobile tab navigation
- **WS:** WS1 (Parity)
- **Gap ref:** G7
- **Scope:** `ShiftWork.Mobile/app/(tabs)/_layout.tsx`, create `app/(tabs)/documents.tsx`
- **What:** Add a "Docs" tab that shows the documents list screen (currently accessible only via deep link).
- **Acceptance:** Documents list visible from bottom tab bar without navigating from another screen.

### B-12 · Add WeatherService HTTP timeout policy
- **WS:** WS3 (Security/Reliability)
- **Gap ref:** G8
- **Scope:** `ShiftWork.Api/Services/WeatherService.cs` or `Program.cs` `AddHttpClient` registration
- **What:** Register the `WeatherService` HttpClient with a `Timeout` of 5 seconds via `AddHttpClient(...).SetHandlerLifetime(...).AddPolicyHandler(...)` (Polly) or `HttpClient.Timeout`.
- **Acceptance:** If OpenWeather is unreachable, the daily report creation completes within 6 seconds total with weather fields null.

### B-13 · Add Angular HTTP retry / offline detection
- **WS:** WS1 (Parity)
- **Gap ref:** G6
- **Scope:** `ShiftWork.Angular/src/app/core/interceptors/` (new or existing interceptor)
- **What:** Add a `RetryInterceptor` that retries GET requests once on network error (status 0). Distinguish `status === 0` (offline/network) from `status >= 400` (server error) in error messages shown to user.
- **Acceptance:** A transient network drop retries once automatically; a 404/500 does not retry.

### B-14 · Add Kiosk interstitial error fallback
- **WS:** WS1 (Parity)
- **Gap ref:** G4
- **Scope:** `ShiftWork.Kiosk/app/(kiosk)/interstitial.tsx`
- **What:** Wrap the `getPostClockout()` call in try/catch. On failure render a fallback screen ("No messages — you're all set") instead of a blank interstitial.
- **Acceptance:** Simulating a 500 from the interstitial endpoint shows the fallback and auto-advances after 5 seconds.

---

## Backlog Summary

| ID | Title | Priority | WS | Week target |
|---|---|---|---|---|
| B-01 | Angular permission gating | P1 | WS3 | Week 2 |
| B-02 | Mobile permission gating | P1 | WS3 | Week 2 |
| B-03 | API integration tests | P1 | WS2 | Week 3 |
| B-04 | Angular service specs | P1 | WS2 | Week 3 |
| B-05 | API pagination | P2 | WS1 | Week 2 |
| B-06 | Angular pagination controls | P2 | WS1 | Week 2 |
| B-07 | Angular error banners | P2 | WS1 | Week 2 |
| B-08 | Mobile error states | P2 | WS1 | Week 2 |
| B-09 | API structured logging | P2 | WS4 | Week 2 |
| B-10 | Angular component specs | P2 | WS2 | Week 3 |
| B-11 | Mobile documents tab | P3 | WS1 | Week 2 |
| B-12 | WeatherService timeout | P3 | WS3 | Week 3 |
| B-13 | Angular retry interceptor | P3 | WS1 | Week 3 |
| B-14 | Kiosk interstitial fallback | P3 | WS1 | Week 2 |

---

## Ownership Template

| Module | Owner |
|---|---|
| API | — |
| Angular | — |
| Mobile | — |
| Kiosk | — |
| QA | — |
| DevOps | — |
| Release Manager | — |
