# Angular design system, Plan B: screens verification

Branch `feature/angular-design-system-screens`, 2026-11-09 (Tasks 1-13). Headless checks were run in the build container. Visual and real-service checks need a running app with Firebase auth and are pending William.

## Automated checks

| Check | Result |
|---|---|
| `npm run lint:styles` | exit 0, 0 violations in 213 files; every `src/app/**/*.html` is either in `migrated` or in `exempt` |
| `npm run test:style-guard` | exit 0, 15/15 pass (includes `routed screens are all migrated` and `exempt entries need a reason`) |
| `npx ng test --watch=false --browsers=ChromeHeadless` | exit 1, 854 specs, 852 pass, 2 fail. Both failures are pre-existing on main, not caused by this branch: `AuditHistoryFiltersComponent should initialize with default 30-day range` and `AuditHistoryService should fetch audit history for entity` |
| `npx ng build --configuration production` | exit 0, no errors. One CSS minifier notice: `.btn-group>+.btn -> Did not expect successive traversals` (legacy Bootstrap, goes away in Plan F). No budget or translation warnings |
| `npx ng build --configuration production --localize` (es-SP) | exit 0. Same `.btn-group>+.btn` notice (per locale) and `Locale data for 'es-SP' cannot be found. Using locale data for 'es'` (pre-existing). No missing-translation warnings |
| `npx ng extract-i18n` | 1998 messages extracted, 1809 unique ids. No duplicate-id warnings after splitting `nav.web_help_tour` (aria-label now `nav.web_help_tour_aria`) |

Locales: `messages.xlf` regenerated (1809 trans-units, was stale). `messages.es.xlf`: 1809 units, every source id has a target, 0 duplicate ids, 0 ids absent from the source. Removed 499 dead ids (used only by uncompiled legacy templates or no longer referenced). Added 33 targets: 32 ng-bootstrap library messages (`ngb.*`, now extracted) and `nav.web_help_tour_aria`.

## Screen families by task

| Task | Screen family |
|---|---|
| 2 | Side panel and pager primitives; People as list plus drawer |
| 3 | Auth surfaces (sign-in, sign-up, forgot-password, verify-email, accept-invite) and company switch |
| 4 | Schedule dialogs (add/edit, conflict, repeat, sick, time off, history), replacement panel, schedule page |
| 5 | Overview, Timesheets (shift summaries), Analytics, Time off approvals, Time off settings |
| 6 | Workforce: Crews and Credentials |
| 7 | Job sites A: Locations and Areas |
| 8 | Job sites B: Cost codes, Tasks, Active sites, Daily reports |
| 9 | Field communication: Bulletins, Safety, Documents |
| 10 | Procore, Company settings, Billing, Profiles, Clock shift, Companies (manage-companies), Admin |
| 11 | Web kiosk (shell, employee list, to-do list and detail, photo schedule, PIN and admin-password dialogs, location select, question dialog, audit history) |
| 12 | Registration and onboarding |
| 13 | Coverage check; app root template, tour overlay and kiosk analog clock migrated to tokens |

## Style-guard exemptions

| Path | Reason |
|---|---|
| `src/app/features/dashboard/schedules/**` | Legacy schedules list; only reachable via `dashboard-routing.module`, which no module imports (dead) |
| `src/app/features/dashboard/schedule-edit/**` | Legacy NgbModal editor still opened by `schedule.component`; replace in Plan F |
| `src/app/features/dashboard/roles/**` | Legacy roles page; only reachable via the dead `dashboard-routing.module` |
| `src/app/features/sign-in/**`, `sign-up/**`, `forgot-password/**`, `verify-email/**` | Dead duplicates of `features/auth/*`; not referenced by any module or route |
| `**/*.bak` | Backup files, not compiled (none present at this commit) |

## Manual checks: Pending — William

Run with `npm run start` (EN) and the es-SP build served from `dist`.

- [ ] Pending — William: (a) Every screen family from Tasks 2-12 visual pass on desktop and iPad width; People drawer on iPad width; side panels on all list screens.
- [ ] Pending — William: (b) Kiosk at 768x1024 and 1280x800, including the analog clock on the navy header and the on-screen PIN keypad feel.
- [ ] Pending — William: (c) Spanish pass over auth, Company settings, registration/onboarding and kiosk; all Spanish strings are implementer-translated and need native review.
- [ ] Pending — William: (d) Toast look (toastr styling in `custom-theme.scss`).
- [ ] Pending — William: (e) Locations: Google Maps real init inside the overlay-in-side-panel (autocomplete dropdown z-order vs `z-[999]`, map sizing on open).
- [ ] Pending — William: (f) Permissions: as an administrator confirm permission-gated UI shows (Add buttons in Bulletins/Safety/Documents/Credentials, kiosk survey block in Company settings, nav items). Finding: no non-spec caller of `AuthService.loadUserPermissions`, `PermissionService.loadUserClaims` or `refreshClaimsIfNeeded` exists in `src` (also on main), so `hasPermission()` is false until claims load; confirm where claims are loaded at runtime.
- [ ] Pending — William: (g) Documents upload end-to-end against real S3.
- [ ] Pending — William: (h) Task 10 Procore and Billing flows against real services.
- [ ] Pending — William: (i) Plan F readiness (remove Bootstrap, ng-bootstrap, font-awesome, bootstrap-icons; enable preflight) after sign-off.

## Known limitations / deferred

- Safety Pending tab derives pending items from the current server page only.
- Employee list (kiosk) is unpaged and the status refresh is capped at 50.
- Legacy unmigrated components remain exempt (table above); `dashboard/schedule-edit` is still live via `schedule.component`.
- `messages.xlf` was regenerated here; `ngb.*` library messages now appear in both locale files.
- Tour overlay lost its gradient/spring animation and indigo palette in favor of tokens; verify visually.
