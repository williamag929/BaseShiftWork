# NFC jobsite tags: setup and rollout

Tags hold the link `https://t.loqzen.com/t/<tagKey>`. Tapping it opens the Loqzen app and clocks the
employee in or out at that site. The API serves everything on `t.loqzen.com`.

## 1. Tag host (one-time)

1. DNS: add `t.loqzen.com` pointing at the same server as `api.loqzen.com`.
2. TLS: a certificate covering `t.loqzen.com` (or a wildcard `*.loqzen.com`).
3. Reverse proxy: route `t.loqzen.com` to the API container, like `api.loqzen.com`. The paths used are
   `/.well-known/apple-app-site-association`, `/.well-known/assetlinks.json` and `/t/*`.
4. API settings (`NfcTags` section, or environment variables `NfcTags__AppleTeamId`,
   `NfcTags__AndroidCertFingerprints__0`, `NfcTags__AppStoreUrl`, `NfcTags__PlayStoreUrl`):
   - `AppleTeamId`: 10-character Team ID from developer.apple.com → Membership.
   - `AndroidCertFingerprints`: SHA-256 of the **release** signing certificate, like `AB:CD:...`.
     From `eas credentials -p android` (keystore SHA256), and if Google Play App Signing is on, **also**
     the "App signing key certificate" SHA-256 from Play Console → Setup → App integrity. List both.
   - `AppStoreUrl` / `PlayStoreUrl`: store links shown on the page for phones without the app.
5. Check. Each must answer `200` with no redirect:
   curl -sI https://t.loqzen.com/.well-known/apple-app-site-association
   curl -sI https://t.loqzen.com/.well-known/assetlinks.json
   curl -sI https://t.loqzen.com/t/test
   Apple caches the file through its CDN, so also check
   `https://app-site-association.cdn-apple.com/a/v1/t.loqzen.com` (can take a few hours to refresh).

Fallback if a new host is not wanted: point the same three paths at `api.loqzen.com` and change the host
in `ShiftWork.Api/Helpers/NfcTagKeys.cs`, `ShiftWork.Mobile/utils/nfcTag.ts`,
`ShiftWork.Mobile/app.json` (associatedDomains and intent filter), `ShiftWork.Mobile/plugins/withNfcTagIntent.js`
and `ShiftWork.Angular/.../locations.component.ts`.
