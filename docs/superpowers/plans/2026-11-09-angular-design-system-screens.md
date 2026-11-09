# Angular Design System — Plan B: Every Remaining Screen (spec roadmap B–E merged)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every routed screen of the Angular app (auth, company switch, all dashboard menu items, account pages, web kiosk, registration, onboarding) renders on the Plan A design system, so no screen shows the old theme.

**Architecture:** Task 1 adds the missing shared primitives (form field, panel, alert, empty state, table, dialog frame, auth shell) and themes Material dialogs/tabs/toastr from the `--lz-*` tokens. Every later task migrates one family of screens to those primitives plus Plan A's (`lzButton`, `lz-page-header`, `lz-status-chip`, `lz-summary-strip`), then adds the screen to `style-guard.json` and to the `@source` list in `src/styles/tailwind.css`. The style guard is each task's failing test. Bootstrap stays loaded (layer `legacy`) until Plan F.

**Tech Stack:** Angular 19.2 NgModule app, Angular Material 19, Tailwind v4, ngx-toastr, Karma + Jasmine, `scripts/style-guard.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-08-angular-design-system-design.md` (tokens §3, components §4, copy §6, a11y §7, migration rules §8). Plan A: `docs/superpowers/plans/2026-11-08-angular-design-system-foundation.md` (read its Global Constraints; they apply here unchanged).

