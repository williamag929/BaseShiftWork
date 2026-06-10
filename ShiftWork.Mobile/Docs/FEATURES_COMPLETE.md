# ShiftWork Mobile - Completed Features Reference

**Last Updated:** April 21, 2026

## ✅ Completed Features

### 1. Clock In/Out with Photo & GPS
- **Location:** `app/(tabs)/clock.tsx`
- **Service:** `services/shiftEvent.service.ts`, `services/upload.service.ts`
- **Features:**
  - Personal clock in/out from mobile device
  - Photo capture with camera
  - GPS location tracking
  - Automatic S3 upload with Firebase auth
  - Elapsed time counter
  - Optimistic state updates

### 2. Weekly Schedule View
- **Location:** `app/(tabs)/weekly-schedule.tsx`
- **Service:** `services/schedule.service.ts`
- **Features:**
  - 7-day calendar grid (Sunday-Saturday)
  - Week navigation (previous/next/current)
  - Total hours and days scheduled
  - Today highlighting
  - Shift details (time, duration, notes, status)
  - Real-time updates with 5-minute polling
  - Visual sync indicator
  - Pull-to-refresh

### 3. Dashboard with Stats & Time Off
- **Location:** `app/(tabs)/dashboard.tsx`
- **Service:** `services/timeOffRequest.service.ts`
- **Features:**
  - Shift statistics (hours today/week/month)
  - Upcoming shifts list
  - Time off requests (pending/upcoming)
  - Status badges (Approved/Denied/Pending)
  - Real-time updates with 3-minute polling
  - Push notification listeners
  - App state monitoring
  - Pull-to-refresh

### 4. Time Off Request Form
- **Location:** `app/(tabs)/time-off-request.tsx`
- **Service:** `services/timeOffRequest.service.ts`
- **Features:**
  - PTO balance display
  - Type selector (Vacation, Sick, PTO, Unpaid, Personal)
  - Start/End date pickers
  - Real-time hours estimation
  - Business days calculation
  - Form validation
  - Success/error handling

### 5. Profile Management
- **Location:** `app/(tabs)/profile.tsx`
- **Service:** `services/people.service.ts`
- **Features:**
  - View personal information
  - Edit mode for profile details
  - Update name, email, phone number
  - Change 4-digit PIN with validation
  - Biometric authentication toggle
  - Sign out with confirmation
  - Pull-to-refresh

### 6. Biometric Authentication
- **Location:** `app/(auth)/login.tsx`, `app/(tabs)/profile.tsx`
- **Service:** `services/biometricAuth.service.ts`
- **Documentation:** `BIOMETRIC_AUTH.md`
- **Features:**
  - Face ID / Fingerprint / Iris support
  - Auto-prompt on app launch
  - Secure credential storage (SecureStore)
  - Enable/disable in profile settings
  - Device capability detection
  - Graceful fallback to password
  - Authentication required to enable

### 7. Push Notifications
- **Location:** `app/_layout.tsx`, `hooks/useNotifications.ts`
- **Service:** `services/notification.service.ts`
- **Documentation:** `PUSH_NOTIFICATIONS.md`
- **Features:**
  - Permission handling (iOS/Android)
  - Expo push token registration
  - Device token management
  - Foreground notification display
  - Deep linking by notification type
  - Cold start notification handling
  - Badge count management

### 8. Real-time Updates
- **Implementation:** Dashboard & Weekly Schedule
- **Features:**
  - Background polling (3-5 minute intervals)
  - Push notification listeners
  - App state monitoring (foreground/background)
  - Silent refresh with visual indicators
  - Auto-refresh on app resume
  - Notification-triggered updates

### 9. Photo Upload Integration
- **Service:** `services/upload.service.ts`
- **Features:**
  - Real S3 upload (replaced stub)
  - FormData multipart upload
  - Firebase auth token injection
  - Automatic URL extraction
  - Response parsing for `{ url }` format
  - Error handling with fallback

---

## ✅ Apple iOS UI Overhaul (April 2026)

A complete redesign of all screens and UI primitives to Apple Human Interface Guidelines (iOS 17) standards.

### Design System

| File | What Changed |
|---|---|
| `styles/theme.ts` | Full iOS 17 HIG color palette — `primary: #007AFF`, `background: #F2F2F7`, `surface: #FFFFFF`, `success: #34C759`, `danger: #FF3B30`, `warning: #FF9500`, `muted: #8E8E93`, `borderOpaque: #C6C6C8` |
| `styles/tokens.ts` | Added `blur`, `gradients`, full iOS typography scale (`largeTitle` 34pt → `caption2` 11pt), `radius.lg = 13` (iOS card radius) |

### UI Primitives

