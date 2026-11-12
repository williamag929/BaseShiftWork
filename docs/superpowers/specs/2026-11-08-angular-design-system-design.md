# Loqzen Web — Design System & Visual Redesign (Angular)

**Status:** Approved by William, 2026-11-08
**Surface:** `ShiftWork.Angular` (Mobile and Kiosk later, see §9)
**Mock:** https://claude.ai/artifact/Lf9tUr98RyS7kHw4B8ozeK (boards: Schedule, People, Foundations)

## 1. Why

Primary go-to-market is Procore customers (GCs and subcontractors). Their superintendents, PMs and payroll admins live in Procore all day: light, dense, neutral tables with one strong action color. Loqzen's web app today reads as a different product from both Procore and loqzen.com.

Audit of `ShiftWork.Angular/src` (2026-11-08):

| Measure | Value |
|---|---|
| Component stylesheets | 67 files, ~18,000 lines |
| Distinct hex colors | 269 (`#667eea` used 230×, `#764ba2` 89×) |
| Distinct `font-size` values | 70 |
| Distinct `box-shadow` values | 96 |
| CSS custom properties used inside components | 0 |
| UI libraries loaded | Bootstrap 5.2 CSS, ng-bootstrap, Angular Material 19, font-awesome, bootstrap-icons, material-design-icons |
| Button class variants | ~30 (`btn-submit`, `cta-btn`, `action-btn`, `btn-primary`, …) |
| Brand | violet gradient + glassmorphism (`styles.scss`, `custom-theme.scss`); website uses navy + amber, Inter/Sora |
| Sidebar | 8 sections incl. "Main Menu", "More Options" |

## 2. Decisions (approved)

1. **Visual direction:** loqzen.com palette (navy + amber), no gradients, no glass/backdrop-filter. Light, dense, Procore-adjacent without copying Procore.
2. **Styling stack:** Tailwind CSS v4 + Angular Material (only for complex widgets: select, datepicker, dialog, menu, tooltip, snackbar, paginator). Remove Bootstrap CSS, ng-bootstrap, font-awesome and bootstrap-icons by the end of the program.
3. **Single source of truth:** CSS custom properties `--lz-*` in `src/styles/tokens.css`. Tailwind `@theme` and the Material theme both read them. No component defines its own color, font size, radius or shadow.
4. **Shared components** in `src/app/shared/ui/` (standalone). Per-screen CSS is allowed only for layout that utilities cannot express, and never contains raw colors.
5. **Navigation:** 5 sections — Scheduling, Workforce, Job sites, Field communication, Integrations — plus Settings/Billing/Admin in the account menu.

## 3. Tokens

### Color
| Token | Hex | Use |
|---|---|---|
| `--lz-navy-900` | `#0F1B2D` | side rail |
| `--lz-navy-800` | `#16263D` | rail raised items, company switcher |
| `--lz-navy-700` | `#1F3352` | rail active item |
| `--lz-ink` | `#16263D` | body text, primary button |
| `--lz-ink-soft` | `#51637E` | secondary text, column headers |
| `--lz-ink-muted` | `#3E4F68` | tertiary text on tints |
| `--lz-rail-text` | `#C9D3E0` | rail item text |
| `--lz-rail-label` | `#8FA0B8` | rail group labels |
| `--lz-line` | `#DDE3EC` | borders |
| `--lz-line-soft` | `#E8EDF3` | row dividers |
| `--lz-line-strong` | `#C3CDDA` | secondary button / input border |
| `--lz-canvas` | `#F4F6F9` | page background |
| `--lz-paper` | `#FFFFFF` | surfaces |
| `--lz-paper-alt` | `#F8FAFC` | table header |
| `--lz-amber` | `#F5A524` | brand mark, attention badges |
| `--lz-amber-ink` | `#7A4300` | text on amber tints |
| `--lz-draft-bg-1` / `-2` | `#FFF4E0` / `#FDE6BA` | draft hatch |
| `--lz-draft-border` | `#D08A16` | draft dashed border |
| `--lz-link` | `#2F6BD8` | links, focus ring |
| `--lz-success` / `-bg` / `-ink` | `#1E8A5A` / `#E3F4EC` / `#14653F` | on shift, approved, synced |
| `--lz-danger` / `-bg` / `-ink` | `#C2412D` / `#FBE9E6` / `#A3321F` | conflict, void, errors |
| `--lz-info-bg` / `-ink` | `#E7EFFC` / `#1F4FA8` | invited, informational |
| `--lz-neutral-bg` | `#EEF1F5` | off shift, disabled |
| `--lz-shift-bg` / `-border` | `#EAF0F8` / `#C9D6E8` | published shift block |
| `--lz-timeoff-bg` | `#E6EAF0` | time off block |
| `--lz-open-border` | `#5F7290` | open shift dashed border |

