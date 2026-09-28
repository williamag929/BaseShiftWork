# i18n Implementation Plan — English / Spanish (all surfaces)

> Goal: EN/ES support on Mobile, Kiosk, and Angular, integrated with the existing `CompanySettings.DefaultLanguage` backbone.

## Current State (updated 2026-07-15)

| Surface | Status |
|---|---|
| API | ✅ **Done.** `CompanySettings.DefaultLanguage` (pre-existing) + `Person.PreferredLanguage` (nullable, migration `AddPersonPreferredLanguage`, exposed via Person DTO/update endpoint). Push notifications localized per recipient via `NotificationLocalizer` + `Resources/notifications.{en,es}.json`; resolution `Person.PreferredLanguage ?? CompanySettings.DefaultLanguage ?? "en"`, dates formatted per culture. |
| Angular | ✅ **Done.** 1,013 `i18n="@@key"` template attributes + 12 `$localize` TS strings. XLIFF files generated from the shared catalog (with `<x/>` interpolation placeholders). `ng build` (en-US) and `ng build --configuration=es-SP` both pass; Spanish bundle verified. |
| Mobile | ✅ **Done.** Custom `LocaleProvider`/`useTranslation()` in `ShiftWork.Mobile/i18n/`, all screens migrated to `t()`, EN/ES selector in Profile, locale persisted in AsyncStorage. `tsc` clean. |
| Kiosk | ✅ **Done.** Same pattern in `ShiftWork.Kiosk/i18n/` (persists via `expo-secure-store`), all screens migrated (83 `kiosk_app.*` keys), EN\|ES toggle in the shared kiosk header, header clock/date localized. `tsc` clean. |

## Architecture (as built)

The plan originally proposed `i18next`/`react-i18next`. The implementation instead uses a **single shared catalog + generators** with a zero-dependency runtime:

```
translations-source/strings.json        ← single source of truth (1,454 keys, en + es)
  ├─ npm run validate                   ← key/placeholder parity gate
  ├─ npm run generate:rn                → ShiftWork.Mobile/i18n/translations/{en,es}.ts
  │                                     → ShiftWork.Kiosk/i18n/translations/{en,es}.ts
  └─ npm run generate:angular           → ShiftWork.Angular/src/locale/messages{,.es}.xlf
```

