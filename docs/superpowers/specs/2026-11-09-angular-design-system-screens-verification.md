# Angular design system, Plan B: screens verification

Branch `feature/angular-design-system-screens`, 2026-11-09 (Tasks 1-13). Headless checks were run in the build container. Visual and real-service checks need a running app with Firebase auth and are pending William.

## Automated checks

Re-run 2026-11-11 after the final review and the design-language pass (HEAD after the `chore(web): regenerate i18n source and sync Spanish` commit). The 2026-11-09 Task 13 numbers were 854 specs / 852 pass, 15 guard tests, 1809 i18n units.

| Check | Result |
|---|---|
| `npm run lint:styles` | exit 0, 0 violations in 213 files; every `src/app/**/*.html` is in `migrated` or `exempt`. New rule `off-scale-text` (arbitrary `text-[Npx]` outside 12/13/15/18/26) |
| `npm run test:style-guard` | exit 0, 16/16 pass |
| `ng test --watch=false` (ChromeHeadless `--no-sandbox`, `/tmp/karma.ci.js`) | exit 1, 866 specs, 864 pass, 2 fail. Both failures are pre-existing on main and not caused by this branch: `AuditHistoryFiltersComponent should initialize with default 30-day range`, `AuditHistoryService should fetch audit history for entity` |
| `npx ng build --configuration production` | exit 0. Only notice: `.btn-group>+.btn -> Did not expect successive traversals` (legacy Bootstrap, goes away in Plan F) |
| `npx ng build --configuration production --localize` (es-SP) | exit 0. Same Bootstrap notice per locale and `Locale data for 'es-SP' cannot be found. Using locale data for 'es'` (pre-existing). No missing-translation warnings |
| `npx ng extract-i18n` | 2021 messages, 1831 unique ids, no duplicate-id warnings |

Locales: `messages.xlf` regenerated again (1831 trans-units). `messages.es.xlf`: 1831 units, every source id has a target, 0 duplicate ids, 0 ids absent from the source, `<source>` texts synced with the extracted file (120 were stale), placeholder parity between source and target checked for every unit. Every `@@id` used by compiled templates and `$localize` has a Spanish target; the 22 ids without one are only in the uncompiled dead duplicates listed under exemptions. Task 13 removed 499 dead ids and added 33 targets (32 `ngb.*`, `nav.web_help_tour_aria`); nothing live was lost (re-checked 2026-11-11).

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
| Final (2026-11-11) | Whole-branch review fixes; design language extracted from the original Overview and Procore and applied through primitives (see below) |

## Style-guard exemptions

| Path | Reason |
|---|---|
| `src/app/features/dashboard/schedules/**` | Legacy schedules list; only reachable via `dashboard-routing.module`, which no module imports (dead) |
| `src/app/features/dashboard/schedule-edit/**` | Legacy NgbModal editor still opened by `schedule.component`; replace in Plan F |
| `src/app/features/dashboard/roles/**` | Legacy roles page; only reachable via the dead `dashboard-routing.module` |
| `src/app/features/sign-in/**`, `sign-up/**`, `forgot-password/**`, `verify-email/**` | Dead duplicates of `features/auth/*`; not referenced by any module or route |
| `**/*.bak` | Backup files, not compiled (none present at this commit) |

## Design language

William reviewed the build at `d0a1f6d` (Tasks 1-3 only) and said Overview and Procore "look very professional, but the rest of the screens don't look made by the same designer". At `d0a1f6d` both screens were still in their pre-migration design, so the reference is the original `overview.component.{html,css}` and `procore.component.{html,css}`.

**Reference language (measured from the original CSS).** Strong header block first (Overview: dark navy/teal band, 18px radius, 24px padding, uppercase 0.74rem eyebrow at .14em, 1.35-2rem title, muted subtitle, pills and a range switch on the right; Procore: full-bleed band with a 64px icon tile, 2rem/700 title, status pill). Content in white cards: 1px light border plus a soft shadow (`0 6px 14px rgba(15,23,42,.05)` / `0 2px 8px rgba(0,0,0,.08)`), 14-16px radius, 16-24px padding, 16-32px gaps. Card headers lead with an icon (Procore, accent color) or an uppercase .68rem eyebrow at .12em above a 1.1-1.25rem bold title (Overview), with a count pill on the right ("3/10 mapped", "4 open"). KPIs as cards: 32px tinted icon tile (8px radius), 1.55rem value, 600 label, .82rem muted description, trend pill (700, .78rem, 999px radius). Lists as bordered rows (10-12px radius, 11-13px padding) tinted by state (red/amber/blue/green background and border) with a 32px icon tile; GPS ring 82px. Info hints with an icon; last-sync in a tinted box. Pills everywhere for badges. Typography: 12-15px secondary text, 600-700 weights for names and values.