### Type
- Display: **Sora** 600 — page titles (26px / 1.2), panel titles (18px), sub-section headings and card titles (15px), KPI values (26px).
- Eyebrow (`lz-eyebrow` utility): 12px / 600 / letter-spacing .12em, rendered uppercase by CSS above page and panel titles; the i18n source stays sentence case. Table column headers use the same treatment at .06em.
- UI: **IBM Plex Sans** 400/500/600. Scale: 18 (section), 15 (label strong), 14 (body), 13 (secondary/column header), 12 (caption/shift detail).
- Numbers in tables and times: `font-variant-numeric: tabular-nums`.
- Fonts self-hosted via `@fontsource` (PWA/service worker; no third-party request).

### Spacing, radius, elevation
- Spacing scale: 4, 8, 12, 16, 24, 32 (Tailwind default 4px grid).
- Radius: pill (999px) chips and badges, 8 controls, list rows and icon tiles, 12 panels, cards and dialogs. *(Amended 2026-11-11 from 4/6/8/12 after William's review: the reference Overview and Procore screens used 10–16px cards and pill badges.)*
- Elevation: page surfaces (page header, panels, table cards, KPI cards, empty states on the canvas) use a 1px `--lz-line` border plus `--lz-shadow-card: 0 1px 2px rgba(15,27,45,.04), 0 6px 16px rgba(15,27,45,.05)`; nested surfaces drop the shadow. Overlays (menus, dialogs, tooltips, side panels) get `--lz-shadow-overlay: 0 8px 24px rgba(15,27,45,.16), 0 1px 3px rgba(15,27,45,.10)`. *(Amended 2026-11-11: border-only surfaces read flat next to the reference screens.)*
- Gradients: none, except `--lz-hero-bg` (navy with a soft blue glow) used only by the Overview command band (`lz-page-header variant="hero"`).

## 4. Components (`src/app/shared/ui/`)

| Component | Selector | Contract |
|---|---|---|
| Button | `button[lzButton]`, `a[lzButton]` | `variant: 'primary' \| 'secondary' \| 'quiet' \| 'danger'` (default `secondary`), `iconOnly?: boolean`. Always 48px tall (no small size). |
| Status chip | `lz-status-chip` | `tone: 'success' \| 'neutral' \| 'warning' \| 'danger' \| 'info'`, `dot: boolean`, content projected |
| Page header | `lz-page-header` | `title` (required), `subtitle?`; slots `[lzHeaderMeta]` (below title) and `[lzHeaderActions]` (right) |
| Shift block | `lz-shift-block` | `status: 'published' \| 'draft' \| 'open' \| 'conflict' \| 'timeOff' \| 'locked' \| 'void'`, `time`, `detail`, output `activate`. Renders a `<button>`; aria-label includes the status word. |
| Summary strip | `lz-summary-strip` | `items: LzSummaryItem[]`, output `itemSelect(id)` |
| Page header (amended) | `lz-page-header` | also `eyebrow?`, `icon?`, `variant: 'card' \| 'hero'`. Default is a raised paper card with a navy/amber icon tile; eyebrow and icon default to the rail section and item via `LZ_PAGE_CONTEXT`, provided by the dashboard shell from `pageContextFor(url)` in `nav.config.ts` |
| Panel (amended) | `lz-panel` | also `eyebrow?`, `icon?` (link-colored icon before the 18px title) |
| Icon tile | `lz-icon-tile` | `icon`, `tone: 'brand' \| 'info' \| 'success' \| 'warning' \| 'danger' \| 'neutral' \| 'inverse'`, `size: 'sm' \| 'md' \| 'lg'` (32/40/48px); decorative (`aria-hidden`) |
| KPI card | `lz-kpi-card` | `icon`, `value`, `label`, `description?`, `trend?`, `trendTone: 'positive' \| 'negative' \| 'neutral'`, `trendIcon?`, `trendSrText?`; the trend pill always carries an icon |

Material components are themed from tokens; no Material class is overridden per screen.

## 5. Layout & navigation

- Shell: dark rail (232px, collapsible to 64px icon rail; overlay on handset), white top bar 60px (company switcher, global search placeholder, Procore sync status, help, account), content on `--lz-canvas` with 24px/32px padding.
- Procore sync status chip shows only when the company has an enabled Procore connection: "Synced with Procore {relative time}" (success tone) or "Procore sync failed" (danger tone) from `ProcoreConnection.lastSyncAt` / `lastSyncStatus`.
- Every screen: `lz-page-header` with exactly one `primary` button (CLAUDE.md principle 1).
- Nav sections and items:
  - **Scheduling:** Overview, Schedule (schedule-grid), Timesheets (shiftsummaries), Time off (time-off-approvals, badge = pending count), Time off settings (people-management)
  - **Workforce:** People, Crews, Credentials
  - **Job sites:** Locations, Areas, Cost codes, Tasks, Active sites (permission `active-sites.view`), Daily reports
  - **Field communication:** Bulletins, Safety, Documents
  - **Integrations:** Procore, Kiosks
  - Account menu: My profile, Company settings, Billing, Company users (admin), Help, Log out

## 6. Copy rules

Sentence case everywhere (nav labels, buttons, headers). No ALL-CAPS badges ("LOCKED" → "Locked"); the only uppercase is the CSS eyebrow / column-header treatment. Buttons say what happens ("Publish 7 shifts", not "Submit"). All new strings go through Angular i18n (`i18n="@@…"`) and get Spanish entries in `src/locale/messages.es.xlf`.

## 7. Accessibility floor

Text contrast ≥ 4.5:1 (all token pairs above pass). Interactive targets ≥ 48×48 (CLAUDE.md principle 3). Visible `:focus-visible` ring 2px `--lz-link`, offset 2px. Status never by color alone (draft hatch, conflict icon, open dashed border, text labels). `prefers-reduced-motion` respected.

## 8. Migration rules

- Tailwind preflight is **off** until Bootstrap is removed (Plan F); a minimal base in `tailwind.css` sets body font/color/background.
- Bootstrap CSS is imported into cascade layer `legacy` so Tailwind utilities win over it on migrated screens while unmigrated screens keep working.
- A screen counts as migrated when: its stylesheet has no raw color/shadow/font-size, its template uses no Bootstrap classes, it uses `lz-page-header`, and it is listed in `style-guard.json`. The guard script fails CI for violations in listed files.

## 9. Roadmap (one plan each)

| Plan | Scope |
|---|---|
| A | Foundation: Tailwind + tokens + fonts, Material theme, style guard, core components, shell + nav, Schedule grid, People |
| B (done) | Schedule modals (add/edit, conflict, repeat, sick, time off, history, replacement), Overview, Timesheets, Time off approvals |
| C (done) | Workforce + Job sites screens (crews, credentials, people-management, locations, areas, cost codes, tasks, active sites, daily reports) |
| D (done) | Field communication + Integrations (bulletins, safety, documents, procore, kiosk admin), company settings, billing, profiles |
| E (done) | Public/auth surfaces: sign-in, registration, accept-invite, forgot-password, onboarding, company-switch, kiosk web |
| F | Remove Bootstrap, ng-bootstrap, font-awesome, bootstrap-icons; enable Tailwind preflight; delete `.bak` files |
| Later | Share `tokens` with Mobile/Kiosk (NativeWind or a generated TS token file) |
