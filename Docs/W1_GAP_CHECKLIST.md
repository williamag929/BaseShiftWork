# Week 1 Gap Checklist — v2 Content & Communication Subsystem

> Branch: `feature/professional-w1-baseline`
> Audit date: 2026-04-25
> Scope: API, Angular, Mobile, Kiosk

Legend: ✅ Done · ⚠️ Partial · ❌ Missing

---

## 1. Loading / Empty / Error States

### Angular

| Module | Loading | Empty | Error UI |
|---|---|---|---|
| Bulletins | ✅ mat-spinner present | ✅ empty-state div | ⚠️ Toastr only — no persistent error banner in template |
| Daily Reports | ✅ spinner present | ✅ no-location + no-report states | ⚠️ Toastr only |
| Documents | ✅ spinner present | ✅ grid conditional | ⚠️ Toastr only |
| Safety | ✅ spinner present | ✅ per-tab empty states | ⚠️ Toastr only |

**Gap:** All four Angular v2 components are missing a persistent in-template error banner. Failures surface via transient toast only — page reload leaves no visible error state.

### Mobile

| Screen | Loading | Empty | Error UI |
|---|---|---|---|
| Bulletins tab | ✅ present | ✅ EmptyState component | ❌ No error UI — exception silently swallowed in `.finally()` |
| Daily Report tab | ✅ present | ⚠️ `noAccess` only | ❌ Alert only, no persistent error view |
| Safety tab | ✅ present | ✅ EmptyState | ⚠️ Alert.alert() on ack failure only |
| Documents | ⚠️ Detail only — not in tab nav | — | ❌ No persistent error view |

**Gap:** Mobile screens lack persistent error states; failures fall through to a blank or stale screen with no recovery CTA.

### Kiosk

| Screen | Error Handling |
|---|---|
| Interstitial | ⚠️ Relies on apiClient bubbling — no component-level error fallback |

**Gap:** If the post-clockout payload fails, the interstitial screen may show blank content with no recovery path.

---

## 2. Pagination / Filtering

### API Endpoints

| Endpoint | Filtering | Pagination |
|---|---|---|
| GET /bulletins | ✅ locationId, type, status | ❌ No page/limit params |
| GET /daily-reports | ✅ startDate, endDate | ❌ No page/limit params |
| GET /documents | ✅ locationId, type, search | ❌ No page/limit params |
| GET /safety | ✅ locationId, type, status | ❌ No page/limit params |

**Gap:** All four list endpoints return unbounded result sets. At scale this is a performance and UX blocker.

### Angular Components

All four Angular components consume unbounded lists — no client-side pagination controls exist.

### Mobile Services

All four mobile services (`getBulletins`, `getDocuments`, `getContents`, `getReport`) accept no page/limit parameters.

---

## 3. Permission Gating

### API (backend enforcement)

| Controller | Read | Create | Delete | Approve/Archive |
|---|---|---|---|---|
| Bulletins | ✅ bulletins.read | ✅ bulletins.create | ✅ bulletins.delete | — |
| Daily Reports | ✅ reports.read | ✅ reports.submit | — | ✅ reports.approve |
| Documents | ✅ documents.read | ✅ documents.upload | — | ✅ documents.archive |
| Safety | ✅ safety.read | ✅ safety.create | ✅ safety.delete | — |

**Backend enforcement: ✅ complete.**

### Angular (frontend gating)

| Component | Create button guarded | Manager-only actions guarded |
|---|---|---|
| Bulletins | ❌ "New Bulletin" always visible | ❌ Delete always visible |
| Daily Reports | — | ❌ Approve button always visible |
| Documents | ❌ "Upload" always visible | ❌ Archive always visible |
| Safety | ❌ "New Content" always visible | ❌ Archive always visible |

**Gap:** Zero frontend permission checks in v2 Angular components. Buttons that trigger 403s are visible to all users.

### Mobile

No permission-based conditional rendering anywhere in v2 mobile screens. API returns 403; UI does not preemptively hide unauthorized actions.

---

## 4. Unread / Pending Indicators

### Angular

