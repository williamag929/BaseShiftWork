# i18n (EN/ES) — Production Deployment Runbook

**Release:** `feature-i18` → `main` | **Scope:** API (no migration), Angular Web, Mobile (EAS)
**NOT in this release:** Kiosk (no i18n implemented on branch) — decide: ship without it or hold.
**Deployer:** William Aguirre

## How this release deploys

| Surface | Mechanism | Human effort |
|---|---|---|
| API + Web + MCP | Merge to `main` → `deploy.yml` auto SSH + `docker compose up -d --build` | Approve PR, monitor |
| Mobile | `eas build --profile production` → App Store / Play Store submission | Credentials, store metadata, review wait |
| Kiosk | — (excluded) | — |

No database migration in this release. `CompanySettings.DefaultLanguage` already exists in prod.

---

## Day 1 (Thu) — Pre-deploy verification

**Human interactions: you (+ 1 reviewer if available)**

- [ ] Run `node translations-source/scripts/validate-strings.js` — EN/ES key parity passes
- [ ] Rebase `feature-i18` on `main`; resolve conflicts
- [ ] **Verify Angular locale build locally**: `angular.json` build config had `"localize": ["en-US"]` — confirm the production build now includes `es-SP` (or runtime switching works). This is the most likely silent failure.
- [ ] `docker compose build web api` locally — both images build clean
- [ ] Local smoke test in Spanish: login, dashboard, bulletins, daily report, onboarding
- [ ] Open PR `feature-i18` → `main`; confirm `pr-tests.yml` is green
- [ ] Document rollback: web/api = revert merge commit, re-run deploy.yml (or `git revert` + `workflow_dispatch`); mobile = previous store build stays live

## Day 2 (Fri) — Code review & mobile prep

**Human interactions: reviewer approves PR; you gather store assets**

- [ ] PR reviewed and approved (human reviewer required)
- [ ] Fill real credentials in `eas.json` submit profile: `appleId`, `ascAppId`, `appleTeamId` (currently placeholders `your-apple-id@example.com` / `000000000`) — do NOT commit secrets; use EAS secrets/env
- [ ] Verify Google Play service account key configured for `eas submit`
- [ ] Prepare **Spanish store listings** (App Store + Play Console): description, screenshots in ES, "What's New" text EN+ES
- [ ] Bump Mobile version/buildNumber in `app.json`
- [ ] ⚠️ Don't merge on Friday afternoon — hold merge for Monday morning (deploy.yml fires immediately on merge)

## Day 3 (Mon) — Merge & backend/web production deploy

**Human interactions: you merge, then monitor; notify stakeholders**

- [ ] Notify team/on-call: deploying i18n release ~9–10 AM
- [ ] Merge PR → `deploy.yml` runs automatically
- [ ] Watch GitHub Actions run; confirm `docker compose ps` step passes (mcp, api, web running)
- [ ] Prod smoke test (15–30 min):
  - API health endpoint responds
  - Web loads in EN (default unchanged for existing tenants)
  - Switch a **test company** `DefaultLanguage` → `es` in company settings; verify web renders Spanish
  - No console errors, no missing-translation keys (`[missing]` / raw keys on screen)
- [ ] Monitor logs/error rates for the afternoon
- [ ] **Rollback trigger:** blank pages, raw translation keys visible, API 5xx spike → revert merge commit, re-run deploy

## Day 4 (Tue) — Mobile production builds & store submission

**Human interactions: you run builds; Apple/Google review queues start**

- [ ] `eas build --profile production --platform all` (Mobile points at prod API already deployed Day 3 — safe order)
- [ ] Install Android build (internal track) on a real device; smoke test ES: device in Spanish → app in Spanish; language matches company default; dates localized
- [ ] `eas submit -p android` → Play Console: release to **internal/closed track first**, add ES release notes
- [ ] `eas submit -p ios` → App Store Connect: attach build, ES metadata, submit for review
- [ ] **Wait begins:** Apple review typically 1–3 days; Google internal track ~hours

## Day 5 (Wed) — Staged rollout & tenant enablement

**Human interactions: QA pass, promote Android track**

- [ ] Android: promote internal → production with **staged rollout 20%**
- [ ] Verify crash-free rate in Play Console / monitoring before increasing
- [ ] Enable Spanish for 1–2 pilot tenants (set `DefaultLanguage = "es"` in their company settings); confirm with those managers
- [ ] Collect pilot feedback on translation quality (native ES speaker review if available)

## Day 6–7 (Thu–Fri) — iOS release & rollout completion

**Human interactions: release approval taps, comms**

- [ ] iOS approved → **release manually** (set "Manually release this version" so you control timing)
- [ ] Android staged rollout → 50% → 100% if crash-free ≥ baseline
- [ ] Announce to customers: Spanish available; how to change company default language
- [ ] Update changelog / release notes in repo
- [ ] Close i18n tickets; mark plan phases done in `Docs/I18N_IMPLEMENTATION_PLAN.md`

## Follow-ups (next sprint)

- Kiosk i18n (Phase 3 of the plan — still pending)
- `Person.PreferredLanguage` API field + localized push notifications (Phase 1 items not on this branch)
- CI step running `validate-strings.js` on every PR

## Rollback summary

| Surface | Action | Time |
|---|---|---|
| API/Web | `git revert <merge>` → push main (auto-redeploys) | ~10 min |
| Android | Halt staged rollout in Play Console | minutes |
| iOS | Can't pull a live version fast — submit expedited fix; keep manual-release control until confident | days |