| Component | Key Changes |
|---|---|
| `components/ui/Button.tsx` | Spring-scale `AnimatedPressable`, `Haptics.impactAsync(Light)`, `sm/md/lg` sizes, `minHeight: 44` hit target |
| `components/ui/Card.tsx` | `variant: 'default' \| 'grouped'`, `borderRadius: 13` |
| `components/ui/Badge.tsx` | iOS capsule style, `dot` prop, semantic fills (`rgba(52,199,89,0.14)`) |
| `components/ui/EmptyState.tsx` | 64×64 icon circle, optional `action` slot |
| `components/ui/SectionHeader.tsx` | `variant: 'grouped'` = 13pt uppercase muted (UITableView style) |
| `components/ui/PressableScale.tsx` | Spring-scale 0.97 with haptics — replaces all `TouchableOpacity` and bare `Pressable` |

### Navigation

- **`app/(tabs)/_layout.tsx`** — `TabIcon` with filled/outline Ionicons pairs; tab bar `height: 83` iOS / `60` Android; `borderTopWidth: 0.5`; systemBlue tint

### Auth Screens

| Screen | Key UI Changes |
|---|---|
| `app/(auth)/login.tsx` | `KeyboardAvoidingView` + hero banner + floating sheet (`borderTopLeftRadius: 28`); icon-prefixed inputs; `FadeInDown/FadeInUp` |
| `app/(auth)/register.tsx` | 3-step wizard with `StepDots`, reusable `Field` component, summary card |
| `app/(auth)/pin-verify.tsx` | Full iOS numpad 4×3 grid, 76×76 circular keys, 4 dot indicators, shake + `NotificationFeedbackType.Error` |
| `app/(auth)/onboarding.tsx` | Hero, sandbox card with icon row, action rows, plan card, primary CTA |

### Dashboard Screen Components

| Component | Key UI Changes |
|---|---|
| `components/screens/dashboard/DashboardHeader.tsx` | Primary blue hero; `FadeIn` greeting; online/offline pill; clock timer badge; `useSafeAreaInsets` |
| `components/screens/dashboard/WeekStatsRow.tsx` | Two `StatCard`s with `borderTopWidth: 3` accent, icon wrap circle, 26pt value |
| `components/screens/dashboard/ShiftBanner.tsx` | `PressableScale` card with `borderLeftWidth: 3`; icon circle; `FadeInDown` |
| `components/screens/dashboard/QuickActions.tsx` | Per-action color tints (success/primary/purple); 40×40 icon wrap circles; `FadeInDown` stagger; haptics |
| `components/screens/dashboard/UpcomingShiftsSection.tsx` | Date badge columns (42×42 circle); "next shift" card with primary tint border |
| `components/screens/dashboard/RecentActivitySection.tsx` | Timeline dots; iOS bottom sheet modal with handle bar; `PressableScale` pagination |
| `components/screens/dashboard/TimeOffSection.tsx` | Status badges with icon + colored text; `PressableScale` request button with `+` icon |

### Clock Screen

| File | Key UI Changes |
|---|---|
| `components/screens/clock/ElapsedTimer.tsx` | 46pt bold tabular timer; pulse pill with `rgba(52,199,89,0.14)` bg |
| `components/screens/clock/SafetyQuestionnaire.tsx` | Apple card with `borderLeftWidth: 3, borderLeftColor: warning`; 40×40 icon wrap; `checkmark-circle` checklist |
| `app/(tabs)/clock.tsx` | Primary blue hero header; status pill (on/off clock); `timerCard`; `infoCard` with icon rows; `useSafeAreaInsets` |

### Schedule Screen

- **`app/(tabs)/schedule.tsx`** — Complete rewrite: hero header + date range button; mode switcher pill row (`PressableScale` with icons for Day/Week/Month); date badge column cards; event timeline rows; iOS bottom sheet modal for range picker with handle bar and chip group

### Profile Screen

| File | Key UI Changes |
|---|---|
| `components/screens/profile/ProfileHeader.tsx` | Primary blue header; `useSafeAreaInsets`; 90×90 avatar with initials fallback + camera chip; `FadeIn` animation; `PressableScale` |
| `components/screens/profile/ProfileInfoSection.tsx` | White grouped card (`borderRadius: 13`); edit/view modes with iOS-styled inputs; `PressableScale` Edit/Save/Cancel; haptics on edit toggle |
| `components/screens/profile/SecuritySection.tsx` | Grouped card; `PressableScale` for "Change PIN" with haptics; hairline separator; consistent button row |
| `app/(tabs)/profile.tsx` | `useSafeAreaInsets`; `FadeInDown` stagger per section; sign-out as danger `PressableScale` row with icon-wrap circle; `NotificationFeedbackType.Warning` haptic |

### Conventions Enforced Across All Screens

