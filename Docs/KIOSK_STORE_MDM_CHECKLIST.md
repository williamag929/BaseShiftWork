# Loqzen Kiosk: store and MDM readiness checklist

App: `ShiftWork.Kiosk` (Expo SDK 54), shipped as **Loqzen Kiosk**.
Bundle ID / package: `com.loqzen.kiosk` (iOS and Android). This becomes permanent after the first upload to App Store Connect or Play Console.

The kiosk is a shared, locked-down iPad (or Android tablet) at a job site. Employees punch in with a PIN, and the kiosk may take a photo and record GPS. Nobody signs in on the device. That shapes both store review and how the device gets locked down.

Companion doc for the employee phone app: `Docs/STORE_SUBMISSION_CHECKLIST.md` (from loqzen-daily PR 12).

---

## 1. Ready in the repo (this PR)

| Item | Where | Status |
|---|---|---|
| iPad-only, landscape, full screen | `app.json`: `isTabletOnly`, `orientation`, `requireFullScreen` | Done |
| Permission strings say why (camera, location while in use) | `app.json` `ios.infoPlist` + plugin options | Done |
| No microphone, Face ID, "Always" location, background location, storage or overlay permissions | `microphonePermission: false`, `recordAudioAndroid: false`, `faceIDPermission: false`, `locationAlways*: false`, `blockedPermissions` | Done |
| Export compliance answered | `ITSAppUsesNonExemptEncryption: false` | Done |
| Interim Loqzen icon, adaptive icon, landscape splash | `ShiftWork.Kiosk/assets/` | Done (interim art) |
| EAS build profiles | `ShiftWork.Kiosk/eas.json`: `preview`, `production`, `production-apk` | Done |
| Build numbers managed by EAS | `appVersionSource: "remote"`, `autoIncrement` | Done |
| Privacy / terms URLs | `extra.privacyPolicyUrl`, `extra.termsUrl` → loqzen.com | Pages come in backlog task 14 |
| Screen stays awake | `expo-keep-awake` in `app/_layout.tsx` | Already in code |
| Store credentials ignored by git | `ShiftWork.Kiosk/.gitignore` → `secrets/`, `*.p8`, `*.p12` | Done |

## 2. Blockers before any public build

1. **EAS project ID.** The old `extra.eas.projectId` was `"loqzen-kiosk"`, which is not a valid ID, so it was removed. Run `npx eas init` inside `ShiftWork.Kiosk` (owner `williamaguirre82`). It writes the real UUID into `app.json`. Commit that.
2. **Production API URL.** The app reads `EXPO_PUBLIC_API_URL` (`.env.example` shows a LAN IP). Set it for the EAS `production` and `preview` environments: `npx eas env:create --name EXPO_PUBLIC_API_URL --value https://[[PROD_API_HOST]] --environment production`. It must be HTTPS.
3. **`EXPO_PUBLIC_DEFAULT_COMPANY_ID`.** `.env.example` sets `6513451`. Do **not** set this in production builds, or every new kiosk pre-fills that company.
4. **Enrollment security (code, needs its own task).** Setup resolves the company from an employee **email only**, with no password or code (`app/(setup)/index.tsx` → `kioskService.getUserByEmail`). Anyone who knows one employee email can enroll a kiosk for that company and list its locations. Before launch, require an admin login or a one-time enrollment code from the web app.
5. **Admin password endpoint.** `app/(admin)/index.tsx` notes the verify endpoint needs `Authorize(Policy="kiosk.admin")` on the server. Confirm it works against production before shipping, since it is the only way out of a configured kiosk.
6. **Privacy policy page** live at `https://loqzen.com/privacy` (task 14). Both stores require it, and the photo + location data makes it mandatory.
7. **Final artwork.** The icon and splash are an interim "L" mark. Replace them before taking store screenshots.

## 3. Choose a distribution path

| Path | Good for | What you do |
|---|---|---|
| **A. Public App Store / Play Store** | Simplest for customers: they search "Loqzen Kiosk" | Normal review. Reviewers need a demo company (see 4.3). |
| **B. Apple "Custom App" (Apple Business Manager)** | Customers who manage iPads with an MDM | Same App Store Connect upload; under Pricing and Availability choose *Private* distribution to specific ABM organization IDs. Still reviewed by Apple. |
| **C. Managed Google Play private app / APK** | Android tablets under an EMM | Upload the `production` AAB as a private app in the customer's managed Play, or sideload the `production-apk` build. |
| **D. Ad hoc / internal (`preview`)** | Your own pilot devices only | `eas build -p ios --profile preview`. Each iPad's UDID must be registered (`eas device:create`). Max 100 devices/year. Not for customers. |

Recommendation for launch: **A** (public listing) so small crews can install it themselves, plus **B** later for larger customers with MDM. Decision for William: `[[DISTRIBUTION_PATH]]`.

## 4. App Store Connect (iPad)

