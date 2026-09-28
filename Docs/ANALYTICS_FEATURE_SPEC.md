# Analytics & Dynamic Reports — Feature Spec

**Branch:** `feature/analytics-reports` (from `feature-i18`)
**Surface:** Angular web (managers/admins) | **v1 scope:** Hours & Attendance + Schedule Coverage

## Problem

Managers have raw lists (shift summaries, schedules) but no visual, aggregated view of workforce data. They need a dynamic report builder: pick a metric, filter by location/area/person/period, see charts, export.

## Goals / Non-Goals

**Goals (v1):** interactive analytics dashboard, server-side aggregation (multi-tenant safe), 2 report domains, drill-down from chart → detail table, CSV/PNG export, ES/EN via existing i18n pipeline.
**Non-goals (v1):** mobile surface, custom user-built report definitions saved to DB, PTO/safety domains (v2), scheduled email reports (v2).

---

## Data sources (existing — no new tables)

| Metric | Source |
|---|---|
| Worked hours, clock-ins, lateness | `ShiftEvent` (EventType: clockin/clockout, EventDate, PersonId, KioskDevice, GeoLocation) |
| Scheduled hours, coverage, open shifts | `ScheduleShift` (StartDate/EndDate, LocationId, AreaId, PersonId, Status, BreakDuration) |
| Scheduled vs actual variance | Join of both by PersonId + date |

## API design

New `AnalyticsController` (thin) + `AnalyticsService` (all aggregation logic). **All aggregation server-side** — never ship raw events to the client. Every query scoped by `CompanyId` from auth context.

```
GET /api/companies/{companyId}/analytics/hours-summary
GET /api/companies/{companyId}/analytics/attendance          # lateness, no-shows, on-time %
GET /api/companies/{companyId}/analytics/schedule-coverage    # scheduled vs actual, open shifts
GET /api/companies/{companyId}/analytics/variance             # per person/location scheduled vs worked
Common query params: from, to, locationId?, areaId?, personId?, groupBy=day|week|month|person|location|area
```

**Response shape (uniform, chart-ready):**
```json
{
  "series": [{ "key": "worked", "label": "Worked Hours", "points": [{ "x": "2026-07-01", "y": 412.5 }] }],
  "totals": { "worked": 9820, "scheduled": 10200, "variancePct": -3.7 },
  "dimension": "day"
}
```

- DTOs only (`AnalyticsQueryDto`, `AnalyticsSeriesDto`) — no EF models exposed
- New permissions in `PermissionSeedService`: `analytics.view`, `analytics.export` (seeded to Admin/Manager roles)
- Caching: `IMemoryCache` 5-min per (companyId, endpoint, params) — dashboards are read-heavy
- Index check: `ShiftEvent(CompanyId, EventDate)`, `ScheduleShift(CompanyId, StartDate)` — add migration if missing

## UI design (the "excellent UI" part)

**Route:** `/dashboard/analytics` · **Sidebar:** new "Analytics" entry (Material icon `insights`) under Management.

**Layout — single screen, three zones:**

```
┌──────────────────────────────────────────────────────────┐
│ FILTER BAR (sticky): [Date range ▾][Location ▾][Area ▾]  │
│ [Person ▾] [Group by: Day|Week|Month]     [Export ▾]     │
├──────────────────────────────────────────────────────────┤
│ KPI CARDS (4): Worked hrs · Scheduled hrs · On-time % ·  │
│ Open shifts   — each with delta vs previous period ▲▼    │
├──────────────────────────────────────────────────────────┤
│ CHARTS GRID (2-col, responsive):                          │
│ ① Hours trend (line/area, worked vs scheduled)           │
│ ② Hours by location (horizontal bar)                     │
│ ③ Attendance (stacked bar: on-time/late/no-show)         │
│ ④ Coverage heatmap (day × location, % filled)            │
├──────────────────────────────────────────────────────────┤
│ DRILL-DOWN TABLE (appears on chart click): underlying    │
│ rows for the clicked segment, paginated, CSV export      │
└──────────────────────────────────────────────────────────┘
```

**UX rules (project principles applied):**
- One primary action per state: filters auto-apply (no "Run report" button); Export is the single CTA
- Skeleton loaders per card/chart (no full-page spinner); empty states with a friendly illustration + hint
- Every chart: click segment → drill-down table; hover tooltips; legend toggles series
- Date presets: Today · This week · This month · Last month · Custom
- Fully i18n'd: all strings added to `translations-source/strings.json` → generated to xlf

**Chart library: Apache ECharts via `ngx-echarts`** (recommended)
- Best-looking defaults, canvas performance for big series, built-in heatmap, PNG export free (`getDataURL`), theme-able to Material palette
- Alternative considered: ng2-charts/Chart.js (lighter but no heatmap, plainer); ngx-charts (aging, weak maintenance)
- Lazy-load the analytics module so ECharts (~330 KB gz) never touches the main bundle

## Angular structure

```
features/dashboard/analytics/
  analytics.component.ts|html|css        # container: filter state, layout
  components/
    kpi-cards.component.ts               # 4 KPI cards with deltas
    hours-trend-chart.component.ts
    location-bar-chart.component.ts
    attendance-chart.component.ts
    coverage-heatmap.component.ts
    drilldown-table.component.ts
  analytics-theme.ts                     # ECharts theme matched to Material palette
core/services/analytics.service.ts       # one method per endpoint
```

- State: local component state + RxJS (`combineLatest` of filter controls → debounced fetch). No NgRx — this is screen-local UI state per project convention.
- Route added to `dashboard-routing.module.ts` (lazy), guarded by `analytics.view`
- Sidebar link in `dashboard.component.html` under Management

## Implementation plan

| Phase | Work | Size |
|---|---|---|
| 1 | API: `AnalyticsService` + controller, DTOs, hours-summary + coverage endpoints, permissions seed, unit tests | M |
| 2 | Angular: module scaffold, route, sidebar, filter bar, `analytics.service.ts`, KPI cards wired to endpoint | M |
| 3 | Charts: ngx-echarts setup + theme, 4 charts wired, skeletons/empty states | M |
| 4 | Drill-down table + CSV/PNG export, attendance + variance endpoints | M |
| 5 | i18n strings (EN/ES), permission-based nav visibility, responsive pass, e2e smoke | S |

## Verification

- API unit tests: aggregation correctness (worked hours from clockin/clockout pairs incl. unclosed shifts), CompanyId isolation (tenant A can't read tenant B), date-boundary/timezone cases
- Perf: hours-summary over 90 days × 200 employees < 500 ms (verify indexes)
- UI: filter changes update all charts consistently; drill-down rows sum to chart segment value; ES translation renders on all labels

## Open questions

1. Lateness threshold: fixed grace (e.g., 5 min after `ScheduleShift.StartDate`) or per-company setting in `CompanySettings`?
2. Should unclosed shifts (clockin without clockout) count as worked-until-now or be excluded + flagged?
3. Export: CSV of drill-down only, or full PDF report (reuse `reports.export` pattern)?
