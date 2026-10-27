# Loqzen Mobile — Store Submission Checklist

Scope: the employee phone app in `ShiftWork.Mobile` (Expo SDK 54, EAS Build).
Bundle ID / package: `com.loqzen.mobile` (iOS and Android). The iPad kiosk (`ShiftWork.Kiosk`, `com.loqzen.kiosk`) has its own checklist.

> **The bundle ID and Android package become permanent the moment the first build is uploaded to App Store Connect / Google Play.** Confirm `com.loqzen.mobile` is final before the first upload.

Legend: ✅ done in repo · ⬜ William must do · ⚠️ blocker that needs code before submission

---

## 1. What is already prepared in the repo

| Item | Where | Status |
|---|---|---|
| App name `Loqzen`, slug `loqzen-mobile`, scheme `loqzen` | `app.json` | ✅ |
| iOS `bundleIdentifier` / Android `package` = `com.loqzen.mobile` | `app.json` | ✅ |
| Marketing version `1.0.0` (`expo.version`) | `app.json` | ✅ |
| Build numbers managed by EAS (`cli.appVersionSource: "remote"`, `production.autoIncrement: true`) | `eas.json` | ✅ |
| Build profiles: `development` (dev client, internal), `preview` (internal APK / iOS simulator), `production` (AAB + App Store) | `eas.json` | ✅ |
| Interim Loqzen icon set (white "L" on `#1A6B47`, matches the landing-site favicon) — icon, adaptive icon, splash, favicon, Android notification icon. SVG sources in `ShiftWork.Mobile/scripts/assets/` | `ShiftWork.Mobile/assets/` | ✅ (interim, see §5) |
| iOS permission strings: camera, photo library, location when-in-use, Face ID | `app.json` → `ios.infoPlist` + plugins | ✅ |
| Removed unused permissions: microphone / `RECORD_AUDIO`, `DETECT_SCREEN_CAPTURE`, and the iOS "Always" location strings (the app only uses foreground location). `RECORD_AUDIO`, `ACCESS_BACKGROUND_LOCATION` and `WRITE_EXTERNAL_STORAGE` are explicitly blocked in the Android manifest | `app.json` | ✅ |
| Removed the `postinstall` placeholder-asset script (it overwrote the icon sources with old "SW" art on every `npm install`, including on EAS) | `package.json` | ✅ |
| `ITSAppUsesNonExemptEncryption: false` (app only uses HTTPS / OS crypto — skips the export-compliance question on every upload) | `app.json` | ✅ |
| Privacy-policy and terms URLs exposed as `extra.privacyPolicyUrl` / `extra.termsUrl` (`https://loqzen.com/privacy`, `/terms`) | `app.json` | ✅ (pages do not exist yet — backlog task 14) |
| `secrets/` git-ignored for the Play service-account key | `ShiftWork.Mobile/.gitignore` | ✅ |
| Submit profile with placeholders | `eas.json` → `submit.production` | ⬜ fill placeholders |

### Placeholders to replace in `eas.json`
- `[[APPLE_ID_EMAIL]]` — Apple ID used for App Store Connect
- `[[APP_STORE_CONNECT_APP_ID]]` — numeric "Apple ID" of the app record in App Store Connect
- `[[APPLE_TEAM_ID]]` — 10-character Team ID from developer.apple.com → Membership

Android: save the Play service-account JSON to `ShiftWork.Mobile/secrets/google-play-service-account.json` (never commit it). First submission goes to the **internal** track as a **draft**.

---

## 2. Blockers before the first submission ⚠️

1. **In-app account deletion (Apple Guideline 5.1.1(v), Google Play account-deletion policy).** The app lets people create accounts (`app/(auth)/register.tsx`, accept-invite), but there is no "Delete my account" action in the app or API. Apple rejects apps without it; Google also requires a public web URL where users can request deletion. Needs an API endpoint + a Profile screen entry (and a web page).
2. **Privacy policy must be reachable inside the app** and at a public URL. `https://loqzen.com/privacy` does not exist yet (backlog task 14). After it exists, add a "Privacy policy" / "Terms" row to the Profile tab that opens `Constants.expoConfig.extra.privacyPolicyUrl`.
3. **Final brand artwork.** The current icons are an interim "L" mark generated from the landing-site favicon. Replace with the real logo before screenshots are made (see §5).
4. **Demo account for review.** Apple and Google reviewers must be able to sign in. Create a demo company + employee with a known PIN/password and sample shifts (see §3).
5. **Production API URL must be HTTPS.** The resolved iOS config currently has `NSAllowsArbitraryLoads: true` (allows plain HTTP). Confirm the production `API_URL` is `https://` and consider turning arbitrary loads off for the production profile — Apple asks for a justification when it is on.