- `useSafeAreaInsets()` on every screen root — no raw `paddingTop`
- `PressableScale` (spring 0.97) replaces all `TouchableOpacity` and bare `Pressable`
- `Haptics.impactAsync(Light)` on every tap; `Selection` on toggles; `NotificationFeedbackType` on outcomes
- `FadeIn`/`FadeInDown` entrance animations on every section mount
- Three-state pattern everywhere: loading skeleton → populated → `EmptyState` component
- No hardcoded hex values — all colors from `colors.*` in `styles/tokens.ts`
- No `Alert.alert()` in screens — `useToast()` hook only

---

## 🚧 Pending Features

### High Priority
- [ ] **Firebase Auth** — Re-enable real auth (`config/firebase.ts` mock → production)
- [ ] **Offline Support** — Cache schedules, queue events, sync when online
- [ ] **FlashList Migration** — Replace remaining `FlatList` lists (Phase 4)
- [ ] **Test Suite** — Unit + component tests for critical paths (Phase 5)

### Medium Priority
- [ ] **Cancel Time Off Requests** — Allow in-app cancellation
- [ ] **Shift Details Modal** — Tap to view full shift details
- [ ] **Schedule Filters** — Filter by location/area

### Low Priority
- [ ] **Dark Mode** — iOS adaptive color tokens already prepared in `styles/theme.ts`
- [ ] **Rich Notifications** — Images and actions
- [ ] **Notification Preferences** — Per-event settings

## 📁 Key Files

### Services
- `services/auth.service.ts` - Authentication
- `services/schedule.service.ts` - Schedule operations
- `services/shiftEvent.service.ts` - Shift events (clock in/out)
- `services/timeOffRequest.service.ts` - Time off requests
- `services/people.service.ts` - Person management
- `services/biometricAuth.service.ts` - Biometric auth
- `services/notification.service.ts` - Push notifications
- `services/upload.service.ts` - S3 photo uploads

### Screens
- `app/(auth)/login.tsx` - Login with biometric
- `app/(tabs)/dashboard.tsx` - Main dashboard
- `app/(tabs)/clock.tsx` - Clock in/out
- `app/(tabs)/weekly-schedule.tsx` - Weekly calendar
- `app/(tabs)/time-off-request.tsx` - Request form
- `app/(tabs)/profile.tsx` - Profile management

### Hooks & Utils
- `hooks/useNotifications.ts` - Notification management
- `store/authStore.ts` - Auth state (Zustand)
- `utils/storage.utils.ts` - Secure storage

## 🔧 Technical Stack

- **Framework:** React Native 0.81 + Expo SDK 54
- **Language:** TypeScript 5 (strict)
- **Routing:** Expo Router 6 (file-based)
- **State:** Zustand 4 + TanStack React Query 5
- **Animation:** `react-native-reanimated` 4.1 (`FadeIn`, `FadeInDown`, springs)
- **Gestures:** `react-native-gesture-handler` 2.28
- **Forms:** `react-hook-form` 7 + `zod` 4
- **Icons:** `@expo/vector-icons` Ionicons (filled + outline pairs)
- **Design Language:** Apple iOS 17 HIG — systemBlue `#007AFF`, grouped backgrounds, SF Pro scale
- **State:** Zustand
- **API:** Axios with Firebase Auth
- **Storage:** expo-secure-store
- **Camera:** expo-camera
- **Location:** expo-location
- **Notifications:** expo-notifications
- **Biometrics:** expo-local-authentication

## 📚 Documentation

- [README.md](README.md) - Setup and quick start
- [MOBILE_AGENT.md](MOBILE_AGENT.md) - Complete agent guide
- [BIOMETRIC_AUTH.md](BIOMETRIC_AUTH.md) - Biometric implementation
- [SETUP.md](SETUP.md) - Detailed setup instructions
- [ASSETS_SETUP.md](ASSETS_SETUP.md) - Asset configuration
- [../MOBILE_FEATURES_SUMMARY.md](../MOBILE_FEATURES_SUMMARY.md) - Feature summary
- [../PUSH_NOTIFICATIONS.md](../PUSH_NOTIFICATIONS.md) - Push notification guide

## 🎯 Production Readiness

### ✅ Ready
- All core features implemented
- Error handling and validation
- Secure credential storage
- Real-time updates
- Photo uploads with S3
- Biometric authentication

### ⚠️ Required Before Production
- Database migration for device_tokens table
- Physical device testing (biometrics, notifications)
- Expo project ID configuration
- Offline support implementation
- Performance testing and optimization

## 🧪 Testing Checklist

- [ ] Clock in/out with photo and GPS on physical device
- [ ] Weekly schedule view and navigation
- [ ] Dashboard real-time updates
- [ ] Time off request submission
- [ ] Profile editing and PIN change
- [ ] Biometric enable/disable
- [ ] Biometric login on app restart
- [ ] Push notification registration
- [ ] Push notification deep linking
- [ ] Background polling functionality
- [ ] App state transitions (foreground/background)
- [ ] Pull-to-refresh on all screens
- [ ] Photo upload to S3
- [ ] Error handling and edge cases