- **Mobile/Kiosk runtime:** custom `LocaleProvider` + `useTranslation()` hook (`t(key, vars?)` with `{{var}}` interpolation, EN fallback, then raw key). No i18n library dependency.
- **Angular:** native `@angular/localize` compile-time route (plan's Option B, not ngx-translate). Templates use `i18n="@@key"` custom IDs matching the JSON keys; the XLIFF generator converts `{{var}}` into `<x id="INTERPOLATION"/>` placeholders positionally from the English source.
- **Persistence:** Mobile → AsyncStorage (`@app_locale`); Kiosk → SecureStore (`app_locale`), so the tablet keeps its language across restarts (improvement over the original in-memory-only design).

**Language resolution order (Mobile, as built):**
1. ✅ User's explicit in-app choice (AsyncStorage) — also PATCHed to `Person.PreferredLanguage` fire-and-forget
2. ✅ `Person.PreferredLanguage` — applied after login by `hooks/useServerLocale.ts` (mounted in the tabs layout)
3. ✅ `CompanySettings.DefaultLanguage` — fallback when the person has no preference
4. ✅ Device locale (`Intl.DateTimeFormat().resolvedOptions()`, not `expo-localization`)
5. ✅ Fallback `en`

Steps 2–3 only apply when the user has made no explicit in-app choice (`applyServerLocale` in the provider) and are never persisted locally, so the server stays authoritative. Date display formatting (`utils/date.utils.ts` `formatDate`/`formatTime`) follows the active locale via `setDateLocale`, wired from the provider.

**Kiosk:** EN|ES toggle lives in the shared kiosk header (visible on every screen, ≥48dp), not just the PIN screen. Choice persists on-device rather than resetting per session. When no one has toggled the language, the kiosk seeds from `CompanySettings.DefaultLanguage` via the anonymous `GET api/kiosk/{companyId}/language` endpoint.

---

## Remaining Work

### Phase 1 — Backend (ShiftWork.Api) — ✅ done (2026-07-15)

As built:
- `Person.PreferredLanguage` (`string?`, null = inherit company default) in `Models/Person.cs`, `DTOs/PersonDto.cs` (convention-mapped), `PeopleService.Update`, migration `20260715213652_AddPersonPreferredLanguage` (**not yet applied to the database** — run `dotnet ef database update`; note it also captures pre-existing `KioskQuestions.QuestionType` nvarchar(50)→max model drift, a safe widening)
- `Services/NotificationLocalizer.cs` (singleton) loads `Resources/notifications.{en,es}.json` (`{{var}}` templates, EN fallback)
- `PushNotificationService.SendLocalizedNotificationAsync` / `...ToCompanyAsync` group device tokens by resolved language and send one Expo batch per language; dates formatted with the recipient's culture
- All Notify* helpers plus `BulletinService` and `SafetyService` (immediate + scheduled hosted service) now send localized pushes
- Not localized: notification emails (`INotificationService.SendEmailAsync` bodies remain EN) and authored content (bulletin/safety titles render as authored)

### Phase 2 — Mobile — ✅ done (2026-07-16)

- Resolution chain fully wired (see above); language selector in Profile syncs to `Person.PreferredLanguage`
- Dates localized via `setDateLocale` in `utils/date.utils.ts`
- Jest key-parity tests: `i18n/__tests__/parity.test.ts` in both Mobile and Kiosk (key sets, non-empty values, `{{placeholder}}` parity)

### Phase 3 — Kiosk — ✅ done (2026-07-16)

- Locale seeds from `CompanySettings.DefaultLanguage` (anonymous kiosk endpoint) when no on-device choice exists
- `ErrorBoundary` fallback intentionally stays EN (class component rendering when the app has crashed; provider may be unavailable)

### Outstanding

- Apply EF migration: `dotnet ef database update` (adds `People.PreferredLanguage`)
- CI: add `cd translations-source && npm run validate` (and optionally the two Jest parity suites) to the GitHub Actions workflow before build steps
- Notification emails (`INotificationService.SendEmailAsync` bodies) remain EN — localize later if needed

---

## Translation catalog convention (all surfaces)

- Keys: `feature.element` or `feature.screen.element` (e.g. `bulletins.filter_unread`, `kiosk_app.enter_pin`)
- Namespaces in use: `common.*`, `auth.*`, `clock.*`, `tabs.*`, `bulletins.*`, `documents.*`, `safety.*`, `daily_report.*`, `time_off.*`, `upgrade.*`, `profile.*`, `schedule*.*`, `kiosk_app.*` (RN kiosk), `kiosk.*` (Angular kiosk feature), plus Angular dashboard namespaces
- Variables: `{{variableName}}` — must match between `en` and `es` (enforced by `npm run validate`)
- API-bound values stay in English (e.g. kiosk yes/no answers submit `'Yes'`/`'No'`; only labels translate)
- Brand names ("ShiftWork", "ShiftWork Kiosk") are not translated
- No machine-translated user content — only UI chrome; server-authored content (bulletins, safety, documents) renders as authored

## Workflow

1. Edit `translations-source/strings.json`
2. `cd translations-source && npm run generate:all` (validates first; broken strings never reach generated files)
3. Commit generated files alongside the strings.json change
4. Angular Spanish build: `ng build --configuration=es-SP` (outputs to `dist/shift-workfrontend/es`)

## Verification status

- ✅ `npm run generate:all` — 1,454 keys validated, all six outputs regenerate
- ✅ `tsc --noEmit` clean on Mobile and Kiosk
- ✅ Angular `ng build` (en-US) and `ng build --configuration=es-SP` pass; Spanish strings confirmed in bundle
- ✅ Key parity: all template/`$localize`/`t()` keys resolve against the catalog (Angular 1,013 + 12; Kiosk 81; Mobile audited)
- ✅ API builds with `Person.PreferredLanguage` + localized push pipeline (migration created, pending `database update`)
- ✅ Jest key-parity tests pass in Mobile and Kiosk (4 tests each)
- ✅ `tsc --noEmit` clean on Mobile and Kiosk after resolution-chain wiring
- ⬜ End-to-end push check: user with `PreferredLanguage=es` receives ES notification (needs deployed migration + device)

> Note: `es-SP` is a non-standard BCP-47 code (standard would be `es-ES`/`es-419`); it was already committed in `angular.json` and is kept to avoid a breaking change. Angular falls back to standard `es` locale data — dates/numbers format correctly; the build warning is expected.