| Module | Header badge | Card indicator | Tab count pill |
|---|---|---|---|
| Bulletins | ✅ unreadCount() | ✅ unread-dot + bold | ✅ filter-pill |
| Safety | ✅ pending_actions badge | ✅ Action Required chip | ✅ filter-pill red |
| Daily Reports | ❌ No pending count | ✅ Status banner | ❌ No nav counter |
| Documents | N/A (no read concept) | N/A | N/A |

### Mobile

| Screen | Badge | Card indicator |
|---|---|---|
| Bulletins | ✅ headerBadge | ✅ unreadDot |
| Safety | ✅ headerBadge | ✅ Action Required |
| Daily Report | N/A | ✅ Status display |

### Kiosk

| Surface | Badge |
|---|---|
| Post-clockout interstitial | ❌ No count displayed before entering interstitial |

---

## 5. Test Coverage

### Angular

| File | Exists |
|---|---|
| bulletin.service.spec.ts | ❌ |
| daily-report.service.spec.ts | ❌ |
| document.service.spec.ts | ❌ |
| safety.service.spec.ts | ❌ |
| bulletins.component.spec.ts | ❌ |
| daily-reports.component.spec.ts | ❌ |
| documents.component.spec.ts | ❌ |
| safety.component.spec.ts | ❌ |

Reference spec files exist for `auth.guard` and `shiftsummaries` — patterns are established.

### API (.NET)

| File | Exists |
|---|---|
| BulletinServiceTests.cs | ❌ |
| DailyReportServiceTests.cs | ❌ |
| DocumentServiceTests.cs | ❌ |
| SafetyServiceTests.cs | ❌ |
| BulletinsControllerTests.cs (integration) | ❌ |
| DailyReportsControllerTests.cs (integration) | ❌ |
| DocumentsControllerTests.cs (integration) | ❌ |
| SafetyControllerTests.cs (integration) | ❌ |

Reference tests exist in `ShiftWork.Api.Tests/Plan/`, `Sandbox/`, `ShiftEvents/`.

### Mobile / Kiosk

No test infrastructure present in either project.

---

## 6. Structured Logging (API)

| Service | Method-entry logs | Success logs | Error logs |
|---|---|---|---|
| BulletinService | ❌ | ❌ | ⚠️ Controller catch only |
| DailyReportService | ❌ | ❌ | ⚠️ Controller catch only |
| DocumentService | ❌ | ❌ | ⚠️ Controller catch only |
| SafetyService | ❌ | ❌ | ⚠️ Controller catch only |

`_logger` is injected in all four services but logging calls are absent from service method bodies. Only controller-level `_logger.LogError(ex, ...)` exists.

**Gap:** Key v2 actions (bulletin create, safety ack, report submit, document open) produce no structured log entries on the happy path. Observability requires WS4 work (Week 5) but minimum service-level success logging should be added in WS1.

---

## 7. Offline / Network Error Handling

### Mobile

| Layer | Status |
|---|---|
| apiClient interceptor (401, network, request error) | ✅ Comprehensive |
| Inflight request deduplication | ✅ Present |
| Service-level user-facing error messages | ⚠️ Generic — no per-service context |
| Retry logic | ❌ No automatic retry on transient failure |

### Angular

| Layer | Status |
|---|---|
| HTTP interceptor error logging | ⚠️ console.error only |
| Offline vs server-error distinction | ❌ Missing |
| Retry logic (RxJS retry/retryWhen) | ❌ Missing |
| Cache strategy | ❌ None — all fresh fetches |

### API

| Layer | Status |
|---|---|
| External HTTP timeout (WeatherService) | ❌ No timeout policy |
| Graceful degradation (weather fails) | ✅ Report created without weather data |

---

## Gap Priority Summary

| # | Gap | Severity | Surface(s) |
|---|---|---|---|
| G1 | Zero test coverage for v2 modules | P1 | API, Angular, Mobile |
| G2 | No frontend permission gating | P1 | Angular, Mobile |
| G3 | No pagination on list endpoints | P2 | API, Angular, Mobile |
| G4 | Missing error UI states | P2 | Angular, Mobile, Kiosk |
| G5 | No service-level structured logging | P2 | API |
| G6 | No Angular retry / offline detection | P3 | Angular |
| G7 | Documents not in Mobile tab nav | P3 | Mobile |
| G8 | WeatherService has no timeout policy | P3 | API |
