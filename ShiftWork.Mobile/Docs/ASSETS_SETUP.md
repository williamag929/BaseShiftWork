# App Icon & Splash Assets

The PNGs in `assets/` are the **interim Loqzen mark** (white "L" on brand green `#1A6B47`, matching the landing-site favicon). Their SVG sources live in `scripts/assets/`.

| File | Size | Rules |
|---|---|---|
| `assets/icon.png` | 1024×1024 | Opaque (no alpha), square corners |
| `assets/adaptive-icon.png` | 1024×1024 | Transparent; logo inside the central 66% safe zone |
| `assets/splash.png` | 1284×2778 | `resizeMode: cover`, logo centered |
| `assets/notification-icon.png` | 96×96 | White on transparent (Android status bar) |
| `assets/favicon.png` | 48×48 | Web only |

To replace with final artwork, overwrite the PNGs at the same sizes (and update the SVG sources). If the brand color changes, also update `splash.backgroundColor`, `android.adaptiveIcon.backgroundColor` and the `expo-notifications` `color` in `app.json`.

Store-submission steps: see `Docs/STORE_SUBMISSION_CHECKLIST.md` at the repo root.
