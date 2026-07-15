# i18n Implementation Plan — English / Spanish (Mobile + Kiosk, full integration)

> Goal: EN/ES support on Mobile and Kiosk, integrated with the existing `CompanySettings.DefaultLanguage` backbone. Angular gap-closure included as a final phase.

## Current State (audited 2026-07-14)

| Surface | Status |
|---|---|
| API | ✅ `CompanySettings.DefaultLanguage` exists (Models + DTO, default `"en"`). ❌ No per-user language. ❌ Push notifications hardcoded EN. |
| Angular | ⚠️ Scaffolded only: `@angular/localize` installed, `angular.json` declares `es-SP → src/locale/messages.es.xlf`, but the xlf file doesn't exist, no `i18n` template attributes, build localizes `en-US` only. ✅ Default Language dropdown in company settings + `settings-helper.getLanguage()`. |
| Mobile | ❌ No i18n libs, all strings hardcoded. ✅ `company-settings.service.ts` already fetches `defaultLanguage`. |
| Kiosk | ❌ Nothing. |

## Architecture Decision

Angular's compile-time xlf i18n **cannot be shared** with React Native. Use runtime JSON dictionaries for Mobile/Kiosk (`i18next`), and keep the tenant-level default in `CompanySettings.DefaultLanguage` as the shared source of truth across all surfaces.

**Language resolution order (Mobile):**
1. User's explicit in-app choice (persisted in AsyncStorage)
2. `Person.PreferredLanguage` (new, synced to server)
3. `CompanySettings.DefaultLanguage`
4. Device locale (`expo-localization`)
5. Fallback `en`

**Kiosk:** stateless per session — toggle on PIN screen, resets after clock-out. Initial value from `CompanySettings.DefaultLanguage`.

---

## Phase 1 — Backend (ShiftWork.Api)

1. **`Person.PreferredLanguage`** (`string?`, values `"en"`/`"es"`, null = inherit company default)
   - `Models/Person.cs`, Person DTOs (input + output), `AutoMapperProfile.cs`
   - EF migration `AddPersonPreferredLanguage`
   - Expose via existing Person update endpoint (self-service; no new permission needed — employees already edit their own profile)
2. **Localized push notifications** — `PushNotificationService`:
   - Add a minimal server-side dictionary (`Resources/notifications.en.json`, `notifications.es.json` or .resx) for notification titles/bodies (new bulletin, safety scheduled, shift reminders)
   - Resolve language per recipient: `Person.PreferredLanguage ?? CompanySettings.DefaultLanguage`
3. **No change** to `CompanySettings` — `DefaultLanguage` already exists and is editable from Angular.

## Phase 2 — Mobile (ShiftWork.Mobile)

1. **Deps:** `i18next`, `react-i18next`, `expo-localization`
2. **Structure:**
   ```
   i18n/
     index.ts          # i18next init + resolution chain above
     locales/en.json
     locales/es.json
   ```
   Namespaced keys per feature: `auth.*`, `tabs.*`, `schedule.*`, `bulletins.*`, `documents.*`, `dailyReport.*`, `safety.*`, `timeOff.*`, `common.*`
3. **Init:** load in root `app/_layout.tsx` before render; after login, apply resolution chain (authStore has person + company settings via existing services)
4. **Language store:** small Zustand slice (or extend `authStore`) — `language`, `setLanguage()`; `setLanguage` persists to AsyncStorage **and** PATCHes `Person.PreferredLanguage` (fire-and-forget, offline-safe)
5. **Settings UI:** language selector in the profile/settings screen — English / Español, one tap (UX principle: one primary action)
6. **String extraction (largest effort):** replace hardcoded strings with `t()` across `app/(tabs)/*`, `app/(auth)/*`, `app/bulletins/`, `app/documents/`, `app/safety/`, `components/`. Do it feature-by-feature, tabs first.
7. **Dates:** localize date formatting in `utils/date.utils.ts` (date-fns `es` locale or `Intl` with resolved language)
8. **Push:** display-side already localized by Phase 1 (server sends localized payload)

## Phase 3 — Kiosk (ShiftWork.Kiosk)

Deliberately lighter — no user session, one-tap flows:

1. Same `i18next` setup, single small dictionary (`clock in/out`, PIN prompts, success/interstitial, safety-ack strings — Kiosk has few screens)
2. **EN | ES toggle** on the PIN screen (`app/(kiosk)/_layout.tsx` header or PIN screen corner, ≥48dp target)
3. Default from `CompanySettings.DefaultLanguage` (kiosk already knows its company via `kiosk.service.ts`); selection lives in memory only and resets after clock-out/success screen timeout
4. Safety acknowledgment / urgent bulletin interstitials: render content as authored (content itself is not machine-translated); only chrome/buttons are translated

## Phase 4 — Angular gap closure (optional, recommended)

The xlf route is declared but dead. Two options:

- **A (align with mobile, recommended):** drop the unused `@angular/localize` config; adopt `@ngx-translate/core` with the **same `en.json`/`es.json` key structure as Mobile** → one translation catalog convention across surfaces, runtime switching, driven by `settings-helper.getLanguage()`
- **B (finish native i18n):** add `i18n` attributes everywhere, extract to xlf, translate, build per-locale bundles — compile-time, no runtime switch, duplicated catalogs vs mobile

## Translation catalog convention (all surfaces)

- Keys: `feature.screen.element` (e.g. `bulletins.detail.acknowledgeButton`)
- `en.json` is the source of truth; `es.json` must have identical key sets (add a CI/jest check: key-parity test)
- No machine-translated user content — only UI chrome

## Suggested order & sizing

| Step | Size |
|---|---|
| 1. API: PreferredLanguage + migration | S |
| 2. Mobile: i18n scaffold + resolution chain + language selector | M |
| 3. Mobile: string extraction (per-feature PRs) | L |
| 4. Kiosk: scaffold + PIN toggle + dictionary | S–M |
| 5. API: localized push payloads | M |
| 6. Angular: ngx-translate migration | M–L (deferrable) |

## Verification

- Jest: key-parity test EN↔ES in Mobile and Kiosk
- Mobile: switch language in settings → all tabs re-render in ES; relaunch keeps choice; fresh install on ES device → ES
- Kiosk: toggle ES → clock-in flow ES → after clock-out returns to company default
- Push: user with `PreferredLanguage=es` receives ES notification for new bulletin
