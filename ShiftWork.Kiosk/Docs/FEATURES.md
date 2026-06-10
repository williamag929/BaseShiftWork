# ShiftWork Kiosk — Features & Architecture

> **App**: ShiftWork Kiosk (`com.shiftwork.kiosk`)  
> **Version**: 1.0.0  
> **Platform**: Expo ~54 · React Native 0.81.5 · Expo Router ~6  
> **Orientation**: Landscape-only (tablet / wall-mount)

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Design System — Apple HIG](#design-system--apple-hig)
4. [User Flows](#user-flows)
5. [Screen Reference](#screen-reference)
6. [Component Library](#component-library)
7. [State Management](#state-management)
8. [API Surface](#api-surface)
9. [Device Permissions](#device-permissions)
10. [Utilities](#utilities)
11. [Domain Types](#domain-types)

---

## Overview

ShiftWork Kiosk is a shared, always-on tablet app used at physical work locations. Employees walk up, find themselves in the employee list, enter a PIN, and clock in or out — with an optional pre-clock survey and photo capture. The device is enrolled once by an admin and persists its company/location identity across reboots via encrypted secure storage.

**Key characteristics**:
- Single shared device, many employees
- Landscape-locked for wall/counter mount
- New Architecture enabled (`newArchEnabled: true`)
- Per-transaction state is fully reset after each successful clock event
- Admin panel protected by a separate admin password (not a worker PIN)

---

## Tech Stack

| Layer | Package | Version |
|-------|---------|---------|
| Framework | `expo` | ~54.0.33 |
| React Native | `react-native` | 0.81.5 |
| Routing | `expo-router` | ~6.0.23 |
| Language | TypeScript | 5.3 (strict) |
| State | `zustand` | 4.4 |
| Server state | `@tanstack/react-query` | 5.8 |
| Lists | `@shopify/flash-list` | 2.0.2 |
| Animations | `react-native-reanimated` | 3.16 |
| Secure storage | `expo-secure-store` | — |
| Camera | `expo-camera` | — |
| Location | `expo-location` | — |
| Icons | `@expo/vector-icons` (Ionicons) | — |

---

## Design System — Apple HIG

All visual tokens live in [`styles/tokens.ts`](../styles/tokens.ts). The system uses an OLED-first Apple Human Interface Guidelines palette.

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#000000` | Screen & header backgrounds (OLED black) |
| `surface` | `#1C1C1E` | Cards, list items (iOS grouped background) |
| `surfaceSecondary` | `#2C2C2E` | Elevated cards, input fields |
| `primary` | `#0A84FF` | Primary actions, active avatar ring, focus |
| `primaryLight` | `rgba(10,132,255,0.15)` | Selected answer tint |
| `success` | `#30D158` | "On Shift" badge, success screen, clock-in confirmation |
| `error` | `#FF453A` | Errors, clock-out accent |
| `warning` | `#FF9F0A` | Cautionary states |
| `textPrimary` | `#FFFFFF` | Headlines, primary labels |
| `textSecondary` | `rgba(235,235,245,0.6)` | Sub-labels, secondary metadata |
| `textTertiary` | `rgba(235,235,245,0.3)` | Placeholders, disabled text |
| `separator` | `rgba(84,84,88,0.36)` | Dividers, header border (hairline 0.5pt) |
| `glass` | `rgba(44,44,46,0.92)` | Frosted-glass card backgrounds |
| `glassBorder` | `rgba(255,255,255,0.08)` | Frosted-glass card borders |

### Typography Scale

| Token | Size | Weight | Letter Spacing | Usage |
|-------|------|--------|----------------|-------|
| `largeTitle` | 34 | 700 | +0.37 | Page heroes |
| `title1` | 28 | 700 | +0.36 | Primary headings |
| `title2` | 22 | 700 | +0.35 | Section titles |
| `title3` | 20 | 600 | +0.38 | Card titles |
| `body` | 17 | 400 | −0.41 | Body copy |
| `callout` | 16 | 400 | −0.32 | Supporting body |
| `subheadline` | 15 | 400 | −0.24 | Labels |
| `footnote` | 13 | 400 | −0.08 | Captions, countdown |
| `caption` | 12 | 400 | 0 | Fine print |

### Shadow Levels

| Token | Offset Y | Blur | Opacity | Usage |
|-------|----------|------|---------|-------|
| `shadow.small` | 1 | 2 | 0.15 | Subtle lift |
| `shadow.medium` | 4 | 8 | 0.25 | Cards, modals |
| `shadow.large` | 8 | 16 | 0.35 | Overlays |
| `shadow.subtle` | 2 | 6 | 0.20 | List items |

### Spacing & Radius

- Spacing scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64` (tokens `spacing.xs`–`spacing.xxxl`)
- Border radii: `small: 6`, `medium: 12`, `large: 16`, `xlarge: 20`, `full: 9999` (pill/circle)

---

## User Flows

### Normal Clock Flow (Enrolled Device)

```
(kiosk)/index  →  (kiosk)/pin  →  (kiosk)/clock  →  (kiosk)/questions  →  (kiosk)/success
Employee List      PIN Entry       Clock In/Out        Pre-clock Survey      Confirmation
                                   + Camera Capture         (optional)
```

- After **Success**, the session store is cleared and the app automatically returns to the Employee List after a countdown (≈5 s).
- Idle timeouts auto-navigate back: PIN screen ← 30 s, Clock screen ← 60 s.

### First-Run Setup Flow (Un-enrolled Device)

```
(setup)/index  →  (setup)/enroll
Login             Company/Location picker → saves DeviceEnrollment to SecureStore
```

### Admin Flow

```
(kiosk)/_layout  →  (admin)/index
  Admin button       Password entry → device management (reset enrollment, etc.)
```

---

## Screen Reference

### `(setup)/index` — First-Run Login

Admin logs in with email/password to begin enrollment. Calls `getUserByEmail` to verify admin status.

### `(setup)/enroll` — Device Enrollment

Displays company locations. Admin selects a location to associate with this kiosk device. On confirm, enrollment is saved to SecureStore via `deviceStore.enroll()`. Device is now permanent until reset.

---

### `(kiosk)/index` — Employee List

| Element | Detail |
|---------|--------|
| Header | Persistent layout header — see `_layout.tsx` |
| Search bar | Real-time filter with Ionicons `search` icon embedded left |
| Employee list | `FlashList` (flash-list v2 — no `estimatedItemSize`) |
| Avatar | Circular photo; outlined with `avatarRingActive` (green 2 pt) when `statusShiftWork === 'OnShift'` |
| "On Shift" badge | Tinted `success`-color label beneath name for active employees |
| Tap → PIN screen | Stores selected employee in session store, pushes `/pin` |

### `(kiosk)/pin` — PIN Entry

| Element | Detail |
|---------|--------|
| Avatar | `108×108` circle, primary-blue `avatarRing` (3 pt border) |
| Employee name | `title2` weight |
| Instruction label | `footnote` size, uppercase, tracking `+2` |
| PIN indicator | 4 dots — filled on digit entry |
| PinPad component | iOS-style circular keys (see [PinPad](#pinpad)) |
| Idle timeout | 30 s → auto-returns to Employee List |
| On success | Pushes `/clock` |
| On failure | Shake animation + error message |

### `(kiosk)/clock` — Clock Choice + Camera

| Element | Detail |
|---------|--------|
| Clock In button | `220×190` card, sub-label "Start your shift", primary (`#0A84FF`) fill |
| Clock Out button | `220×190` card, sub-label "End your shift", destructive (`#FF453A`) fill |
| Camera viewfinder | Oval overlay on live `CameraView`, positioned center-right |
| Capture button | Semi-transparent border ring, `36×36` circle icon |
| Auto-capture | Photo captured upon Clock In/Out button tap if camera available |
| Idle timeout | 60 s → auto-returns to Employee List |
| On confirm | Stores `clockType` + `capturedPhotoUri` in session; if questions exist → `/questions`, else → submits directly |

### `(kiosk)/questions` — Pre-Clock Survey

| Element | Detail |
|---------|--------|
| Question cards | `glass`/`glassBorder` frosted card per question |
| Yes/No | Two buttons; selected state uses `primaryLight` tint background |
| Text input | Single-line, dark surface field |
| Multiple choice | Tappable options with `primaryLight` selected tint |
| Submit | Pill button (`borderRadius: full`), primary fill, full-width |
| Required fields | Enforced client-side before submit |

### `(kiosk)/success` — Confirmation

| Element | Detail |
|---------|--------|
| Animated checkmark | Reanimated fade + scale in |
| Event time | `48px` fontWeight `200` — captured at screen mount via `useState(() => new Date().toLocaleTimeString())` |
| Employee name | `title1` |
| Clock type label | Clock In / Clock Out text |
| Countdown | `footnote` style, counts down before auto-return to Employee List |
| Auto-return | Navigates to `/` after countdown, resets session store |

### `(kiosk)/_layout` — Persistent Header

| Element | Detail |
|---------|--------|
| Background | `colors.background` (pure OLED black) |
| Bottom border | `0.5 pt` hairline, `colors.separator` |
| Left | App name / location name |
| Center | Live clock |
| Right | Admin button → `/(admin)` |

### `(admin)/index` — Admin Panel

Admin-password-protected screen. Allows device reset (calls `deviceStore.resetDevice()` → clears SecureStore enrollment → redirects to setup).

---

## Component Library

### PinPad

**File**: [`components/ui/PinPad.tsx`](../components/ui/PinPad.tsx)

iOS passcode-style PIN entry pad — reusable across kiosk and admin screens.

**Props**:

| Prop | Type | Description |
|------|------|-------------|
| `value` | `string` | Current PIN string (max 4 digits) |
| `onChange` | `(v: string) => void` | Called on each digit tap |
| `onSubmit` | `() => void` | Called when 4th digit is entered |

**Key UI details**:
- Keys are `82×82` circles (`borderRadius: full`)
- Each key has a digit label + sub-label row (ABC, DEF, GHI, JKL, MNO, PQRS, TUV, WXYZ)
- Key 1 has no sub-label; `0` shows `+`
- `AnimatedKey` component: each press triggers `useSharedValue` scaled from `1.0 → 0.85 → 1.0` via `withSpring`
- Delete key shows `⌫` (backspace icon)
- Colors: key background `colors.surfaceSecondary`, text `colors.textPrimary`

---

## State Management

Two Zustand stores manage kiosk state. No Redux; no context providers.

### `deviceStore` — Persistent Enrollment State

**File**: [`store/deviceStore.ts`](../store/deviceStore.ts)

Persisted to `expo-secure-store` under key `kiosk_device_enrollment`. Survives app restarts.

| Field | Type | Description |
|-------|------|-------------|
| `isEnrolled` | `boolean` | Whether device has been enrolled |
| `companyId` | `string \| null` | Enrolled company ID |
| `locationId` | `number \| null` | Enrolled location ID |
| `locationName` | `string \| null` | Human-readable location name |
| `kioskDeviceId` | `string \| null` | Unique device identifier |

| Action | Effect |
|--------|--------|
| `enroll(enrollment)` | Sets all fields, saves to SecureStore |
| `resetDevice()` | Clears all fields, deletes SecureStore key |
| `loadFromStorage()` | Reads SecureStore on app boot, hydrates store |

### `sessionStore` — Transient Per-Transaction State

**File**: [`store/sessionStore.ts`](../store/sessionStore.ts)

In-memory only. Reset to initial state after each successful clock submission.

| Field | Type | Description |
|-------|------|-------------|
| `employee` | `KioskEmployee \| null` | Selected employee for this clock event |
| `clockType` | `ClockEventType \| null` | `'ClockIn'` or `'ClockOut'` |
| `capturedPhotoUri` | `string \| null` | Local URI of the camera-captured photo |
| `geoLocation` | `string \| null` | Stringified `{ lat, lon }` if location granted |
| `needsClockSubmit` | `boolean` | Flag for post-question auto-submit |

| Action | Effect |
|--------|--------|
| `setEmployee(e)` | Stores selected employee |
| `setClockType(t)` | Stores clock direction |
| `setPhoto(uri)` | Stores captured photo URI |
| `setGeoLocation(g)` | Stores location string |
| `reset()` | Clears all fields back to null/false |

---

## API Surface

**File**: [`services/kiosk.service.ts`](../services/kiosk.service.ts)

All methods are plain `async` functions (no class). The base URL is read from `EXPO_PUBLIC_API_URL`.

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `getUserByEmail(email)` | GET | `/api/auth/user/:email` | Verify admin during setup login |
| `getEmployees(companyId)` | GET | `/api/kiosk/:id/employees` | Fetch employee list for the enrolled company |
| `getQuestions(companyId)` | GET | `/api/kiosk/:id/questions` | Fetch active pre-clock survey questions |
| `getLocations(companyId)` | GET | `/api/companies/:id/locations` | Fetch available locations for enrollment |
| `verifyPin(personId, pin)` | POST | `/api/auth/verify-pin` | Validate employee PIN before clocking |
| `verifyAdminPassword(companyId, password)` | POST | `/api/kiosk/:id/verify-admin-password` | Validate admin panel access |
| `clock(companyId, request)` | POST | `/api/kiosk/:id/clock` | Submit clock event with answers + photo |

**Clock request shape** (`KioskClockRequest`):

```typescript
{
  personId: number;
  eventType: 'ClockIn' | 'ClockOut';
  locationId?: number;
  photoUrl?: string;       // S3 URL after upload, or omitted
  geoLocation?: string;   // '{"lat":0,"lon":0}'
  kioskDevice: string;    // deviceStore.kioskDeviceId
  answers?: KioskAnswer[];
}
```

---

## Device Permissions

| Permission | Platform | Purpose |
|-----------|----------|---------|
| `NSCameraUsageDescription` | iOS | Clock-in photo capture |
| `NSLocationWhenInUseUsageDescription` | iOS | Site-presence verification |
| `CAMERA` | Android | Clock-in photo capture |
| `ACCESS_FINE_LOCATION` | Android | Site-presence verification |
| `WAKE_LOCK` | Android | Keep screen on while in kiosk mode |

---

## Utilities

### `utils/storage.ts`

Thin wrappers around `expo-secure-store` for the device enrollment record.

| Function | Description |
|----------|-------------|
| `saveEnrollment(e)` | Serializes `DeviceEnrollment` → JSON → SecureStore |
| `loadEnrollment()` | Reads SecureStore → deserializes, or returns `null` |
| `clearEnrollment()` | Deletes the SecureStore key |

Key: `kiosk_device_enrollment`

### `utils/logger.ts`

Dev-only logging guard — all `console.*` output is suppressed in production builds.

```typescript
logger.log(...)   // console.log in __DEV__
logger.warn(...)  // console.warn in __DEV__
logger.error(...) // console.error in __DEV__
```

---

## Domain Types

**File**: [`types/index.ts`](../types/index.ts)

| Type | Description |
|------|-------------|
| `KioskEmployee` | `personId`, `name`, `photoUrl?`, `statusShiftWork?` |
| `KioskQuestion` | Question with `questionType: 'text' \| 'yes_no' \| 'multiple_choice'` |
| `KioskAnswer` | `kioskQuestionId` + `answerText` pair |
| `KioskLocation` | Location with `locationId`, `companyId`, `name`, `isActive` |
| `ClockEventType` | `'ClockIn' \| 'ClockOut'` |
| `KioskClockRequest` | Full clock POST body |
| `KioskClockResponse` | Clock response: `eventLogId`, `eventType`, `eventDate`, `personName` |
| `DeviceEnrollment` | SecureStore-persisted device identity |
| `KioskUserProfile` | Admin user returned by `/api/auth/user/:email` |
| `KioskSession` | In-memory session snapshot |

---

## Changelog

| Version | Change |
|---------|--------|
| 1.0.0 | Initial release — Apple HIG dark UI, iOS-style PinPad, OLED palette, Reanimated animations, flash-list v2 compatibility |