**Not in this plan:** Removing Bootstrap/ng-bootstrap/font-awesome/bootstrap-icons and enabling Tailwind preflight (Plan F, after William's visual sign-off); Mobile/Kiosk-RN tokens; any change to component TypeScript behavior, routes or API calls. Components not reachable from a route (`dashboard/schedules/**`, `dashboard/schedule-edit/**`, `dashboard/roles/**`, `dashboard/dashboard-routing.module.ts` targets) are left untouched; Task 13 lists them in the verification doc.

## Global Constraints

- Branch `feature/angular-design-system-screens` from `main` (PR #63 is merged). Paths are relative to `ShiftWork.Angular/` unless prefixed with the repo root.
- Everything in Plan A's Global Constraints: Loqzen naming, i18n ids `@@<feature>.<key>` with Spanish in `src/locale/messages.es.xlf`, sentence case, targets ≥ 48×48, focus ring `2px solid var(--lz-link)` offset 2px, one `variant="primary"` button per screen, `<mat-icon>` only, no hex/rgb/`box-shadow`/`font-size` literals/gradients/`backdrop-filter`/Bootstrap classes in migrated files, TS behavior unchanged.
- Migration = template + stylesheet only. A screen's `.css`/`.scss` shrinks to layout the utilities cannot express (target: deleted or < 30 lines). Existing `i18n` ids are kept; reused text keeps its id.
- A migrated screen is registered in two places in the same commit: `style-guard.json` `migrated` and `src/styles/tailwind.css` `@source` (directory or file globs of that screen, including its dialogs/sub-components).
- List screens never put a create/edit form beside or below the list. The form opens in `lz-side-panel` (Task 2) and lists with more than 25 possible rows are paged with `lz-pager` + `paginate`. Wizards (registration, onboarding) and short confirmations keep their own layout/dialogs.
- Loading, error and empty states of a screen use `lz-alert` / `lz-empty-state`, never bare text or Bootstrap `alert`.
- Wide tables sit inside `lz-table-scroll` and scroll horizontally inside it; the page itself never scrolls horizontally at 360px.

## Review Focus

1. **Material/toastr on screens not yet migrated** — dialogs, snackbars and toasts restyled in Task 1 must stay opaque, readable and focus-visible on every unmigrated screen mid-plan. Pinned in Task 1 (`theme.spec.ts` computed-style asserts for `.mat-mdc-dialog-surface`, `.toast-success`, `.toast-error`).
2. **Auth flows keep working** — failed sign-in shows its error in a `role="alert"` region, the submit button is disabled while `loading`, Google sign-in stays reachable by keyboard, long Spanish labels do not overflow the card. Pinned in Task 3.
3. **Tables at handset width** — Timesheets, Cost codes, Locations, Time off approvals scroll inside their wrapper at 360px. Pinned in Task 1 (`lz-table-scroll` spec) and re-asserted in Tasks 5, 7, 8.
4. **Web kiosk on a tablet** — PIN pad, employee list and clock buttons stay ≥ 48×48 and fit 768×1024 and 1280×800 without page scroll; the analog clock keeps its size. Pinned in Task 11.
5. **Dialogs: focus and dismissal** — every migrated dialog traps focus, closes on Escape and the close button, and has exactly one primary action. Pinned in Task 1 (`lz-dialog-frame` spec) and reused in Tasks 4, 5, 11.
6. **iPad usage and 1000 rows** — on an 820px-wide viewport the add/edit form is reachable in one tap from any scroll position, the page never scrolls horizontally, and a 1000-row list renders one page (25 by default). Pinned in Task 2 (People spec) and re-asserted in Tasks 6, 7, 8, 9.

---

### Task 1: Shared primitives and Material/toastr theming

**Files:**
- Create: `src/app/shared/ui/field/lz-field.directive.ts`, `lz-field.component.ts`; `panel/lz-panel.component.ts`; `alert/lz-alert.component.ts`; `empty-state/lz-empty-state.component.ts`; `table/lz-table.directive.ts`, `lz-table-scroll.component.ts`; `dialog/lz-dialog-frame.component.ts`; `auth-shell/lz-auth-shell.component.ts`; one `*.spec.ts` beside each (all under `src/app/shared/ui/`)
- Modify: `src/app/shared/ui/index.ts`, `src/custom-theme.scss`, `src/styles/tailwind.css` (add `@source` for the new folders), `src/locale/messages*.xlf` (dialog close label)
- Test: the specs above plus extend `src/app/shared/ui/theme.spec.ts`

**Interfaces:**
- Produces (all standalone, exported from `shared/ui/index.ts`):
  - `LzFieldDirective` — selector `input[lzField], select[lzField], textarea[lzField]`; host classes: `min-h-12 w-full rounded-control border border-line-strong bg-paper px-3 font-[inherit] text-ink placeholder:text-ink-muted`, `aria-invalid` styled `border-danger`.
  - `LzFieldComponent` — `lz-field`; `@Input({required:true}) label: string`, `@Input() hint?: string`, `@Input() error?: string | null`, `@Input() controlId?: string`; renders `<label [for]>`, projects the control, hint as `<p>`, error as `<p role="alert">` (only when set).
  - `LzPanelComponent` — `lz-panel`; `@Input() heading?: string`; projected slot `[lzPanelActions]`; surface `rounded-panel border border-line bg-paper`.
  - `LzAlertComponent` — `lz-alert`; `@Input() tone: 'info'|'success'|'warning'|'danger' = 'info'`; `role="alert"` for `danger`, `role="status"` otherwise; leading `<mat-icon>` per tone.
  - `LzEmptyStateComponent` — `lz-empty-state`; `@Input({required:true}) icon: string`, `@Input({required:true}) title: string`, `@Input() body?: string`; slot `[lzEmptyAction]`.
  - `LzTableDirective` — selector `table[lzTable]`; header/row/cell classes matching People's table (`w-full border-collapse text-left`, `thead` `bg-paper-alt text-[13px] text-ink-soft`, rows `border-b border-line-soft`, cells `px-4 py-2`) applied via host class + descendant variants.
  - `LzTableScrollComponent` — `lz-table-scroll`; wrapper `overflow-x-auto rounded-panel border border-line bg-paper`.
  - `LzDialogFrameComponent` — `lz-dialog-frame`; `@Input({required:true}) title: string`, `@Input() subtitle?: string`, `@Input() closable = true`, `@Output() closed = new EventEmitter<void>()`; slots default (body) and `[lzDialogActions]` (footer, right-aligned); close button is `mat-icon` `close` with `aria-label` "Close".
  - `LzAuthShellComponent` — `lz-auth-shell`; `@Input({required:true}) title: string`, `@Input() subtitle?: string`, `@Input() wide = false`; full-height `bg-canvas`, centered `lz-panel`-style card (`max-w-md`, `max-w-2xl` when `wide`), Loqzen wordmark (`font-display`) above the title, `<h1>` for the title.

- [ ] **Step 1: Write failing specs.** One spec per primitive, e.g. `lz-field.component.spec.ts` asserts the `<label for>` matches the control id and that `error` renders inside `[role=alert]` only when set; `lz-alert` asserts `role` per tone; `lz-table-scroll` asserts the host has `overflow-x-auto`; `lz-dialog-frame` asserts the close button emits `closed`, has `aria-label="Close"`, and Escape keydown on the host emits `closed` when `closable`; `lz-auth-shell` asserts exactly one `h1` and `max-w-2xl` only when `wide`. Extend `theme.spec.ts`: `.mat-mdc-dialog-surface` background is `rgb(255, 255, 255)`; a `.toast-success` element's `background-color` equals `--lz-success-bg` and `.toast-error`'s equals `--lz-danger-bg`.
- [ ] **Step 2: Run** `npx ng test --watch=false --browsers=ChromeHeadless --include="src/app/shared/ui/**/*.spec.ts"`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement the primitives** with the signatures above, `ChangeDetectionStrategy.OnPush`, utilities only (no CSS files).
- [ ] **Step 4: Theme Material and toastr from tokens** in `src/custom-theme.scss`/`src/styles/`: dialog surface (`--lz-paper`, `--lz-radius-dialog`, `--lz-shadow-overlay`), dialog title/actions spacing, tabs (active indicator `--lz-link`), form-field/select/datepicker outlines `--lz-line-strong`, slide-toggle/checkbox accent `--lz-link`, snackbar, and ngx-toastr `.toast-success|error|warning|info` using the `*-bg`/`*-ink` token pairs (replace its default saturated colors; toast container keeps its position).
- [ ] **Step 5: Run** the Step 2 command plus `npm run lint:styles`. Expected: all PASS.
- [ ] **Step 6: Commit** `feat(web): shared form, panel, alert, table, dialog and auth-shell primitives`.

### Task 2: Side panel, pager, and People as list + drawer

Design critique (2026-11-09): a list and its create/edit form on one page break on iPad (form falls below the table under 1280px) and do not scale to ~1000 rows. Lists become full-width; the form opens in a drawer; long lists are paged.

**Files:**
- Create: `src/app/shared/ui/side-panel/lz-side-panel.component.ts` (+ `.spec.ts`), `src/app/shared/ui/pager/lz-pager.component.ts` (+ `.spec.ts`), `src/app/shared/ui/pager/paginate.ts` (+ `.spec.ts`)
- Modify: `src/app/shared/ui/index.ts`, `src/app/features/dashboard/people/people.component.{html,ts,spec.ts}`, `src/locale/messages*.xlf`
- Test: the specs above

**Interfaces:**
- Produces (standalone, exported from `shared/ui/index.ts`):
  - `LzSidePanelComponent` — `lz-side-panel`; `@Input({required:true}) heading: string`, `@Input() subtitle?: string`, `@Input() open = false`, `@Input() dirty = false`, `@Output() closed = new EventEmitter<void>()`; slots: default (body, scrolls) and `[lzPanelFooter]` (sticky footer, right-aligned: cancel `variant="secondary"` + one primary). Host classes: panel `fixed inset-y-0 right-0 z-40 flex w-full flex-col bg-paper shadow-overlay lg:w-[30rem]` (full screen below 1024px, 30rem drawer from 1024px), scrim `fixed inset-0 z-30 bg-navy-900/40`. `role="dialog"`, `aria-modal="true"`, `aria-labelledby` the heading `h2`; `cdkTrapFocus` with initial focus on the first field; body scroll locked while open; focus returns to the element that was focused before opening; footer has `pb-[env(safe-area-inset-bottom)]`; slide-in transition disabled under `prefers-reduced-motion`. Closing (close button, scrim, Escape) emits `closed` immediately when `dirty` is false; when `dirty` is true it shows an inline bar "Discard your changes?" with "Keep editing" and "Discard" (both `lzButton variant="secondary"`; the Discard label uses `text-danger-ink`) and emits `closed` only after "Discard".
  - `LzPagerComponent` — `lz-pager`; `@Input({required:true}) total: number`, `@Input() page = 1`, `@Input() pageSize = 25`, `@Input() pageSizes: number[] = [25, 50, 100]`, `@Output() pageChange = new EventEmitter<number>()`, `@Output() pageSizeChange = new EventEmitter<number>()`; renders "1–25 of 1,000" (locale-formatted), previous/next buttons (≥48px, `aria-label` Previous page / Next page, disabled at the ends), page-size `select` with `lzField`. Hidden when `total <= min(pageSizes)`.
  - `paginate<T>(items: readonly T[], page: number, pageSize: number): T[]` in `paginate.ts` (1-based page; clamps out-of-range pages to the last page; empty array for empty input).
- Consumes: Task 1 `lzField`, `lz-field`, `lz-panel`, `lz-empty-state`, `lz-alert`, `lzTable`, `lz-table-scroll`; Plan A `lzButton`, `lz-page-header`.

- [ ] **Step 1: Write failing specs.** `paginate.spec.ts`: `paginate([1..120], 1, 25)` has 25 items starting at 1; page 5 has 20 items; page 99 clamps to page 5; `[]` returns `[]`. `lz-pager.spec.ts`: shows "1–25 of 120" for total 120; next emits `pageChange(2)`; previous disabled on page 1; hidden for total 20; changing the select emits `pageSizeChange(50)`. `lz-side-panel.spec.ts`: has `role="dialog"` and `aria-modal="true"`; Escape emits `closed` when not dirty; when dirty, Escape/scrim/close button show "Discard your changes?" and emit nothing until "Discard" is clicked, "Keep editing" hides the bar; panel class list contains `w-full` and `lg:w-[30rem]`; focus returns to the opener after close. `people.component.spec.ts` (extend): no `form` in the DOM before opening; clicking "Add person" renders `lz-side-panel` containing the form and focuses the name input; clicking a row opens the panel with the person's name as heading; with 120 people only 25 `tbody tr` render and the pager reads "1–25 of 120"; search text and page survive closing the panel; closing a dirty form asks to discard; exactly one `lzButton[variant=primary]` on the page while the panel is closed.
- [ ] **Step 2: Run** `npx ng test --watch=false --browsers=ChromeHeadless --include="src/app/shared/ui/**/*.spec.ts" --include="src/app/features/dashboard/people/**/*.spec.ts"`. Expected: FAIL.
- [ ] **Step 3: Implement `paginate`, `LzPagerComponent`, `LzSidePanelComponent`** to the signatures above (OnPush, utilities only, `@angular/cdk/a11y` for the focus trap).
- [ ] **Step 4: Rework People** in `people.component.{html,ts}`: list full width (remove the two-column grid); add component state `panelOpen: boolean`, `page = 1`, `pageSize = 25`, `selectedIds = new Set<number>()`; `filteredPeople` unchanged, template iterates `paginate(filteredPeople, page, pageSize)`; changing search or status resets `page` to 1; row click and "Add person" set `panelOpen = true` (add resets the form; row click patches it as today); the form lives inside `lz-side-panel` with heading = person name or "Add person", `dirty` bound to `personForm.dirty`, footer = Cancel + the screen's save action (the one primary button while open; "Add person" in the page header is the one primary while closed — use `variant="secondary"` for the header button while `panelOpen`). Split the form: "Basics" (name, email, phone, status) always visible, "Address and app access" (address, city, state, PIN, photo URL, invite) in a native `<details>` that is open when editing a person who has any of those values. Add row checkboxes (≥24×24 hit area per Plan A ruling R4) and a selection bar ("N selected" · "Set active" · "Set inactive" · "Clear") shown when `selectedIds.size > 0`; the status actions call the existing people-update service method once per selected person via `forkJoin` and then reload the list (verify the method exists; if the service has no per-person update, report BLOCKED rather than adding API calls). Keep every existing handler used by the invite dialog unchanged.
- [ ] **Step 5: Run** the Step 2 command plus `npm run lint:styles` and `npx ng build --configuration development`. Expected: all PASS.
- [ ] **Step 6: Commit** `feat(web): side panel and pager primitives; People as full-width list with drawer`.

### Task 3: Auth surfaces and company switch

**Files:**
- Modify: `src/app/features/auth/{sign-in,sign-up,forgot-password,verify-email,accept-invite}/*.{html,css}`, `src/app/features/company-switch/company-switch.component.{html,css}`, `src/styles/tailwind.css`, `style-guard.json`, `src/locale/messages*.xlf`
- Test: `src/app/features/auth/sign-in/sign-in.component.spec.ts` (create), extend `company-switch.component.spec.ts`

**Interfaces:**
- Consumes: Task 1 `lz-auth-shell`, `lz-field`, `lzField`, `lz-alert`, `lzButton`.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Failing tests.** `sign-in.component.spec.ts`: renders one `h1` "Sign in"; with `errorMessage` set, a `[role=alert]` shows it; submit button is `disabled` while `loading`; the Google button and the "Forgot password" link are focusable (`tabindex` not `-1`); exactly one `lzButton[variant=primary]`. Extend company-switch spec: companies render as `button` elements (not clickable `div`), each ≥ 48px tall (`min-h-12` class), error state renders `lz-alert` with tone `danger`.
- [ ] **Step 2:** Add the six globs to `style-guard.json` and `@source`; run `npm run lint:styles` and the new specs. Expected: FAIL.
- [ ] **Step 3: Migrate** each template onto `lz-auth-shell` (`wide` only for `accept-invite` and company-switch if it lists > 4 companies), fields on `lz-field`+`lzField`, one primary button, Google sign-in as `lzButton variant="secondary"` with its icon via `mat-icon` (no Font Awesome). Keep the form bindings, `(ngSubmit)` handlers and element ids the components' TS reads. Company-switch rows become `<button type="button" lzButton variant="secondary">` full-width. Delete the screens' CSS files and the `styleUrls` entries when empty.
- [ ] **Step 4: Run** the specs, `npm run lint:styles`, `npx ng build --configuration development`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): migrate sign-in, sign-up, forgot-password, verify-email, accept-invite and company switch`.

### Task 4: Schedule dialogs, replacement panel and schedule page

**Files:**
- Modify: `src/app/features/dashboard/schedule-grid/{repeat-pattern-modal,replacement-panel,schedule-conflict-modal,schedule-grid-add-modal,shift-history-modal,sick-report-modal,time-off-request-modal}.component.{html,css}`, `src/app/features/dashboard/schedule/schedule.component.{html,css}`, `tailwind.css`, `style-guard.json`, xlf
- Test: extend `schedule-grid.component.spec.ts`; create `schedule-grid-add-modal.component.spec.ts`

**Interfaces:**
- Consumes: Task 1 `lz-dialog-frame`, `lz-field`, `lzField`, `lz-alert`, Plan A `lz-status-chip`, `toLzShiftStatus`.

- [ ] **Step 1: Failing tests.** Add-modal spec: renders inside `lz-dialog-frame`, title "Add shift" (existing copy kept), exactly one primary button whose label states the action, Escape closes. Conflict modal: conflict rows show text plus the `warning` icon (never color alone). Add the seven dialog globs, `schedule/` and `replacement-panel` to guard and `@source`; run guard. Expected: FAIL.
- [ ] **Step 2: Migrate** all seven dialogs to `lz-dialog-frame` with actions in `[lzDialogActions]` (cancel = `variant="secondary"`, one primary), fields to `lz-field`, status badges to `lz-status-chip`, the replacement panel to `lz-panel`, and `schedule.component` to `lz-page-header`. Buttons say what happens ("Add shift", "Report sick", "Request time off").
- [ ] **Step 3: Run** specs, guard, development build. Expected: PASS.
- [ ] **Step 4: Commit** `feat(web): migrate schedule dialogs, replacement panel and schedule page`.

### Task 5: Overview, Timesheets, Analytics, Time off approvals, Time off settings

**Files:**
- Modify: `dashboard/overview/**`, `dashboard/shiftsummaries/**`, `dashboard/analytics/**`, `dashboard/time-off-approvals.component.{html,css}`, `dashboard/people-management.component.{html,css}`, `dashboard/pto-config-modal.component.{html,css}`; `tailwind.css`, `style-guard.json`, xlf. Delete `dashboard/time-off-approvals.component.css.bak`.
- Test: create `overview.component.spec.ts`, `time-off-approvals.component.spec.ts`; extend or create `shiftsummaries.component.spec.ts`

**Interfaces:**
- Consumes: Task 1 `lz-table-scroll`, `lzTable`, `lz-panel`, `lz-alert`, `lz-empty-state`, `lz-dialog-frame`; Plan A `lz-summary-strip`, `lz-status-chip`, `lz-page-header`.

- [ ] **Step 1: Failing tests.** Overview renders one `h1` and its KPI row as `lz-summary-strip` (not `mat-card`); Timesheets table lives inside `lz-table-scroll` and shows `lz-empty-state` when the list is empty; time-off rows show status with `lz-status-chip` (text label present); PTO modal uses `lz-dialog-frame`. Register globs; guard FAILS.
- [ ] **Step 2: Migrate.** Replace `mat-card`/Bootstrap cards with `lz-panel`; charts (`ngx-echarts` in Analytics) keep their config, only their container and the colors passed to ECharts switch to token values read from `getComputedStyle(document.documentElement)` for `--lz-link`, `--lz-success`, `--lz-amber`, `--lz-danger`, `--lz-open-border` (no hex in TS or templates).
- [ ] **Step 3: Run** specs, guard, development build. Expected: PASS.
- [ ] **Step 4: Commit** `feat(web): migrate overview, timesheets, analytics, time off approvals and settings`.

### Task 6: Workforce — Crews and Credentials

**Files:** Modify `dashboard/crews/**`, `dashboard/credentials/**`, `tailwind.css`, `style-guard.json`, xlf. Test: create `crews.component.spec.ts`, `credentials.component.spec.ts`.

**Interfaces:** Consumes Task 1 primitives and Plan A components (as Task 5).

- [ ] **Step 1: Failing tests.** Each screen renders one `h1` via `lz-page-header`, one primary button, its list in `lz-table-scroll` (or `lz-panel` cards for crews), `lz-empty-state` when empty, and expiry states in Credentials (expired, expiring, valid) as `lz-status-chip` with text. Register globs; guard FAILS.
- [ ] **Step 2: Migrate** both screens; the crew and credential create/edit forms open in `lz-side-panel` (heading = record name or "Add crew"/"Add credential", `dirty` bound to the form) exactly like People; lists use `paginate` + `lz-pager`. Add to Step 1: no `form` in the DOM until the panel opens; 120 records render 25 rows.
- [ ] **Step 3: Run** specs, guard, build. Expected: PASS.
- [ ] **Step 4: Commit** `feat(web): migrate crews and credentials`.

### Task 7: Job sites A — Locations and Areas

**Files:** Modify `dashboard/locations/**`, `dashboard/areas/**`, `tailwind.css`, `style-guard.json`, xlf. Test: create `locations.component.spec.ts`, `areas.component.spec.ts`.

**Interfaces:** Consumes Task 1 primitives, Plan A components.

- [ ] **Step 1: Failing tests.** Same assertions as Task 6 plus: Locations map/geofence container keeps its explicit height utility (`h-80` or larger) so the map is not collapsed; table inside `lz-table-scroll`. Register globs; guard FAILS.
- [ ] **Step 2: Migrate** both screens; location and area forms open in `lz-side-panel`, lists use `paginate` + `lz-pager`, and each spec asserts no `form` in the DOM until the panel opens (Locations is the largest: 420 template lines — split repeated blocks into `ng-template`s, not new components, to keep TS unchanged).
- [ ] **Step 3: Run** specs, guard, build. Expected: PASS.
- [ ] **Step 4: Commit** `feat(web): migrate locations and areas`.

### Task 8: Job sites B — Cost codes, Tasks, Active sites, Daily reports

**Files:** Modify `dashboard/cost-codes/**`, `dashboard/tasks/**`, `dashboard/active-sites/**`, `dashboard/daily-reports/**`, `tailwind.css`, `style-guard.json`, xlf. Test: create one spec per screen.

**Interfaces:** Consumes Task 1 primitives, Plan A components.

- [ ] **Step 1: Failing tests.** One `h1`, one primary button, tables in `lz-table-scroll` at 360px width (assert `scrollWidth > clientWidth` container, `document.body.scrollWidth <= window.innerWidth`), `lz-empty-state` when empty, Active sites status via `lz-status-chip`. Register globs; guard FAILS.
- [ ] **Step 2: Migrate** the four screens; Cost codes and Tasks forms open in `lz-side-panel` and their lists use `paginate` + `lz-pager` (specs assert no `form` until opened and 25 rows for 120 records); Daily reports weather/hours summary uses `lz-summary-strip`.
- [ ] **Step 3: Run** specs, guard, build. Expected: PASS.
- [ ] **Step 4: Commit** `feat(web): migrate cost codes, tasks, active sites and daily reports`.

### Task 9: Field communication — Bulletins, Safety, Documents

**Files:** Modify `dashboard/bulletins/**`, `dashboard/safety/**`, `dashboard/documents/**`, `tailwind.css`, `style-guard.json`, xlf. Test: one spec per screen.

**Interfaces:** Consumes Task 1 primitives, Plan A components.

- [ ] **Step 1: Failing tests.** One `h1`, one primary button, acknowledgment progress and "required" states as `lz-status-chip` with text, list empty states via `lz-empty-state`, upload dropzone in Documents keyboard-operable (`button` or `tabindex=0` with Enter/Space handler present in markup). Register globs; guard FAILS.
- [ ] **Step 2: Migrate** the three screens: create/edit forms that are inline today open in `lz-side-panel` (bulletin and safety editors that are already full pages or dialogs keep that, using `lz-dialog-frame`/`lz-field`); lists use `paginate` + `lz-pager`.
- [ ] **Step 3: Run** specs, guard, build. Expected: PASS.
- [ ] **Step 4: Commit** `feat(web): migrate bulletins, safety and documents`.

### Task 10: Integrations and account — Procore, Company settings, Billing, Profiles, Clock shift, Companies, Admin

**Files:** Modify `dashboard/procore/**`, `dashboard/company-settings.component.{html,css}`, `dashboard/billing/**`, `dashboard/profiles/**`, `dashboard/clock-shift/**`, `general/manage-companies/**`, `admin/components/**`, `upgrade/**` if it has templates, `tailwind.css`, `style-guard.json`, xlf. Test: one spec per component without one.

**Interfaces:** Consumes Task 1 primitives, Plan A components.

- [ ] **Step 1: Failing tests.** One `h1` each; Company settings (565 template lines) organized as `lz-panel` sections with one primary "Save changes" button at the top-level form; Procore sync state via `lz-status-chip` with text and a visible last-sync line; Billing plan shown in `lz-panel`. Register globs; guard FAILS.
- [ ] **Step 2: Migrate** all listed screens. Company settings: group fields into sections (Company, Time and pay, Notifications, Integrations) with section headings; no field removed.
- [ ] **Step 3: Run** specs, guard, build. Expected: PASS.
- [ ] **Step 4: Commit** `feat(web): migrate procore, company settings, billing, profiles, companies and admin`.

### Task 11: Web kiosk

**Files:** Modify `src/app/features/kiosk/**` templates/styles (kiosk, employee-list, todo-list, todo-detail, photo-schedule, and dialogs: pin, admin-password, location-select, question, audit-history), `tailwind.css`, `style-guard.json`, xlf. Test: extend `kiosk.component.spec.ts`; create `pin-dialog.component.spec.ts`.

**Interfaces:** Consumes Task 1 `lz-dialog-frame`, `lzField`, `lz-alert`; Plan A `lzButton`. Kiosk keeps one-tap flows (CLAUDE.md "Do not add heavy modals or multi-step forms to the Kiosk").

- [ ] **Step 1: Failing tests.** PIN pad keys are `button`s with `min-h-16 min-w-16`; the PIN dialog uses `lz-dialog-frame` with `closable`; wrong-PIN message in `lz-alert` tone `danger` (`role="alert"`); employee list rows ≥ 48px; `analog-clock` untouched. Register globs; guard FAILS.
- [ ] **Step 2: Migrate** with large type and targets (kiosk screens use `text-lg`+ and `min-h-14` on primary actions), tokens only; no extra steps or modals added.
- [ ] **Step 3: Run** specs, guard, build; manually check 768×1024 and 1280×800 (checklist item in Task 13). Expected: PASS.
- [ ] **Step 4: Commit** `feat(web): migrate web kiosk`.

### Task 12: Registration and onboarding

**Files:** Modify `src/app/features/registration/**`, `src/app/features/onboarding/**` templates/styles, `tailwind.css`, `style-guard.json`, xlf. Test: create `registration.component.spec.ts`, `onboarding.component.spec.ts` (use the existing component class names).

**Interfaces:** Consumes Task 1 `lz-auth-shell` (`wide`), `lz-field`, `lz-alert`.

- [ ] **Step 1: Failing tests.** Each wizard renders in `lz-auth-shell`, shows step progress as text ("Step 2 of 4" style, existing copy kept), exactly one primary button per step ("Next"/"Create company"), validation errors via `lz-field` `error`. Register globs; guard FAILS.
- [ ] **Step 2: Migrate** both flows; keep step logic and form controls unchanged.
- [ ] **Step 3: Run** specs, guard, build. Expected: PASS.
- [ ] **Step 4: Commit** `feat(web): migrate registration and onboarding`.

### Task 13: Coverage check, locales, verification doc

**Files:**
- Modify: `scripts/style-guard.mjs` only if a coverage subcommand is needed (see Step 1), `style-guard.json`, `CLAUDE.md` (Angular conventions: "all routed screens use `shared/ui`; new screens must be added to `style-guard.json`"), `docs/superpowers/specs/2026-11-08-angular-design-system-design.md` (roadmap table: rows B–E marked done by this plan)
- Create: `docs/superpowers/specs/2026-11-09-angular-design-system-screens-verification.md`
- Test: `scripts/style-guard.test.mjs`

- [ ] **Step 1: Failing test.** In `style-guard.test.mjs` add `routed screens are all migrated`: a fixture walks `src/app/**/*.html` of routed features and fails for any template that is neither in `migrated` nor in an explicit `exempt` list (`dashboard/schedules/**`, `dashboard/schedule-edit/**`, `dashboard/roles/**`, `**/*.bak`). Run `npm run test:style-guard`. Expected: FAIL until all tasks are merged into the branch.
- [ ] **Step 2:** Add the `exempt` key to `style-guard.json` and make the guard honor it; fix any template still unlisted by migrating it or listing it with a one-line reason.
- [ ] **Step 3: Verify.** Run `npm run lint:styles`, `npm run test:style-guard`, `npx ng test --watch=false --browsers=ChromeHeadless`, `npx ng build --configuration production`, `npx ng build --configuration production --localize` (es-SP). Expected: all exit 0; paste results into the verification doc with the "Pending — William" visual checklist (one line per Task 3–11 screen family, plus kiosk at 768×1024 and 1280×800, and a Spanish pass over auth and Company settings).
- [ ] **Step 4: Commit** `docs(web): verify design system on all screens and update conventions`.