**Did Tasks 5 and 10 keep it?** No, both were flattened. Overview (Task 5) lost the hero band, the KPI cards (replaced by a numeric summary strip with label and trend joined in one string), the eyebrows, the tinted alert and location rows with icon tiles (replaced by stacked `lz-alert`s and plain bordered rows), the GPS ring (bar) and the icon-tiled action and roadmap cards. Procore (Task 10) kept structure but lost its header icon, icon-led card titles, the prominent mapped badges and the hint/last-sync treatment. The rest of the app had the same flat border-only, 8px-radius, no-eyebrow look, and Bootstrap reboot margins (legacy layer) silently added 0.5-1rem below every heading and paragraph, which loosened every screen.

**What changed, primitive level (all screens inherit):**
- Tokens: `--lz-shadow-card`, panel radius 12px, control radius 8px, chips are pills (999px), `--lz-hero-bg` (navy with a soft blue glow, only for the Overview band), `--lz-hero-line`, `--lz-hero-raised`; `lz-eyebrow` utility (12px/600/.12em uppercase via CSS, i18n source sentence case).
- Base layer: `h1-h6, p { margin: 0 }` so spacing comes only from utilities (what Plan F preflight will do anyway).
- `lz-page-header`: raised paper card (border, card shadow, 12px radius, 24/20px padding) with a 48px navy/amber icon tile and eyebrow. Eyebrow and icon come from the rail section and item automatically (`LZ_PAGE_CONTEXT`, provided by the dashboard shell from `pageContextFor(url)`; account pages get "Account"); explicit `eyebrow`/`icon` inputs win. `variant="hero"` is the Overview band.
- `lz-panel`: card shadow, 12px radius, optional `eyebrow` and `icon`, 18px title, 20px padding; nested table cards and KPI cards drop their shadow; `min-w-0` so panels never widen grids.
- New `lz-icon-tile` (32/40/48px tinted squares, 7 tones) and `lz-kpi-card` (icon tile, 26px value, label, description, trend pill whose icon carries the judgement).
- `lz-table-scroll` card shadow; `lzTable` headers 12px/600 uppercase at .06em with a stronger header rule, 12px cell padding, no rule under the last row.
- `lz-status-chip` pill, 12px/600; `lz-empty-state` is a card on the canvas (56px round icon tile) and flat inside panels, side panels, dialogs and table cards; `lz-alert` gets a tone-tinted border; `lzButton` never underlines and gains `variant="inverse"` for dark bands; `lz-segmented` gains `inverse`; auth shell gets the brand tile and card shadow; side panel and dialog titles are 18px.
- Style guard rule `off-scale-text`.

**Per screen:** Overview rebuilt on the primitives (hero band, KPI cards, tinted rows with icon tiles, SVG GPS ring with `role="progressbar"`, action and roadmap cards). Procore: icon-led panel titles, mapped badges (success when complete), info hints with icon, grouped toggles, divided action row, last-sync box. Analytics KPI tiles now use `lz-kpi-card`. Icon-led panel titles on every multi-panel screen. 20px section rhythm on all routed screens. Card elevation on the remaining hand-built page cards (schedule grid and strip, schedule, timesheet cards, billing banner, kiosk tiles and audit timeline). Billing plan icon tile; tour overlay on `lzButton` with i18n.

**How this was checked.** Code-level comparison of the original CSS against tokens and primitives, computed-style specs for every primitive change, and headless screenshots of Overview, Procore, Crews and Company settings: the rendered DOM from karma with mock data, styled by the production CSS bundle, captured with headless Chrome (no backend, no auth). The screenshots show the page header without its eyebrow and icon tile because the specs do not provide the dashboard page context. Not rendered: every other screen, dialogs, side panels, kiosk, Spanish, real data volumes.

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
- [ ] Pending — William: (j) Design language: Overview hero band and KPI cards against the old Overview; every page header shows the section eyebrow and icon tile; panels, tables and empty states read as one family on People, Schedule, Timesheets, Locations, Company settings, Billing, auth and kiosk.
- [ ] Pending — William: (k) Base-layer margin reset: headings and paragraphs no longer get Bootstrap's bottom margin; look for any screen where two paragraphs now touch (a utility margin is the fix). The legacy `schedule-edit` NgbModal (still opened by `schedule.component`) is also affected.
- [ ] Pending — William: (l) Tour overlay (now Loqzen buttons, step counter, segment progress) and Spanish for the new strings (overview eyebrows, analytics KPI labels, tour, account eyebrow).
- [ ] Pending — William: (i) Plan F readiness (remove Bootstrap, ng-bootstrap, font-awesome, bootstrap-icons; enable preflight) after sign-off.

## Known limitations / deferred

- Safety Pending tab derives pending items from the current server page only.
- Employee list (kiosk) is unpaged and the status refresh is capped at 50.
- Legacy unmigrated components remain exempt (table above); `dashboard/schedule-edit` is still live via `schedule.component`.
- `messages.xlf` was regenerated here; `ngb.*` library messages now appear in both locale files.
- Tour overlay lost its gradient/spring animation and indigo palette in favor of tokens, then was rebuilt on `lzButton` (2026-11-11); verify visually.
- Overview KPI labels, notification texts and roadmap copy are still hard-coded English in `overview.component.ts` (pre-existing).
- Permissions: `hasPermission()` stays false until claims load (finding (f)); owner decided this is its own project.
