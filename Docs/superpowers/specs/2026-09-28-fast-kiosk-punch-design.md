# Fast Kiosk Punch — Design

Date: 2026-09-28
Status: Draft, awaiting review

## Goal

Cut the kiosk clock-in time per person from about 15–20 seconds to about 2–3 seconds at sites that don't need a PIN or photo, so that ~30 employees arriving together clear in about a minute. Sites that need a PIN or photo keep them, with fewer wasted steps.

Success criteria:
- At a site with PIN off and photo off, an employee taps their name and the punch is recorded; the kiosk is ready for the next person in about 3 seconds or less.
- The kiosk keeps working with no internet; punches sync later with their real tap time and never duplicate.
- Punch photos are actually stored (today the tablet's local `file://` path is saved and the image is never uploaded).

## Decisions (agreed with William)

- "Project" means **Location**: the site a kiosk is enrolled to. Settings are per Location.
- Employee exemption: a per-employee `PhotoExempt` flag skips the photo at every site. There is no per-employee PIN exemption; PIN is a site-level decision.
- After tapping a name at a no-PIN/no-photo site the punch records immediately, with In/Out auto-picked from the employee's current status and a ~3 second **Undo**.
- Offline: punches queue on the tablet and sync automatically, capped at 200 punches or 24 hours.
- Kiosk questions appear only after a **clock-out**.
- Switches are typed columns on `Location` and `Person`, not the free-form `Location.Settings` JSON.

## Out of scope

NFC/QR badge identification, crew punch (foreman punches many), and any manager UI for failed punches beyond the sync badge and cap warning. Each gets its own spec.

## 1. Data and API

### Database (one EF migration)
- `Location.RequirePin` bool, default `true`.
- `Location.RequirePhoto` bool, default `true`.
- `Person.PhotoExempt` bool, default `false`.
- Existing sites behave exactly as today. The company-wide `CompanySettings.RequirePhotoOnClockIn` is unchanged; the kiosk uses the Location setting instead.

### API
- New `GET /api/kiosk/{companyId}/config?locationId=` returns `{ requirePin, requirePhoto, questionsOnClockOutOnly: true }`. The kiosk fetches it at startup and with each 45 s employee refresh.
- `GET /api/kiosk/{companyId}/employees` adds `photoExempt` per person.
- `POST /api/kiosk/{companyId}/clock` accepts a client-generated `eventLogId` and a client `eventDate`.
  - A repeated `eventLogId` returns the original result and creates no second event.
  - `eventDate` must be no more than 7 days in the past and not in the future; otherwise 400.
- The server rejects a PIN-less punch when the Location has `RequirePin = true` (no bypass by calling the API directly). Where `RequirePin = false`, the kiosk skips `verify-pin`.
- A photo upload endpoint stores the image in S3 (same pattern as `AwsS3BucketController`) and returns its URL. The punch stores that URL, not a local path.

### Angular admin
- Location form: two toggles, "Require PIN" and "Require photo".
- Employee profile: "No photo required" checkbox.

## 2. Kiosk flow

After tapping a name:

| Site PIN | Photo needed* | Steps |
|---|---|---|
| Off | No | Punch recorded, success screen with Undo |
| Off | Yes | Auto-capture camera, then success |
| On | No | PIN, then success |
| On | Yes | PIN, camera, then success |

*Photo needed = Location `RequirePhoto` is on and the employee is not `PhotoExempt`.

- The Clock In / Clock Out choice screen is removed. In/Out comes from `statusShiftWork`.
- The success screen shows "Clocked IN — Maria, 7:02" for ~3 s with **Undo**, then returns home (was a 5 s countdown).
- Questions show only on a clock-out that has active questions. They come after the PIN/photo steps and before the punch is enqueued, so the answers travel with the punch; Undo then applies from the success screen as usual. The post-clock-out interstitial (bulletins and safety) is unchanged.
- The camera button is replaced by a 1 s countdown and automatic capture.
- GPS is fetched once at startup and refreshed every few minutes; each punch uses the last known fix instead of a per-punch lookup.

## 3. Offline outbox

- New `ShiftWork.Kiosk/services/outbox.service.ts` with a persistent queue. Each entry: `eventLogId`, `personId`, `eventType`, `eventDate` (real tap time), `geoLocation`, `answers`, optional local photo path, status (`pending` | `sending` | `failed`).
- Flow: tap, enqueue, show success. A background worker sends oldest first whenever online, retrying with backoff. Screens never wait on the network.
- Photo first, then punch. If the photo upload fails permanently, the punch is sent without a photo and flagged, so a bad photo never loses the time record.
- Undo removes the entry from the queue during the ~3 s hold. Afterwards the punch is committed; corrections are a manager edit, as today.
- Cap: 200 punches or 24 hours. Past the cap the admin screen warns; nothing is dropped silently. If device storage is full, the kiosk shows a blocking error.
- The admin screen shows a "N waiting to sync" badge, hidden when the queue is empty.
- The kiosk updates each employee's In/Out status locally on enqueue, so auto In/Out stays correct while offline.

## 4. Error handling

- Network errors and 5xx: retry with backoff. Duplicate `eventLogId`: treated as success. Other 4xx (person not found, PIN-less punch not allowed, bad date): mark `failed`, show to the admin, do not retry forever.
- Config fetch fails: use the last cached config; with no cache, fall back to strict defaults (PIN and photo required).
- Stale local status causing the wrong In/Out: the server records what the kiosk sent; a manager corrects it in the timesheet.

## 5. Testing

- API (`ShiftWork.Api.Tests`): new DTO fields, config endpoint, idempotent `/clock`, PIN-less punch rejected where `RequirePin` is on, client `eventDate` accepted within the window and rejected outside it, photo upload stores and returns a URL.
- Kiosk (Jest, same style as `services/__tests__/interstitial.service.test.ts`): flow decision for all four cases, outbox enqueue/undo/retry order/cap/duplicate handling, questions only on clock-out.
- Manual on a tablet: a no-PIN/no-photo site, airplane mode, a 30-punch burst.
