# NFC Jobsite Punch — Design

Date: 2026-09-30
Status: Draft, awaiting review

## Goal

Let an employee clock in or out by tapping their own phone on an NFC tag installed at a jobsite (Location). The tap is an automatic In/Out with no photo. It is optional per Location: a Location can also *require* NFC, in which case the normal clock button on the phone cannot be used for that site.

Success criteria:
- At an NFC site, tapping the tag records the punch and shows "Clocked IN/OUT" with a 3 s Undo, in a few seconds, on both iPhone and Android.
- At a Location with `RequireNfc` on, a phone punch that did not come from a tag tap is rejected by the server, not just hidden in the UI.
- Locations without NFC behave exactly as today.

## Decisions (agreed with William)

- Trust model: **tag + GPS** (option A). The tag proves nothing by itself (a passive tag can be copied); the server checks the phone's GPS against the Location geofence (`RatioMax`) using the existing geofence logic. An out-of-range or GPS-less punch is **recorded and flagged**, never refused.
- NFC is optional per Location (`RequireNfc`, default false). Existing sites are unchanged.
- One tag per Location; the tag identifies the site.
- A tap is an automatic In/Out from the employee's current status. No photo, no PIN.
- Must work on iOS and Android.
- No QR fallback in this version (NFC only).
- Managers write tags from a "Write tag" screen in the Mobile app; a free third-party NFC-writer app is the documented backup.

## Out of scope

QR fallback, rotating one-time-code tags, crew punch (one person taps for many), offline queue (see Open items), manager UI beyond the Angular location form and the Mobile "Write tag" screen.

## 1. Data and API

### Database (one EF migration)
- `Location.RequireNfc` bool, default `false`.
- `Location.NfcTagKey` string, nullable, unique index. A random, URL-safe secret (at least 128 bits) generated the first time NFC is enabled and on Regenerate.
- `Location.NfcLastTappedAt` datetime, nullable, updated on each accepted tap.
- Hand-check the migration: new bool default false is correct here (unlike `RequirePin`); verify the table is `Locations`; the Designer needs `using Microsoft.EntityFrameworkCore.Migrations;`.

### Tag content
An NDEF URI record: `https://<nfc-domain>/t/<tagKey>` (domain to be chosen, see Open items). The link is not secret; the key only maps to a site.

### Endpoints
- `POST /api/companies/{companyId}/nfc-punch` (employee login, policy like `shift-events.create`).
  Body: `tagKey`, `eventLogId` (client Guid), `eventDate` (tap time, UTC), optional `geoLocation` ("lat,lng").
  Server: look up the Location by `tagKey` within `companyId` (unknown key or other company: 404 with no information about other tenants); pick `ClockIn`/`ClockOut` from the employee's status; create the ShiftEvent through the existing `ShiftEventService` path with `LocationId` set so the existing geofence logic sets `GeofenceStatus`; update `NfcLastTappedAt`. Idempotent on `eventLogId` (same id returns the original result, another person's id returns 409), same date window as kiosk `/clock` (7 days back, 5 minutes forward).
  Response: the event, the resolved Location name, and `eventType`.
- Enforcement: a self-service phone punch (the employee punching for themself through `POST /shiftevents`) at a Location with `RequireNfc = true` is rejected with a clear error code (`NFC_REQUIRED`). Punches entered by managers on someone's behalf (timesheet edits) and kiosk punches are unaffected.
- Location admin endpoints: `POST /api/companies/{companyId}/locations/{id}/nfc-tag/regenerate` (permission like location update) returns the new key; the location DTOs expose `requireNfc`, `nfcTagKey` and `nfcLastTappedAt`.
- A public, unauthenticated `GET /t/<tagKey>` page on the tag domain serves the app-link association files and a friendly "open the Loqzen app" fallback page for phones without the app.

## 2. Angular admin (Location form)

- "Require NFC" toggle next to Require PIN and Require photo.
- When on: read-only tag link with a Copy button; a "Regenerate" button with a confirmation dialog (the old link stops working immediately); "Last tapped: <date>" (empty if never).
- Tag key is created automatically the first time NFC is enabled.
- New strings in `messages.xlf` and `messages.es.xlf`.

## 3. Mobile app

### Tap flow
- Touching a tag opens the app straight into the punch on Android and on iPhone XS and later (universal link / app link with the app closed). The app reads the tag key, takes one GPS fix (cached last fix if fresh), sends `nfc-punch`, and shows a full-screen "Clocked IN/OUT, 7:02" with haptic feedback and a 3 s Undo. Undo cancels the punch server side (or is held client side for the 3 s; decided in the plan, mirroring the kiosk hold).
- If the employee is not signed in, the app asks them to sign in, then completes the punch from the stored tag key.
- An in-app "Tap tag" button on the clock screen starts an NFC scan (`react-native-nfc-manager`) for phones that cannot launch from a tap.

### Clock screen by site type
- Normal site: unchanged.
- `RequireNfc` site: the button reads "Tap the NFC tag at <site> to clock in/out"; the manual button is hidden (and the server rejects it).
- Phone with no NFC: cannot punch at a `RequireNfc` site; shows a clear message to use the kiosk or ask a manager.

### Write tag (managers)
A manager-only screen: choose a Location, hold a blank tag to the phone, the app writes the NDEF URI and can lock it read-only. iOS and Android both supported by the NFC library.

### Errors
- Unknown tag, wrong company: clear error, nothing recorded.
- Location services off or weak GPS: the punch is recorded with `GeofenceStatus = Unknown` and flagged for manager review.

## 4. Testing

- API (`ShiftWork.Api.Tests`): tag lookup and tenant scoping, In/Out selection, idempotency, date window, geofence flag, `NFC_REQUIRED` enforcement (and not for manager or kiosk punches), tag regenerate invalidates the old key, migration defaults.
- Mobile (Jest): tap handler and screen state by site type, error paths.
- Angular: builds, form persists the fields.
- Manual on real devices (an NFC-capable Android and an iPhone XS or later plus an older iPhone): needs a development build, since Expo Go cannot use NFC.

## Open items to settle before building

1. **Tag domain.** iPhone background tag reading and Android app links need an https domain we control, with the Apple association file and the Android `assetlinks.json` served from it, and the mobile config (`associatedDomains`, intent filters) set to match. Nothing is configured today (only the `loqzen://` scheme). Which domain?
2. **Offline taps.** Tap when the phone has no signal: queue and send later like the kiosk outbox, or fail with a clear message in the first version? Recommended: first version fails with a clear message; queueing follows.
3. **Undo mechanism** for phone punches (client hold as on the kiosk versus server cancel).
4. **How the server tells a self-service phone punch from a manager entry** for the `NFC_REQUIRED` rule, resolved when reading `ShiftEventsController`.
5. **Mobile build:** adding `react-native-nfc-manager` needs a development/EAS build with the NFC entitlement on iOS and the permission on Android.
