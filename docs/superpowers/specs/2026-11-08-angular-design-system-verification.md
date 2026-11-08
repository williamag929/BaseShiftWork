# Angular design system, Plan A: verification

Branch `feature/angular-design-system`, 2026-11-08. Headless checks were run in the build container; visual checks need a running app with Firebase auth and are pending William.

## Automated checks

| Check | Result |
|---|---|
| `ng test --watch=false --browsers=ChromeHeadless` | 226 specs, 224 pass, 2 fail. Both failures are the main baseline: AuditHistoryFiltersComponent "30-day range", AuditHistoryService "fetch audit history". No new failures. |
| `node --test scripts/style-guard.test.mjs` | 13/13 pass |
| `npm run lint:styles` | 0 violations in 14 files |
| `ng build --configuration production` (en-US) | Fails only at index.html Google Fonts inlining (403 from the container network). Same failure on `main`. With font inlining disabled (temporary, uncommitted), build passes. |
| `ng build --configuration es-SP` | Passes localization and fails only at index.html font inlining (environmental, 403). The pre-existing `auth.onboarding.demo_description` placeholder mismatch (broken on `main`) is fixed in this branch (`messages.xlf` and `messages.es.xlf` now match the current onboarding source). With fonts inlining disabled temporarily, `production,es-SP` builds fully. |

Bundle sizes (production, fonts inlining off), branch vs main:

| Asset | main | branch |
|---|---|---|
| main.js | 2.09 MB (465.31 kB transfer) | 2.08 MB (464.14 kB) |
| styles.css | 374.59 kB (43.05 kB) | 340.02 kB (42.99 kB) |
| Initial total | 2.51 MB (521.33 kB) | 2.46 MB (520.14 kB) |

No budget warnings on either. One CSS minifier note (`.btn-group>+.btn`, successive traversals) appears on both.

## Manual checks: Pending — William

Run with `npm run start` (EN) and the es-SP build served from `dist`.

- [ ] Pending — William: Schedule and People at 1440px match mock boards 1 and 2. Look for: layout, spacing, type scale and colors matching the mocks.
- [ ] Pending — William: Schedule at 1280px. Look for: no horizontal page overflow, grid readable.
- [ ] Pending — William: Schedule at 390px. Look for: rail is an overlay, grid scrolls horizontally, team column stays sticky.
- [ ] Pending — William: Schedule with horizon 4W. Look for: 28 columns scroll and the header stays readable.
- [ ] Pending — William: Spanish rail labels. Look for: wrapping, no truncation.
- [ ] Pending — William: Spanish "Publicar N turnos". Look for: button text fits.
- [ ] Pending — William: Spanish summary strip. Look for: it wraps without clipping.
- [ ] Pending — William: Keyboard Tab order. Look for: every nav item, header action, summary button and shift block reachable.
- [ ] Pending — William: Focus ring. Look for: visible 2px ring on both navy and white backgrounds.
- [ ] Pending — William: Overview. Look for: opaque surface, no layout breakage.
- [ ] Pending — William: Locations. Look for: opaque surface, Bootstrap layout intact.
- [ ] Pending — William: Bulletins. Look for: opaque surface, Bootstrap layout intact.
- [ ] Pending — William: Safety. Look for: opaque surface, Bootstrap layout intact.
- [ ] Pending — William: Company settings. Look for: opaque surface, forms and buttons intact.
- [ ] Pending — William: Sign-in. Look for: renders correctly with the new theme and font.
- [ ] Pending — William: Drag a shift to another day. Look for: the shift moves and persists.
- [ ] Pending — William: Tick a shift checkbox. Look for: selection toggles and no edit dialog opens.
- [ ] Pending — William: Open a shift. Look for: edit dialog opens.

## Known visual changes on unmigrated screens

- Material surfaces are now opaque paper (no glass).
- Material primary is ink navy instead of violet.
- Body font is IBM Plex Sans and the background is canvas grey.
- Bootstrap is compiled without `!important` utilities in a lower cascade layer (the `legacy` layer).
- Tailwind generates utilities only for migrated files.
- New routes reachable: `/dashboard/analytics`, `/dashboard/cost-codes`, `/dashboard/procore`.

## Environmental / pre-existing issues

- Google Fonts 403 in this container breaks the production index.html step (pre-existing `<link>` for Roboto in `src/index.html`).
- es-SP build was broken on `main` by the `auth.onboarding.demo_description` placeholder mismatch; fixed in this branch.
