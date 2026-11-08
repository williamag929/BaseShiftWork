# Angular Design System — Plan A: Foundation, Shell, Schedule, People

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put Loqzen's Angular app on one token-driven design system (Tailwind v4 + Material themed from `--lz-*` tokens), ship the new shell and navigation, and migrate the two flagship screens (Schedule grid, People) to it without breaking unmigrated screens.

**Architecture:** `src/styles/tokens.css` defines every `--lz-*` custom property. `src/styles/tailwind.css` maps them into Tailwind's `@theme`, imports Bootstrap into a `legacy` cascade layer (so utilities win on migrated screens), and is processed by `@tailwindcss/postcss`. `custom-theme.scss` drives Angular Material from the same variables. Standalone components in `src/app/shared/ui/` are the only way migrated screens render buttons, chips, headers, shift blocks and summary strips. A Node guard script fails if a migrated file reintroduces raw colors or Bootstrap classes.

**Tech Stack:** Angular 19.2 (NgModule app, `@angular-builders/custom-webpack:browser`), Angular Material 19 (M3), Tailwind CSS v4 + `@tailwindcss/postcss`, `@fontsource/ibm-plex-sans`, `@fontsource/sora`, Karma + Jasmine, Node 20 `node:test` for the guard script.

**Spec:** `docs/superpowers/specs/2026-11-08-angular-design-system-design.md` (read it first; token values, component contracts, nav structure and copy rules live there and are not repeated here). Mock: https://claude.ai/artifact/Lf9tUr98RyS7kHw4B8ozeK

**Not in this plan:** Schedule modals, other screens, Bootstrap removal, Mobile/Kiosk tokens (spec §9, Plans B–F).

## Global Constraints

- Work on branch `feature/angular-design-system` from `main`. All paths below are relative to `ShiftWork.Angular/` unless they start with the repo root.
- Product copy says **Loqzen**; code identifiers keep `ShiftWork` (CLAUDE.md naming rule).
- Every new user-facing string has an `i18n="@@<feature>.<key>"` id and a Spanish `<target>` in `src/locale/messages.es.xlf`.
- Sentence case for all labels; no ALL-CAPS text (spec §6).
- Interactive targets ≥ 48×48 px; focus ring `2px solid var(--lz-link)`, offset 2px (spec §7, CLAUDE.md principle 3).
- Exactly one `variant="primary"` button per screen (CLAUDE.md principle 1).
- Icons: `<mat-icon>` (Material Symbols names) — no inline SVG, no `bi bi-*`/`fa fa-*` in migrated templates.
- Migrated templates and stylesheets contain no hex/rgb colors, no `box-shadow` literals, no `font-size` literals, no `linear-gradient`/`backdrop-filter`, no Bootstrap classes (`btn`, `btn-*`, `form-control`, `row`, `col-*`, `card`, `d-flex`, `mb-*`, …).
- Tailwind preflight stays **off** in this plan (spec §8).
- Do not change component TypeScript behavior while restyling, except where a task says so.

## Review Focus

1. **Unmigrated screens after the theme swap** — `custom-theme.scss` currently makes Material cards/toolbar/sidenav transparent for the glass effect; removing the glass must leave every `mat-card` on an opaque `--lz-paper` surface. Pinned in Task 2 (`theme.spec.ts`).
2. **Spanish build** — longer labels ("Comunicación en campo", "Publicar 7 turnos") must not overflow the 232px rail or the header actions. Pinned in Task 9 (es-SP build + width check list) and Task 6 (`nav labels never truncate` assertion via `white-space: normal`).
3. **Permission-gated nav** — a user without `active-sites.view` (or any gated item) must never see an empty section heading. Pinned in Task 6 (`visibleSections` spec).
4. **Drag, select and click on shift blocks** — `cdkDrag` on the host must still work, and ticking the selection checkbox must not fire `activate`. Pinned in Task 5 (`lz-shift-block` specs).
5. **4-week horizon and handset width** — 28 day columns must scroll horizontally inside the grid box with the team-member column sticky; on handset the rail becomes an overlay. Pinned in Task 7 (grid spec asserts `overflow-x-auto` container and sticky first column class) and Task 9 manual checklist.

---