1. Create the app record: platform iOS, name **Loqzen Kiosk**, bundle ID `com.loqzen.kiosk`, SKU `[[KIOSK_SKU]]`. Put the numeric App ID into `eas.json` → `submit.production.ios.ascAppId`.
2. Fill `appleId` and `appleTeamId` in `eas.json` (placeholders now).
3. **App Review notes (important).** The kiosk opens on a setup screen and is useless without a company. Give the reviewer:
   - a demo company with one active location, and the email to enter on setup: `[[REVIEW_DEMO_EMAIL]]`
   - a demo employee PIN: `[[REVIEW_DEMO_PIN]]`
   - the admin password to leave kiosk mode: `[[REVIEW_ADMIN_PASSWORD]]`
   - one sentence: "This is a shared time clock for job sites. Employees enter a PIN to clock in; no personal account is created on the device."
4. **Account deletion (guideline 5.1.1(v)).** The kiosk has no sign-up, so this should not apply. If Apple asks, point to account deletion in the main Loqzen app/web (still missing, see the PR 12 checklist).
5. **Privacy nutrition label.** Data collected and linked to the employee: *Photos* (clock-in photo, if the company enables it), *Precise location* (at punch time only), *Name / user ID* (via PIN). Purpose: App Functionality. No tracking.
6. Screenshots: iPad 13" (2064×2752 or 2752×2064 landscape) required. Take them on the PIN pad, clock screen and success screen in a demo company.
7. Age rating: 4+. Category: Business.
8. Build and submit: `npx eas build -p ios --profile production`, then `npx eas submit -p ios --profile production`.

## 5. Google Play Console (Android tablets, optional at launch)

1. Create app **Loqzen Kiosk**, package `com.loqzen.kiosk`, free, App.
2. Create a service account with release access and save its JSON as `ShiftWork.Kiosk/secrets/play-service-account.json` (git-ignored).
3. The first AAB must be uploaded **by hand** in Play Console (API uploads only work after that). Build with `npx eas build -p android --profile production`.
4. Data safety form: photos, precise location, user IDs; collected, not shared, for app functionality; encrypted in transit.
5. Tablet screenshots (7" and 10"). Mark the app as tablet-targeted in the store listing.
6. Content rating questionnaire, target audience 18+, privacy policy URL.

## 6. Locking the device (do this on every kiosk)

The app keeps the screen awake but **cannot lock itself in**. Pick one of these per site.

### iPad without MDM: Guided Access (free, built in)
1. Settings → Accessibility → Guided Access → On. Set a passcode that is **not** the device passcode.
2. Settings → Accessibility → Guided Access → Time Limits: off. Display Auto-Lock: Never (Guided Access option) or Settings → Display & Brightness → Auto-Lock → Never.
3. Open Loqzen Kiosk, enroll the location, then triple-click the side/home button → Start.
4. Turn off Control Center access and Notifications (Settings → Notifications → Show Previews: Never; enable a Focus mode).
5. Keep the iPad on a charger. Only staff with the Guided Access passcode can exit.

### iPad with MDM (Jamf, Intune, Kandji, Mosyle...): Single App Mode
1. Enroll the iPad as **supervised** (Apple Configurator or Apple Business Manager).
2. Install Loqzen Kiosk through the MDM (path B) and push a **Single App Mode** (App Lock) payload for bundle ID `com.loqzen.kiosk`.
3. In the same profile disable auto-lock, the sleep/wake button and touch-to-dismiss notifications as needed.
4. Updates: the MDM pushes new versions. Test one update on a pilot iPad to confirm the app relaunches in Single App Mode.

Note: *Autonomous* Single App Mode (the app locks itself on demand) needs native code (`UIAccessibilityRequestGuidedAccessSession`) plus an MDM allow-list. Not implemented; only consider it if customers ask.

### Android tablet: Screen pinning or dedicated device
- Without EMM: Settings → Security → App pinning → On, then pin Loqzen Kiosk from Overview. Require PIN to unpin.
- With EMM (Intune, Google Workspace, Esper...): enroll as a **dedicated device** and set Loqzen Kiosk as the single app (lock task mode).

## 7. Per-device setup checklist (for customers / support)

- [ ] Tablet charged, mounted, on site Wi-Fi or cellular
- [ ] Location Services on, Loqzen Kiosk allowed "While Using"
- [ ] Camera allowed (if the company uses clock-in photos)
- [ ] Kiosk enrolled to the right location; device name set in Settings → General → About → Name (enrollment saves it)
- [ ] Guided Access / Single App Mode / pinning active
- [ ] Test punch: clock in and out with a test PIN, check it appears in the web timesheet
- [ ] Admin password known by the site manager

## Placeholders in this doc and `eas.json`

`[[APPLE_ID_EMAIL]]`, `[[KIOSK_APP_STORE_CONNECT_APP_ID]]`, `[[APPLE_TEAM_ID]]`, `[[PROD_API_HOST]]`, `[[DISTRIBUTION_PATH]]`, `[[KIOSK_SKU]]`, `[[REVIEW_DEMO_EMAIL]]`, `[[REVIEW_DEMO_PIN]]`, `[[REVIEW_ADMIN_PASSWORD]]`
