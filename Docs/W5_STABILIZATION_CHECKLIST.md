# W5 Stabilization Checklist — Bug Bash & Release Readiness

**Branch:** `feature/professional-w5-stabilization` (from `develop`)
**Scope:** Bug bash across API, Angular, Mobile, Kiosk; test-suite reliability; go/no-go readiness
**Plan reference:** `Docs/PROFESSIONAL_DAILY_USE_PLAN.md` — Week 5

## 1. Bug bash — test suite results

| Suite | Before this sprint | After this sprint |
|---|---|---|
| API (`ShiftWork.Api.Tests`) | 71 passing (baseline) | **87/87 passing** (16 added in W4) |
| Angular (`ng test`) | **0 tests ran** — entire Karma bundle failed to compile | **99/99 passing** |
| Angular (`ng build`) | Failed — missing `bootstrap-icons`/`material-design-icons` packages | Passing |
| Mobile (`npm test`) | Could not run — stale `node_modules`, missing `jest-expo` binary | **57/57 passing** |
| Kiosk (`npm test`) | Could not run — stale `node_modules`, missing `jest-expo` binary | **8/8 passing** |

### Findings and fixes

**Angular test infrastructure was completely broken, not just flaky.**
- The `test` architect target in `angular.json` used the plain `@angular-devkit/build-angular:karma`
  builder instead of `@angular-builders/custom-webpack:karma`, so `process.env` (needed by
  `environment.ts`) was `undefined` and every spec failed before running. Fixed by pointing `test`
  at the same custom webpack config as `build`/`serve`.
- Once that was fixed, 6 components (`SafetyComponent`, `DocumentsComponent`, `BulletinsComponent`,
  `DailyReportsComponent`, `CompanyFormComponent`, `CompanySwitchComponent`) still failed
  `NG8001`/`NG8002` template type-checking, because their owning `NgModule` was never reachable
  from `tsconfig.spec.json`'s TypeScript program (specs import the component directly, never the
  module). This is an all-or-nothing failure — it blocked the *entire* Karma bundle, meaning **0
  Angular tests could run at all** before this sprint, not just the affected six. Fixed by adding a
  side-effect `import './x.module'` to each affected spec.
- `node_modules` were stale relative to `package.json` in Angular, Mobile, and Kiosk (missing
  packages, missing `jest-expo` binary) — `npm install` required in all three before any test could
  run locally.
- Angular's test builder reads `API_URL` from a local `.env` via `custom-webpack.config.ts`'s
  `dotenv`; it was unset, so `environment.apiUrl` was `undefined` in tests. Added
  `API_URL=http://localhost:5182/api` to the local (gitignored) `.env`. **CI gap:** there is no
  equivalent env-injection step in `pr-tests.yml`'s `angular-typecheck` job — if Angular unit tests
  are ever added to CI, they'll need this.
- `pr-tests.yml`'s `angular-typecheck` job does not actually run Angular unit tests — it runs
  `tsc --noEmit` piped through a `grep` filter with `|| true`, so it always reports success
  regardless of type errors. Angular unit tests are **not gated in CI today**.

**Real component/logic bugs found once tests could actually execute:**
- `KioskComponent` imported `MatDialogModule` solely for constructor DI. `MatDialogModule`'s own
  providers created a component-scoped `MatDialog` instance that shadowed the TestBed override, so
  every dialog-opening test was silently calling the *real* `MatDialog.open()`, which crashed
  (`Cannot read properties of undefined (reading 'push')`). `MatDialog` is `providedIn: 'root'` and
  the template never uses `mat-dialog-*` directives, so the import was unnecessary — removed.
- `audit-history.spec.ts` provided `MAT_DIALOG_DATA` via a string token instead of the real
  `InjectionToken`, checked a `mattooltip` DOM attribute that `MatTooltip` never reflects (use
  `aria-label`), and asserted on `req.url` (excludes query params) instead of `req.urlWithParams`.
- `PhotoScheduleComponent`'s DST/UTC-boundary tests used mock schedule objects missing the
  `location` field the template always renders, and a `WakeLockService` stub missing
  `isSupported()` — both caused real template-crash `TypeError`s during `detectChanges()`.

**Result:** all 4 module test suites are green (87 + 99 + 57 + 8 = 251 tests), verified locally.
Details and full diff are on `feature/professional-w5-stabilization` (commits `8fe64e5`, `4805a7d`).

## 2. Performance smoke tests

**Not done this sprint** — no load/perf testing was run against the API or dashboard under this
task. Recommend as a follow-up before release: p95 latency on the 4 v2 list endpoints
(bulletins/documents/safety/daily-reports) under realistic pagination load, and an Angular bundle
budget check (current initial bundle is ~10.9 MB raw / uncompressed — worth revisiting against the
`4mb`/`10mb` budgets already configured in `angular.json`).

## 3. Go/no-go acceptance checklist

- [x] API tests passing (87/87)
- [x] Angular tests passing (99/99) — **newly enabled**, previously 0 ran
- [x] Angular build passing
- [x] Mobile tests passing (57/57)
- [x] Kiosk tests passing (8/8)
- [x] No open P1 defects found during this bug bash (2 cross-tenant write bugs found in W4 were
      already fixed and merged separately — see `Docs/W4_SECURITY_CHECKLIST.md`)
- [ ] Performance/load smoke tests — not run, recommend before release
- [ ] CI updated to actually gate on Angular unit tests (currently `tsc`-only, always green)
- [ ] Dashboards/alerts and runbooks — Week 6 scope, not started

**Recommendation:** conditional go — core functional test coverage across all 4 surfaces is now
real and green for the first time. Before a release cut, close the two open items above (CI gate
+ perf smoke test), which are cheap relative to the risk they cover.