### Task 1: Tailwind v4, tokens and fonts in the build

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/tailwind.css`, `.postcssrc.json`
- Modify: `angular.json` (build `styles` at ~line 39 and test `styles` at ~line 125), `package.json`
- Delete: `src/styles.css` (1 empty line, unused)

**Interfaces:**
- Produces: CSS custom properties exactly as named in spec §3 (`--lz-ink`, `--lz-canvas`, …, `--lz-shadow-overlay`, `--lz-font-ui`, `--lz-font-display`, `--lz-radius-chip|control|panel|dialog`). Tailwind utilities derived from them: colors `navy-900 navy-800 navy-700 ink ink-soft ink-muted rail-text rail-label line line-soft line-strong canvas paper paper-alt amber amber-ink draft-border link success success-bg success-ink danger danger-bg danger-ink info-bg info-ink neutral-bg shift-bg shift-border timeoff-bg open-border` (e.g. `bg-canvas`, `text-ink-soft`, `border-line`); fonts `font-ui`, `font-display`; radii `rounded-chip|control|panel|dialog`; shadow `shadow-overlay`; utility `bg-draft-hatch`.

- [ ] **Step 1: Install dependencies**

Run: `npm install -D tailwindcss@^4 @tailwindcss/postcss@^4 postcss && npm install @fontsource/ibm-plex-sans @fontsource/sora`
Expected: exits 0; packages listed in `package.json`.

- [ ] **Step 2: Write `src/styles/tokens.css`**

`:root { … }` with every token and hex from spec §3, plus `--lz-font-ui: 'IBM Plex Sans', system-ui, sans-serif; --lz-font-display: 'Sora', 'IBM Plex Sans', sans-serif;`, radii `4px/6px/8px/12px`, and `--lz-shadow-overlay`. Import fonts at the top: `@import "@fontsource/ibm-plex-sans/400.css";` (also 500, 600) and `@import "@fontsource/sora/600.css";`.

- [ ] **Step 3: Write `src/styles/tailwind.css`**

Order matters — the layer statement must come first so `legacy` is lowest:

```css
@layer legacy, theme, base, components, utilities;
@import "bootstrap/dist/css/bootstrap.min.css" layer(legacy);
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
@import "./tokens.css";

@theme inline {
  --color-ink: var(--lz-ink);
  /* …one --color-* per token listed in Interfaces… */
  --font-ui: var(--lz-font-ui);
  --font-display: var(--lz-font-display);
  --radius-chip: var(--lz-radius-chip);
  --radius-control: var(--lz-radius-control);
  --radius-panel: var(--lz-radius-panel);
  --radius-dialog: var(--lz-radius-dialog);
  --shadow-overlay: var(--lz-shadow-overlay);
}

@utility bg-draft-hatch {
  background: repeating-linear-gradient(135deg, var(--lz-draft-bg-1) 0 6px, var(--lz-draft-bg-2) 6px 12px);
}

