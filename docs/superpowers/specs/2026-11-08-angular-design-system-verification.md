# Angular design system, Plan A: verification

Branch `feature/angular-design-system`, 2026-11-08. Headless checks were run in CI-like conditions; visual checks need a running app with Firebase auth and are pending William (ruling R6).

## Automated checks

| Check | Result |
|---|---|
| `ng test --watch=false --browsers=ChromeHeadless` | 226 specs, 224 pass, 2 fail. Both failures are the main baseline: AuditHistoryFiltersComponent "30-day range", AuditHistoryService "fetch audit history". No new failures. |
| `node --test scripts/style-guard.test.mjs` | 13/13 pass |
| `npm run lint:styles` | 0 violations in 14 files |
| `ng build --configuration production` (en-US) | Fails only at index.html Google Fonts inlining (403 from the container network). Same failure on `main`. With font inlining disabled (temporary, uncommitted), build passes. |
| `ng build --configuration es-SP` | Fails on `main` too: `auth.onboarding.demo_description` has a placeholder mismatch in `messages.es.xlf` (target has `INTERPOLATION`, source text no longer does). Pre-existing, not caused by this branch. With that target temporarily patched and fonts off, `production,es-SP` passes and emits `dist/.../es/es-SP`. |

Bundle sizes (production, fonts inlining off), branch vs main:

| Asset | main | branch |
|---|---|---|
| main.js | 2.09 MB (465.31 kB transfer) | 2.08 MB (464.14 kB) |
| styles.css | 374.59 kB (43.05 kB) | 340.02 kB (42.99 kB) |
| Initial total | 2.51 MB (521.33 kB) | 2.46 MB (520.14 kB) |

No budget warnings on either. One CSS minifier note (`.btn-group>+.btn`, successive traversals) appears on both.

## Manual checks: Pending, William

Run with `npm run start` (EN) and the es-SP build served from `dist`.

- [ ] Pending: Schedule and People at 1440px match mock boards 1 and 2. Look for: layout, spacing, type scale and colors matching the mocks.
- [ ] Pending: Schedule at 1280px. Look for: no horizontal page overflow, grid readable.
- [ ] Pending: Schedule at 390px. Look for: rail is an overlay, grid scrolls horizontally, team column stays sticky.
- [ ] Pending: Schedule with horizon 4W. Look for: 28 columns scroll and the header stays readable.
- [ ] Pending: Spanish rail labels. Look for: wrapping, no truncation.
- [ ] Pending: Spanish "Publicar N turnos". Look for: button text fits.
- [ ] Pending: Spanish summary strip. Look for: it wraps without clipping.
- [ ] Pending: Keyboard Tab order. Look for: every nav item, header action, summary button and shift block reachable.
- [ ] Pending: Focus ring. Look for: visible 2px ring on both navy and white backgrounds.
- [ ] Pending: Overview. Look for: opaque surface, no layout breakage.
- [ ] Pending: Locations. Look for: opaque surface, Bootstrap layout intact.
- [ ] Pending: Bulletins. Look for: opaque surface, Bootstrap layout intact.
- [ ] Pending: Safety. Look for: opaque surface, Bootstrap layout intact.
- [ ] Pending: Company settings. Look for: opaque surface, forms and buttons intact.
- [ ] Pending: Sign-in. Look for: renders correctly with the new theme and font.
- [ ] Pending: Drag a shift to another day. Look for: the shift moves and persists.
- [ ] Pending: Tick a shift checkbox. Look for: selection toggles and no edit dialog opens.
- [ ] Pending: Open a shift. Look for: edit dialog opens.

## Known visual changes on unmigrated screens

- Material surfaces are now opaque paper (no glass).
- Material primary is ink navy instead of violet.
- Body font is IBM Plex Sans and the background is canvas grey.
- Bootstrap is compiled without `!important` utilities in a lower cascade layer (R19).
- Tailwind generates utilities only for migrated files (R20).
- New routes reachable: `/dashboard/analytics`, `/dashboard/cost-codes`, `/dashboard/procore` (R13).

## Environmental / pre-existing issues

- Google Fonts 403 in this container breaks the production index.html step (pre-existing `<link>` for Roboto in `src/index.html`).
- es-SP build breaks on `main` due to the `auth.onboarding.demo_description` placeholder mismatch in `messages.es.xlf`; recommend a separate fix.
