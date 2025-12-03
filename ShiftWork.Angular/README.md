# ShiftWork.Angular

This document covers kiosk wake lock, PWA considerations, and quick type-check/build steps for the Angular app.

**Kiosk Wake Lock**
- **Purpose:** Prevents the device screen from sleeping during kiosk use.
- **Requirements:** Wake Lock API works only over HTTPS and with user interaction.
- **Indicators:** UI badges show `Screen Locked` when active, `Screen May Sleep` otherwise.

**Quick Type Check**
- **Build:** Run a fast Angular build to verify templates and types.

```
PowerShell
Push-Location "C:\projects\BaseShiftWork\ShiftWork.Angular"
npm run build
Pop-Location
```

**Serve Over HTTPS (for camera + wake lock)**
- **Why:** Browser camera and Wake Lock require secure context (HTTPS).
- **Option A: ng serve with local cert**

```
PowerShell
Push-Location "C:\projects\BaseShiftWork\ShiftWork.Angular"
ng serve --ssl true --ssl-key ".\ssl\localhost.key" --ssl-cert ".\ssl\localhost.crt"
Pop-Location
```

- **Certs:** Place a trusted key/cert pair in `ShiftWork.Angular\ssl`. You can generate local certs with tools like `mkcert` (recommended) or reuse existing dev certs. Import the root CA so the browser trusts `localhost`.

**PWA Notes**
- Installable manifest and service worker are configured.
- API POST endpoints should not be cached; ensure network is available for clock-in/out and S3 uploads.

**Troubleshooting**
- If wake lock fails, verify HTTPS and user interaction (e.g., clicking a button).
- On unsupported devices/browsers, the UI shows `Wake Lock Unsupported` and the app will proceed without locking.
- CommonJS warning for `ngrx-store-persist` is non-blocking and safe to ignore for development builds.