Minor, not blocking: `expo-doctor` reports one patch mismatch (`expo-asset` 12.0.13 vs expected ~12.0.14) — fix with `npx expo install --check`. `SYSTEM_ALERT_WINDOW` still appears in the merged Android manifest (added by React Native); Play does not usually flag it, but block it if a review asks.

---

## 3. Apple — App Store Connect (William)

- ⬜ Apple Developer Program membership active (organization account recommended so the seller name reads as the company, needs a D-U-N-S number).
- ⬜ developer.apple.com → Identifiers: register `com.loqzen.mobile`; enable **Associated Domains**, **Push Notifications**, and **NFC Tag Reading** (only if NFC clock-in ships in v1). EAS can do this automatically on the first `eas build -p ios --profile production` if you let it manage credentials.
- ⬜ App Store Connect → New App: name "Loqzen" (or "Loqzen: Shift & Time Clock" if "Loqzen" is taken — max 30 chars), primary language, bundle ID `com.loqzen.mobile`, SKU.
- ⬜ Apple-App-Site-Association file hosted at `https://t.loqzen.com/.well-known/apple-app-site-association` with the Team ID + bundle ID (needed for the NFC tag links `t.loqzen.com/t/...`).
- ⬜ App Privacy ("nutrition label"). Based on the code, the app collects: name, email, phone (contact info); precise location (at clock-in/out only); photos (clock-in photo, daily-report photos); user ID; device push token. Linked to the user, used for App Functionality. Not used for tracking. Confirm against analytics/crash SDKs before answering.
- ⬜ Privacy policy URL and support URL (`[[SUPPORT_URL]]`).
- ⬜ Age rating questionnaire (expected 4+).
- ⬜ Category: Business (secondary: Productivity).
- ⬜ Screenshots: 6.9" iPhone (1320×2868 or 1290×2796) required. **`supportsTablet` is `true`, so 13" iPad screenshots are also required** — or set `supportsTablet: false` if the phone app should not be offered on iPad (the kiosk covers iPad).
- ⬜ Description, keywords, promotional text (EN; add ES localization if launching in Spanish markets).
- ⬜ Review notes: demo login, explain that location is captured only at clock-in/out, explain NFC tags and that an employer account is required.
- ⬜ `eas build -p ios --profile production` → `eas submit -p ios --profile production` → TestFlight internal test → submit for review.

## 4. Google — Play Console (William)

- ⬜ Google Play developer account (organization; D-U-N-S required for new org accounts). New personal accounts must run a 14-day closed test with 12+ testers before production — an organization account avoids that.
- ⬜ Create app "Loqzen", default language, App, Free.
- ⬜ Enroll in **Play App Signing** (default). Keep the EAS-managed upload key; download a backup with `eas credentials`.
- ⬜ Digital Asset Links: host `https://t.loqzen.com/.well-known/assetlinks.json` with the **Play App Signing** SHA-256 fingerprint so the `autoVerify` intent filter works.
- ⬜ Service account with "Release manager" permission → JSON key → `ShiftWork.Mobile/secrets/google-play-service-account.json`.
- ⬜ App content: privacy policy URL, **Data safety** form (same data as the Apple label; data encrypted in transit; deletion request URL `[[ACCOUNT_DELETION_URL]]`), ads = no, target audience 18+, content rating questionnaire, government/financial/health = no.
- ⬜ Store listing: short description (80 chars), full description, 512×512 icon (export `scripts/assets/icon.svg`), 1024×500 feature graphic, phone screenshots (min 2), 7" and 10" tablet screenshots if offering on tablets.
- ⬜ Location permission: the app now requests foreground location only, so no background-location declaration or video is needed. Keep it that way.
- ⬜ `eas build -p android --profile production` → `eas submit -p android --profile production` (internal track, draft) → promote to closed/production.

## 5. Final artwork to supply (William / designer)

| Asset | Size | Notes |
|---|---|---|
| `assets/icon.png` | 1024×1024 | No transparency, no rounded corners (stores round it) |
| `assets/adaptive-icon.png` | 1024×1024, transparent | Logo inside the central 66% (safe zone); background color is `android.adaptiveIcon.backgroundColor` |
| `assets/splash.png` | 1284×2778 | Shown with `resizeMode: cover`; keep the logo centered |
| `assets/notification-icon.png` | 96×96, white on transparent | Android status-bar icon must be monochrome |
| `assets/favicon.png` | 48×48 | Web build only |
| Play feature graphic | 1024×500 | Store listing only |

Brand color used today: `#1A6B47` (from the landing site). If the brand color changes, update `splash.backgroundColor`, `android.adaptiveIcon.backgroundColor` and the `expo-notifications` `color` in `app.json`.

## 6. Every release after the first

1. Bump `expo.version` in `app.json` for user-visible releases (build numbers auto-increment on EAS).
2. `eas build --profile production --platform all`
3. `eas submit --profile production --platform all`
4. Update "What's new" text in both stores.