@layer base {
  body { font-family: var(--lz-font-ui); color: var(--lz-ink); background: var(--lz-canvas); font-size: 14px; line-height: 1.45; }
  :focus-visible { outline: 2px solid var(--lz-link); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
}
```

Add `@source "../app";` so Tailwind scans templates.

- [ ] **Step 4: Wire the build**

`.postcssrc.json`: `{ "plugins": { "@tailwindcss/postcss": {} } }`. In `angular.json` build and test `styles`: remove `node_modules/bootstrap/dist/css/bootstrap.min.css`, add `src/styles/tailwind.css` immediately after `src/custom-theme.scss`. Keep the other entries in place.

- [ ] **Step 5: Verify Tailwind and the legacy layer reach the bundle**

Run: `npx ng build --configuration development && grep -l "@layer legacy" dist/shift-workfrontend/**/styles*.css && grep -c "\.bg-canvas" dist/shift-workfrontend/**/styles*.css`
Expected: a file path is printed and the count is ≥ 1 once any template uses `bg-canvas` (add `class="bg-canvas"` temporarily to `app.component.html` if needed, then revert).
If `@layer legacy` is missing, the webpack builder skipped `.postcssrc.json`: add a `postcss-loader` rule for `src/styles/tailwind.css` to `custom-webpack.config.ts` and re-run.

- [ ] **Step 6: Run the existing test suite**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: same pass/fail counts as on `main` (record the `main` baseline first).

- [ ] **Step 7: Commit**

```bash
git add ShiftWork.Angular/{package.json,package-lock.json,angular.json,.postcssrc.json,src/styles} && git rm ShiftWork.Angular/src/styles.css
git commit -m "build(web): add Tailwind v4 with --lz tokens; layer Bootstrap as legacy"
```

---

### Task 2: Material theme from tokens; remove the glass layer

**Files:**
- Modify: `src/custom-theme.scss`, `src/styles.scss`
- Test: `src/app/shared/ui/theme.spec.ts`

**Interfaces:**
- Consumes: `--lz-*` from Task 1.
- Produces: Material components render with Plex, `--lz-ink` primary, opaque `--lz-paper` surfaces, overlay shadow on menus/dialogs, 6px control radius.

- [ ] **Step 1: Write the failing test**

`theme.spec.ts` renders a host with `<mat-card>`, `<button mat-flat-button>` and `<mat-toolbar>` (import the Material modules) and asserts on `getComputedStyle`:
- `it('renders mat-card on an opaque paper surface')` → card `backgroundColor` is `rgb(255, 255, 255)` and `backdropFilter` is `none` (or empty).
- `it('uses IBM Plex Sans for Material text')` → button `fontFamily` contains `IBM Plex Sans`.
- `it('uses the ink color for flat primary buttons')` → button `backgroundColor` is `rgb(22, 38, 61)`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx ng test --include src/app/shared/ui/theme.spec.ts --watch=false --browsers=ChromeHeadless`
Expected: FAIL (card background transparent; button violet).

- [ ] **Step 3: Rewrite the theme**

`custom-theme.scss`: keep `mat.define-theme` (M3, light, density 0) with typography `brand-family`/`plain-family` set to `var(--lz-font-ui)`'s stack; then, inside `html { }`, override system tokens with `mat.theme-overrides` / `--mat-sys-*` so that primary = `var(--lz-ink)`, on-primary = `var(--lz-paper)`, surface/surface-container* = `var(--lz-paper)`, outline = `var(--lz-line-strong)`, outline-variant = `var(--lz-line)`, error = `var(--lz-danger)`, corner-small = `var(--lz-radius-control)`, corner-medium = `var(--lz-radius-panel)`, corner-large = `var(--lz-radius-dialog)`. Delete the whole "RGBA surface token overrides" block. Set menu/dialog/tooltip container shadows to `var(--lz-shadow-overlay)`.
`styles.scss`: delete the body gradient, the `:root` glass tokens, the `glass-surface` mixin and every rule that includes it; keep `html, body { height: 100%; margin: 0; }` and `-webkit-font-smoothing: antialiased`.

- [ ] **Step 4: Run the test to verify it passes**

Run: same as Step 2. Expected: 3 specs PASS.

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Angular/src/custom-theme.scss ShiftWork.Angular/src/styles.scss ShiftWork.Angular/src/app/shared/ui/theme.spec.ts
git commit -m "style(web): drive Material theme from --lz tokens and remove glass surfaces"
```

---

### Task 3: Style guard for migrated files

**Files:**
- Create: `scripts/style-guard.mjs`, `scripts/style-guard.test.mjs`, `style-guard.json`
- Modify: `package.json` (scripts `lint:styles`, `test:style-guard`)

**Interfaces:**
- Produces: `export function findViolations(path: string, content: string): Violation[]` where `Violation = { path: string; line: number; rule: 'raw-color' | 'raw-shadow' | 'raw-font-size' | 'gradient' | 'backdrop' | 'bootstrap-class' | 'legacy-icon'; text: string }`. CLI: `node scripts/style-guard.mjs` reads `style-guard.json` (`{ "migrated": string[] }`, globs relative to `ShiftWork.Angular/`), prints violations as `path:line rule text`, exits 1 if any. Later tasks add their files to `migrated`.

- [ ] **Step 1: Write the failing tests** (`node:test` + `assert`)

- `flags hex colors in css` → `findViolations('a.css', 'color: #667eea;')` has one `raw-color` at line 1.
- `flags rgb/rgba but not var()` → `'background: rgba(0,0,0,.1)'` flagged; `'color: var(--lz-ink)'` not flagged.
- `flags literal font-size and box-shadow in css` → `font-size: 13px` → `raw-font-size`; `box-shadow: 0 1px 2px x` → `raw-shadow`.
- `flags gradients and backdrop-filter` → both rules.
- `flags bootstrap classes in html class attributes` → `<div class="row mb-3">` → `bootstrap-class`; `<div class="flex gap-4">` → none; `<span class="rowdy">` → none.
- `flags legacy icon fonts` → `<i class="bi bi-trash">` and `<i class="fa fa-user">` → `legacy-icon`.
- `ignores Tailwind arbitrary color classes only when they use var()` → `class="bg-[#fff]"` flagged as `raw-color`; `class="bg-[var(--lz-paper)]"` not flagged.
- `allows the draft hatch utility` → `class="bg-draft-hatch"` → none.

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test scripts/style-guard.test.mjs` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `scripts/style-guard.mjs`**

Regex per rule, line-based. Bootstrap class list: `btn`, `btn-[a-z-]+`, `form-control`, `form-select`, `form-group`, `form-label`, `row`, `col`, `col-[a-z0-9-]+`, `card`, `card-[a-z]+`, `d-[a-z-]+`, `m[trblxy]?-[0-5]`, `p[trblxy]?-[0-5]`, `text-(muted|center|end|start)`, `badge`, `table`, `table-[a-z]+`, `container(-fluid)?`, `justify-content-[a-z]+`, `align-items-[a-z]+`. Match whole class tokens inside `class="…"` only. Start `style-guard.json` with `{ "migrated": [] }`.

- [ ] **Step 4: Run tests and CLI**

Run: `node --test scripts/style-guard.test.mjs && npm run lint:styles`
Expected: all tests PASS; CLI exits 0 with "0 violations in 0 files".

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Angular/scripts ShiftWork.Angular/style-guard.json ShiftWork.Angular/package.json
git commit -m "chore(web): add style guard that blocks raw colors and Bootstrap in migrated files"
```

---

### Task 4: `lzButton` directive and `lz-status-chip`

**Files:**
- Create: `src/app/shared/ui/button/lz-button.directive.ts` (+ `.spec.ts`), `src/app/shared/ui/status-chip/lz-status-chip.component.ts` (+ `.spec.ts`), `src/app/shared/ui/index.ts`
- Modify: `src/app/shared/shared.module.ts` (import and export the standalone pieces so NgModule screens get them)

**Interfaces:**
- Produces:
  - `LzButtonDirective` — selector `button[lzButton], a[lzButton]`, standalone. Input `variant: LzButtonVariant = 'secondary'` (`'primary' | 'secondary' | 'quiet' | 'danger'`); input `iconOnly = false` (square `w-12`, requires an `aria-label`). No size input: every button is 48px tall (Global Constraints). Applies classes with `HostBinding` on individual class keys so author classes survive. Base: `min-h-12 px-4 gap-2 rounded-control font-medium inline-flex items-center justify-center`. Disabled (`disabled` attr or `aria-disabled="true"`): `bg-neutral-bg text-ink-soft border-neutral-bg cursor-not-allowed`.
  - `LzStatusChipComponent` — selector `lz-status-chip`, standalone. Inputs `tone: LzTone = 'neutral'` (`'success' | 'neutral' | 'warning' | 'danger' | 'info'`), `dot = false`. Renders `<span>` with `rounded-chip px-2 py-0.5 text-[13px] font-medium` and tone pair: success → `bg-success-bg text-success-ink`, neutral → `bg-neutral-bg text-ink-muted`, warning → `bg-[var(--lz-draft-bg-1)] text-amber-ink`, danger → `bg-danger-bg text-danger-ink`, info → `bg-info-bg text-info-ink`; dot is an 8px circle in the tone's strong color, `aria-hidden="true"`.
  - `src/app/shared/ui/index.ts` re-exports all ui pieces and types (`LzButtonVariant`, `LzTone`, …).

- [ ] **Step 1: Write the failing tests**

`lz-button.directive.spec.ts`:
- `defaults to secondary md` → host has `border-line-strong`, `bg-paper`, `min-h-12`.
- `primary uses ink background and paper text` → `bg-ink`, `text-paper`.
- `danger uses danger background` → `bg-danger`.
- `keeps author classes` → `<button lzButton class="w-full">` still has `w-full`.
- `disabled state uses neutral colors` → with `[disabled]="true"` has `bg-neutral-bg`, `cursor-not-allowed`.
- `works on anchors` → `<a lzButton variant="quiet" href="#">` has `text-link`.
- `icon-only buttons are 48px squares` → `iconOnly` adds `w-12` and `px-0`.

`lz-status-chip.component.spec.ts`:
- `renders projected text` → "On shift".
- `success tone classes` → `bg-success-bg text-success-ink`.
- `dot is hidden from assistive tech` → `[aria-hidden="true"]` exists when `dot` is true, absent when false.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx ng test --include 'src/app/shared/ui/**/*.spec.ts' --watch=false --browsers=ChromeHeadless`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement both, export from `index.ts`, add to `SharedModule` imports/exports**

- [ ] **Step 4: Run the tests to verify they pass** — same command; Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Angular/src/app/shared
git commit -m "feat(web-ui): add lzButton directive and lz-status-chip"
```

---

### Task 5: `lz-page-header`, `lz-shift-block`, `lz-summary-strip`

**Files:**
- Create: `src/app/shared/ui/page-header/lz-page-header.component.ts`, `src/app/shared/ui/shift-block/lz-shift-block.component.ts`, `src/app/shared/ui/shift-block/shift-status.ts`, `src/app/shared/ui/summary-strip/lz-summary-strip.component.ts` (each with `.spec.ts`)
- Modify: `src/app/shared/ui/index.ts`, `src/app/shared/shared.module.ts`

**Interfaces:**
- Consumes: `LzButtonDirective`, `LzTone` (Task 4); `ShiftBlock` from `src/app/core/models/schedule-grid.model.ts`.
- Produces:
  - `LzPageHeaderComponent` — `lz-page-header`; inputs `title: string` (required), `subtitle?: string`. Template: `<h1 class="font-display text-[26px] font-semibold leading-tight">`, subtitle `text-ink-soft`, `<ng-content select="[lzHeaderMeta]">` under the title, `<ng-content select="[lzHeaderActions]">` right-aligned; container `flex flex-wrap items-end justify-between gap-4`.
  - `type LzShiftStatus = 'published' | 'draft' | 'open' | 'conflict' | 'timeOff' | 'locked' | 'void'`.
  - `function toLzShiftStatus(shift: Pick<ShiftBlock, 'status' | 'isLocked'>): LzShiftStatus` in `shift-status.ts`: `isLocked` or `'locked'` → `'locked'`; `'unpublished'` → `'draft'`; `'published'` → `'published'`; `'open'` → `'open'`; `'void'` → `'void'`.
  - `LzShiftBlockComponent` — `lz-shift-block`; inputs `status: LzShiftStatus`, `time: string`, `detail = ''`, `selectable = false`, `selected = false`, `clock: 'none' | 'onShift' | 'late' = 'none'`; outputs `activate: EventEmitter<void>`, `selectedChange: EventEmitter<boolean>`. Host stays a plain element so the caller can put `cdkDrag` on it. Inside: a main `<button type="button">` (min-h-12, rounded-control, full width) and, when `selectable`, a sibling `<input type="checkbox">` positioned top-right that calls `stopPropagation()` and emits `selectedChange`. Status styling: published `bg-shift-bg border border-shift-border`; draft `bg-draft-hatch border border-dashed border-draft-border text-amber-ink`; open `bg-paper border-[1.5px] border-dashed border-open-border`; conflict `bg-paper border-[1.5px] border-danger` + `warning` mat-icon; timeOff `bg-timeoff-bg` (rendered as non-button `<div>`); locked = published + `lock` mat-icon; void `bg-neutral-bg text-ink-soft line-through`. Selected adds `ring-2 ring-link`. Clock indicator: `schedule` mat-icon, success color for onShift, danger color for late. Button `aria-label` = `"{statusLabel}, {time}{detail ? ', ' + detail : ''}"` with status labels (i18n ids `@@ui.shift_status.<status>`): Published, Draft, Open, Conflict, Time off, Locked, Void.
  - `interface LzSummaryItem { id: string; count: number; label: string; tone: 'draft' | 'open' | 'danger' | 'neutral' | 'timeOff'; }` and `LzSummaryStripComponent` — `lz-summary-strip`; input `items: LzSummaryItem[]`, output `itemSelect: EventEmitter<string>`; renders one `<button>` per item (min-h-12, divider `border-r border-line-soft`) with a 18px swatch matching the shift-block style of its tone, bold tabular count, label; trailing `<ng-content>` slot for extra content (budget bar later).

- [ ] **Step 1: Write the failing tests**

`shift-status.spec.ts`: one `it` per mapping row above, including `{ status: 'published', isLocked: true }` → `'locked'`.
`lz-shift-block.component.spec.ts`:
- `emits activate when the block is clicked`.
- `does not emit activate when the selection checkbox is clicked` → click checkbox; `activate` spy not called; `selectedChange` called with `true`.
- `aria-label names the status` → draft block with time `7:00a–3:30p`, detail `L3 framing` → `aria-label` equals `Draft, 7:00a–3:30p, L3 framing`.
- `draft uses the hatch` → button has `bg-draft-hatch`.
- `time off is not a button` → no `button` element rendered.
- `host accepts cdkDrag` → render inside a `cdkDropList` host with `<lz-shift-block cdkDrag>`; `CdkDrag` instance is found on the host debug element.
`lz-page-header.component.spec.ts`: `renders title as h1`, `projects actions into the right slot`.
`lz-summary-strip.component.spec.ts`: `renders one button per item with its count`, `emits the item id on click`.

- [ ] **Step 2: Run them to verify they fail** — `npx ng test --include 'src/app/shared/ui/**/*.spec.ts' --watch=false --browsers=ChromeHeadless`; Expected: FAIL.

- [ ] **Step 3: Implement the three components and `toLzShiftStatus`; add i18n units and Spanish targets** (Publicado, Borrador, Abierto, Conflicto, Tiempo libre, Bloqueado, Anulado).

- [ ] **Step 4: Run the tests to verify they pass** — same command; Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Angular/src/app/shared ShiftWork.Angular/src/locale
git commit -m "feat(web-ui): add page header, shift block and summary strip"
```

---

### Task 6: Shell and five-section navigation

**Files:**
- Create: `src/app/features/dashboard/nav/nav.config.ts` (+ `nav.config.spec.ts`)
- Modify: `src/app/features/dashboard/dashboard.component.{html,ts,css}`, `src/app/features/dashboard/dashboard.module.ts` (import `SharedModule` ui pieces if not already), `src/locale/messages.es.xlf`, repo-root `CLAUDE.md` (Angular "Sidebar sections" line)
- Test: `src/app/features/dashboard/dashboard.component.spec.ts` (create)

**Interfaces:**
- Consumes: `PermissionService.hasPermission(key)`, `ProcoreService.getConnection(companyId)` → `ProcoreConnection | null`, existing `activeCompany$`, `user$`, `isHandset$`, `tourService`, `logout()`.
- Produces:
  - `interface NavItem { id: string; label: string; i18nId: string; icon: string; route: string; exact?: boolean; permission?: string; badge?: 'pendingTimeOff'; }`
  - `interface NavSection { id: 'scheduling' | 'workforce' | 'jobSites' | 'fieldComms' | 'integrations'; label: string; i18nId: string; items: NavItem[]; }`
  - `const NAV_SECTIONS: NavSection[]` — sections and items exactly as spec §5, routes from `dashboard-routing.module.ts` (Overview `/dashboard` exact, Schedule `/dashboard/schedule-grid`, Timesheets `/dashboard/shiftsummaries`, Time off `/dashboard/time-off-approvals`, People `/dashboard/people`, Crews `/dashboard/crews`, Credentials `/dashboard/credentials` permission `credentials.track`, Roles & access `/dashboard/people-management`, Locations, Areas, Cost codes, Tasks, Active sites permission `active-sites.view`, Daily reports, Bulletins, Safety, Documents, Procore `/dashboard/procore`, Kiosks `/kiosk`).
  - `function visibleSections(sections: NavSection[], can: (key: string) => boolean): NavSection[]` — drops items whose `permission` fails, then drops sections with no items.
  - `function procoreSyncLabel(conn: ProcoreConnection | null, now: Date): { tone: 'success' | 'danger'; text: string } | null` — `null` when no connection or `!enabled`; danger "Procore sync failed" when `lastSyncStatus` (case-insensitive) is `failed` or `error`; success "Synced with Procore {n} min ago" / "{n} h ago" / "today"/"on {MMM d}" from `lastSyncAt`; success "Procore connected" when `lastSyncAt` is absent.

- [ ] **Step 1: Write the failing tests**

`nav.config.spec.ts`:
- `has five sections in spec order` → ids `['scheduling','workforce','jobSites','fieldComms','integrations']`.
- `every item route exists in the dashboard routes or is /kiosk` → compare against an explicit array of the paths listed above.
- `hides gated items without permission` → `visibleSections(NAV_SECTIONS, k => k !== 'active-sites.view')` has no item with id `activeSites`.
- `drops a section that ends up empty` → craft a one-section input whose only item is gated → result `[]`.
- `procoreSyncLabel returns null when disabled`, `…danger when last sync failed`, `…"Synced with Procore 4 min ago"` for `lastSyncAt` = now − 4 min.

`dashboard.component.spec.ts` (with mocked store/services):
- `renders one nav heading per visible section`.
- `marks the active item with aria-current="page"`.
- `shows the Procore chip only when a connection is enabled`.
- `nav labels never truncate` → every nav item label element has `whitespace-normal` and none has `truncate`/`text-ellipsis`.

- [ ] **Step 2: Run them to verify they fail** — `npx ng test --include 'src/app/features/dashboard/{nav/**,dashboard.component}.spec.ts' --watch=false --browsers=ChromeHeadless`; Expected: FAIL.

- [ ] **Step 3: Implement `nav.config.ts` and rebuild the shell template**

Keep `mat-sidenav-container` / `mat-sidenav` (mode `over` on handset, `side` otherwise) for behavior; style with utilities per mock board 1: rail `bg-navy-900 w-[232px]`, group labels `text-rail-label text-xs` sentence case, items `min-h-12 rounded-control text-rail-text`, active `bg-navy-700 text-paper` with amber icon, labels wrap (`whitespace-normal`). Add a collapse toggle that switches to a 64px icon rail (state in a component field persisted to `localStorage` key `lz.nav.collapsed`, wrapped in try/catch). Top bar `h-[60px] bg-paper border-b border-line`: company name (existing switcher link), Procore chip (`lz-status-chip` with `procoreSyncLabel`, fetched once per active company), help button (existing tour), account `mat-menu` containing My profile, Company settings, Billing, Company users (existing permission check), Help, Log out. Remove the per-screen glass/purple rules from `dashboard.component.css`; leave only layout that utilities cannot express. Time-off badge: if no pending-count source exists in the store today, render no badge and leave `badge` unused (do not add an API call in this plan).
Update CLAUDE.md's "Sidebar sections" line to: `Scheduling → Workforce → Job sites → Field communication → Integrations (defined in features/dashboard/nav/nav.config.ts)`.

- [ ] **Step 4: Add i18n ids `@@nav.section.<id>` and `@@nav.item.<id>` with Spanish targets** (Programación, Personal, Obras, Comunicación en campo, Integraciones; items translated accordingly).

- [ ] **Step 5: Run the tests to verify they pass** — same command; Expected: PASS. Then add `src/app/features/dashboard/dashboard.component.*` and `src/app/features/dashboard/nav/**` to `style-guard.json` and run `npm run lint:styles` — Expected: 0 violations.

- [ ] **Step 6: Commit**

```bash
git add ShiftWork.Angular/src/app/features/dashboard ShiftWork.Angular/src/locale ShiftWork.Angular/style-guard.json CLAUDE.md
git commit -m "feat(web): new Loqzen shell with five-section navigation and Procore sync status"
```

---

### Task 7: Migrate the Schedule grid screen (main view only)

**Files:**
- Modify: `src/app/features/dashboard/schedule-grid/schedule-grid.component.{html,css,ts}`, `src/locale/messages.es.xlf`
- Test: `src/app/features/dashboard/schedule-grid/schedule-grid.component.spec.ts` (create)

**Interfaces:**
- Consumes: `LzPageHeaderComponent`, `LzButtonDirective`, `LzShiftBlockComponent`, `toLzShiftStatus`, `LzSummaryStripComponent`/`LzSummaryItem` (Tasks 4–5). Existing component members: `gridData.stats.*`, `onPreviousPeriod()`, `onNextPeriod()`, `onHorizonChange()`, `horizonRange`, `selectedLocationId`, `locations`, `onLocationChange()`, `openAddScheduleModal()`, `onPublishAllShifts()`, `onShiftClick()`, `toggleShiftSelection()`, `isShiftSelected()`, `isShiftLate()`, `getShiftClockTooltip()`, drag handlers.
- Produces: `get summaryItems(): LzSummaryItem[]` on the component: drafts (`stats.unpublished`, tone `draft`), open shifts (`stats.openShifts`, `open`), warnings (`stats.warnings`, `danger`), time off pending (`stats.leavePending`, `timeOff`), unavailable (`stats.unavailable`, `neutral`); items with count 0 are omitted.
- Removes: `getShiftColor()` (replaced by `toLzShiftStatus`) and its template usages.

- [ ] **Step 1: Write the failing tests** (TestBed with the component's real module and mocked services)

- `header has exactly one primary button and it publishes` → `button[variant="primary"]` count 1; with `stats.unpublished = 7` its text is "Publish 7 shifts" and clicking calls `onPublishAllShifts`.
- `primary button is disabled with "All shifts published" when nothing is unpublished`.
- `summaryItems omits zero counts`.
- `renders lz-shift-block with mapped status` → a shift with `status: 'unpublished'` renders `lz-shift-block` whose button `aria-label` starts with "Draft".
- `grid scrolls horizontally with a sticky team column` → grid wrapper has `overflow-x-auto`; first column cells have `sticky` and `left-0`.
- `location picker stays in the header meta slot` → the existing `select` bound to `selectedLocationId` is inside `[lzHeaderMeta]`.

- [ ] **Step 2: Run them to verify they fail** — `npx ng test --include src/app/features/dashboard/schedule-grid/schedule-grid.component.spec.ts --watch=false --browsers=ChromeHeadless`; Expected: FAIL.

- [ ] **Step 3: Rewrite the main template (lines 1–447 today; modal hosts below stay unchanged)**

Follow mock board 1: `lz-page-header` title "Schedule"; meta slot = location select + prev/next period buttons + period label + horizon segmented control (1W/2W/3W/4W keep their `aria-label`s, e.g. "1 week"); actions = only actions that exist today (the mock's "Copy last week" waits for a backend endpoint): secondary "Add shift" (`openAddScheduleModal`), quiet icon buttons Refresh/More (Share is removed: it has no handler), primary "Publish {n} shifts". Then `lz-summary-strip`, the existing search/filter bar restyled with utilities, the bulk-actions toolbar restyled with `lzButton` (secondary/quiet), and the grid in `div.overflow-x-auto.bg-paper.border.border-line.rounded-panel` with a CSS-grid or table layout whose first column is `sticky left-0 bg-paper z-[1]`, day headers `bg-paper-alt` (weekend `bg-canvas`), day totals tabular. Each shift renders `<lz-shift-block cdkDrag …>` with `[status]="toLzShiftStatus(shift)"`, `[time]="shift.startTime + '–' + shift.endTime"`, `[detail]="shift.areaName || shift.locationName"`, `selectable`, `[selected]="isShiftSelected(shift)"`, `[clock]`, `(activate)="onShiftClick(shift)"`, `(selectedChange)="toggleShiftSelection(shift, $event)"` — adjust `toggleShiftSelection`'s signature only if it requires a DOM event today. Empty cells: `lzButton variant="quiet" iconOnly` with mat-icon `add` with `aria-label` "Add shift for {name} on {day}". Replace "LOCKED"/"VOID" with sentence-case labels via the shift-block status.

- [ ] **Step 4: Reduce `schedule-grid.component.css` to layout-only rules** (grid template columns, drag preview sizing). Delete everything else.

- [ ] **Step 5: Run the tests** — same command; Expected: PASS. Run the full suite — Expected: no new failures vs. Task 1 baseline.

- [ ] **Step 6: Guard and commit**

Add `src/app/features/dashboard/schedule-grid/schedule-grid.component.*` to `style-guard.json`; run `npm run lint:styles` — Expected: 0 violations.

```bash
git add ShiftWork.Angular/src/app/features/dashboard/schedule-grid ShiftWork.Angular/src/locale ShiftWork.Angular/style-guard.json
git commit -m "feat(web): migrate Schedule grid to the Loqzen design system"
```

---

### Task 8: Migrate the People screen

**Files:**
- Modify: `src/app/features/dashboard/people/people.component.{html,css}`, `src/locale/messages.es.xlf`
- Test: `src/app/features/dashboard/people/people.component.spec.ts` (create)

**Interfaces:**
- Consumes: `LzPageHeaderComponent`, `LzButtonDirective`, `LzStatusChipComponent` (Tasks 4–5); existing `PeopleComponent` members (read the component first; keep its data flow, filters and handlers).

- [ ] **Step 1: Write the failing tests**

- `uses lz-page-header titled People with one primary action` → primary button text "Invite people" (bound to the component's existing add/invite handler).
- `status column uses lz-status-chip` → a person with status OnShift renders a chip with `bg-success-bg` and text "On shift"; OffShift renders neutral "Off shift".
- `table header cells are th with scope="col"`.
- `row action button has an accessible name` → `aria-label` "More actions for {full name}".

- [ ] **Step 2: Run them to verify they fail** — `npx ng test --include src/app/features/dashboard/people/people.component.spec.ts --watch=false --browsers=ChromeHeadless`; Expected: FAIL.

- [ ] **Step 3: Rewrite the template per mock board 2** (tabs Active/Invited/Archived only if the component already distinguishes them; otherwise a status filter), filter row, table in `bg-paper border border-line rounded-panel overflow-x-auto`, header `bg-paper-alt text-ink-soft text-[13px]`, rows `border-b border-line-soft`, tabular hours, paginator (existing `mat-paginator` if used). Reduce `people.component.css` to layout-only.

- [ ] **Step 4: Run tests, guard, commit**

Run the spec (PASS), add `src/app/features/dashboard/people/people.component.*` to `style-guard.json`, run `npm run lint:styles` (0 violations).

```bash
git add ShiftWork.Angular/src/app/features/dashboard/people ShiftWork.Angular/src/locale ShiftWork.Angular/style-guard.json
git commit -m "feat(web): migrate People screen to the Loqzen design system"
```

---

### Task 9: Verify both locales, unmigrated screens and handset layout

**Files:**
- Create: `docs/superpowers/specs/2026-11-08-angular-design-system-verification.md` (repo root; pass/fail checklist; screenshots go in the PR description, not the repo)

- [ ] **Step 1: Builds**

Run: `npx ng build --configuration production && npx ng build --configuration es-SP`
Expected: both exit 0; no new budget warnings above `main`'s.

- [ ] **Step 2: Tests and guard**

Run: `npx ng test --watch=false --browsers=ChromeHeadless && node --test scripts/style-guard.test.mjs && npm run lint:styles`
Expected: no failures beyond the Task 1 baseline; guard 0 violations.

- [ ] **Step 3: Manual check with `npm run start` (EN) and the es-SP build served from `dist`**

Record pass/fail for each in the verification file:
- Schedule and People match mock boards 1 and 2 at 1440px; Schedule at 1280px and 390px (rail is an overlay, grid scrolls, team column sticky).
- Schedule with horizon 4W: 28 columns scroll; header stays readable.
- Spanish: rail labels wrap without truncation; "Publicar N turnos" fits; summary strip wraps.
- Keyboard: Tab reaches every nav item, header action, summary button and shift block; focus ring visible on navy and white.
- Unmigrated screens (Overview, Locations, Bulletins, Safety, Company settings, sign-in): render on opaque surfaces, no layout breakage from the theme change or from Bootstrap moving to the `legacy` layer.
- Drag a shift to another day; tick a shift checkbox (no edit dialog opens); open a shift (edit dialog opens).

- [ ] **Step 4: Commit the verification notes and open the PR**

```bash
git add docs/superpowers/specs/2026-11-08-angular-design-system-verification.md
git commit -m "docs: record design system Plan A verification"
```
