# ShiftWork Mobile — Production Refactor Plan

> **For AI Agents:** This is the authoritative execution plan for moving the mobile app
> from prototype to production quality. Work through phases in order. Each phase has
> explicit acceptance criteria an agent can verify programmatically.
>
> **Branch:** `feature/mobile-ui-enhancements`  
> **Audit date:** March 2026 — Expo SDK 54, RN 0.81, React 19
>
> **UI Overhaul Status — April 2026:** Phases 1–3 (Foundation, Decomposition, Animation & Polish)
> are **complete**. All screens have been redesigned to Apple iOS Human Interface Guidelines
> standards. See [FEATURES_COMPLETE.md](FEATURES_COMPLETE.md) for the full inventory.

---

## Diagnosis: What We Are Fixing

| Issue | Evidence | Impact | Status |
|---|---|---|---|
| God-component screens | `dashboard.tsx` 892 lines, `clock.tsx` 558 lines | Untestable, unmaintainable | ✅ Decomposed |
| Raw `useState` forms | `clock.tsx`, `time-off-request.tsx`, `register.tsx` | No validation, inconsistent errors | ✅ RHF + zod |
| `TouchableOpacity` everywhere | All screens | No press feedback control, deprecated | ✅ `PressableScale` |
| Zero animations | No Reanimated usage despite being installed | Feels unfinished, cheap | ✅ `FadeIn/Down/Up`, springs |
| `ActivityIndicator` as only loading state | All screens | Poor perceived performance | ✅ `Skeleton` components |
| Direct service calls in `useEffect` | `dashboard.tsx`, `clock.tsx` | Bypasses React Query cache | ✅ React Query hooks |
| `FlatList` for all lists | Schedule, events, people | Jank on Android, frame drops | ⏳ Phase 4 |
| No error boundary | Root layout | Crashes show white screen | ✅ `ErrorBoundary` |
| `console.log` in production paths | `api-client.ts`, `_layout.tsx` | Log leakage, noise | ✅ `logger.ts` utility |
| No tests | Zero test files | No regression safety net | ⏳ Phase 5 |
| `theme.ts` partially followed | Hardcoded hex values in several screens | Design inconsistency | ✅ iOS HIG tokens |
| Firebase Auth disabled (mock) | `config/firebase.ts` | Not production-ready | ⏳ Phase 6 |

---

## Phase 1 — Foundation (Agent runs first, no visual changes)

**Goal:** Zero regressions. All existing screens still work. New infrastructure in place.

### 1.1 Design Token Consolidation
**File:** `styles/tokens.ts` (new file — extends existing `styles/theme.ts`)

Create a unified token file that wraps and extends the existing `theme.ts`:

```ts
// styles/tokens.ts
export { colors, spacing, radius, typography, shadow } from './theme';

// Additional tokens not yet in theme.ts
export const zIndex = {
  base: 0, card: 10, header: 20, modal: 30, toast: 40,
} as const;

export const animation = {
  fast: 150, normal: 250, slow: 400,
} as const;
```

**Rule for agent:** After creating `tokens.ts`, do a global find-replace of any hardcoded hex
color or pixel value in `components/ui/` and replace with the appropriate token.

**Acceptance:** `grep -r "#[0-9A-Fa-f]\{6\}" components/ui/` returns zero results.

---

### 1.2 Error Boundary
**File:** `components/ErrorBoundary.tsx` (new)

```tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/styles/tokens';

interface Props { children: React.ReactNode; fallback?: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return this.props.fallback ?? (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>{this.state.error?.message}</Text>
        <Pressable onPress={() => this.setState({ hasError: false, error: null })}>
          <Text style={styles.retry}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}
```

**Wire into:** `app/_layout.tsx` — wrap `<Stack>` with `<ErrorBoundary>`.

---

### 1.3 GestureHandlerRootView
**File:** `app/_layout.tsx`

Wrap root with `GestureHandlerRootView` from `react-native-gesture-handler` — required for
gesture-handler and bottom-sheet to work. Must be the outermost wrapper.

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// ...
return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* existing content */}
      </QueryClientProvider>
    </ErrorBoundary>
  </GestureHandlerRootView>
);
```

---

### 1.4 Toast / Notification System
**File:** `components/ui/Toast.tsx` (new), `hooks/useToast.ts` (new)

Replace all `Alert.alert()` success/error calls with a non-blocking toast. Current codebase
has 12+ `Alert.alert()` calls across screens.

```tsx
// Simple Reanimated-powered slide-in toast
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

type ToastType = 'success' | 'error' | 'info' | 'warning';
// Store in a simple zustand slice
// useToast().show({ message: 'Clocked in!', type: 'success' })
```

**Acceptance:** Zero `Alert.alert()` calls remain in `app/(tabs)/` screens.

---

### 1.5 Remove `console.log` from Production Paths
**Files:** `services/api-client.ts`, `app/_layout.tsx`, all screens

Wrap all `console.log` / `console.error` in `if (__DEV__)` guards or replace with a
lightweight logger utility:

```ts
// utils/logger.ts
const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
export const logger = {
  log: (...args: unknown[]) => { if (isDev) console.log(...args); },
  error: (...args: unknown[]) => { if (isDev) console.error(...args); },
  warn: (...args: unknown[]) => { if (isDev) console.warn(...args); },
};
```

**Acceptance:** `grep -r "console\.log" services/ app/` returns zero unguarded calls.

---

## Phase 2 — Screen Decomposition (Biggest impact, most work)

**Goal:** Every screen file ≤ 200 lines. Business logic extracted to hooks. UI is pure render.

### The Rule
```
Screen (app/(tabs)/*.tsx)   →  orchestration only, ≤ 200 lines
  └── uses hooks/use[Feature].ts  →  all data, state, side effects
        └── calls services/         →  all API calls
  └── renders components/screens/  →  all UI sections as sub-components
```

---

### 2.1 Dashboard Screen Decomposition
**Current:** `app/(tabs)/dashboard.tsx` — 892 lines  
**Target:** ≤ 200 lines

**Extract to:**

| New file | Responsibility |
|---|---|
| `hooks/useDashboardData.ts` | Already exists — expand to cover ALL dashboard data |
| `components/screens/dashboard/StatusCard.tsx` | Clocked-in status with live timer |
| `components/screens/dashboard/TodayShiftCard.tsx` | Today's shift + location |
| `components/screens/dashboard/WeekSummaryCard.tsx` | Hours/shifts this week |
| `components/screens/dashboard/UpcomingShiftsList.tsx` | Next 3 shifts |
| `components/screens/dashboard/RecentActivityList.tsx` | Recent clock events |
| `components/screens/dashboard/TimeOffSection.tsx` | PTO balance + requests |

**Resulting screen:**
```tsx
export default function DashboardScreen() {
  const data = useDashboardData(companyId, personId);
  if (data.loading) return <DashboardSkeleton />;
  return (
    <ScrollView refreshControl={<RefreshControl onRefresh={data.refresh} />}>
      <StatusCard isClockedIn={data.isClockedIn} elapsed={data.elapsed} />
      <TodayShiftCard shift={data.todayShift} location={data.todayLocation} />
      <WeekSummaryCard hours={data.hoursThisWeek} shifts={data.shiftsThisWeek} />
      <UpcomingShiftsList shifts={data.upcoming} />
      <RecentActivityList events={data.recentEvents} />
      <TimeOffSection requests={data.timeOffRequests} />
    </ScrollView>
  );
}
```

---

### 2.2 Clock Screen Decomposition
**Current:** `app/(tabs)/clock.tsx` — 558 lines  
**Target:** ≤ 200 lines

**Extract to:**

| New file | Responsibility |
|---|---|
| `hooks/useClockAction.ts` | Clock-in/out logic, photo, location, safety questions |
| `components/screens/clock/ClockButton.tsx` | Animated clock-in/out button |
| `components/screens/clock/ElapsedTimer.tsx` | Live elapsed time display |
| `components/screens/clock/SafetyQuestionnaire.tsx` | Kiosk questions flow |
| `components/screens/clock/EventHistoryList.tsx` | Recent events (FlashList) |
| `components/screens/clock/ShiftInfoBanner.tsx` | Today's shift info banner |

---

### 2.3 Profile Screen
**Current:** `app/(tabs)/profile.tsx`  
**Target:** Form-based with `react-hook-form` + `zod`

Extract PIN change form, profile edit form into separate components using RHF:

```tsx
// components/screens/profile/ChangePinForm.tsx
const schema = z.object({
  currentPin: z.string().length(4),
  newPin: z.string().length(4).regex(/^\d+$/),
  confirmPin: z.string().length(4),
}).refine(d => d.newPin === d.confirmPin, {
  message: "PINs don't match", path: ['confirmPin'],
});
```

---

### 2.4 Time-Off Request Form
**Current:** `app/(tabs)/time-off-request.tsx`  
**Target:** Full RHF + zod validation

```tsx
const schema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().min(10, 'Please provide more detail').max(500),
  type: z.enum(['vacation', 'sick', 'personal', 'other']),
}).refine(d => new Date(d.endDate) >= new Date(d.startDate), {
  message: 'End date must be after start date', path: ['endDate'],
});
```

---

### 2.5 Auth Screens
**Files:** `app/(auth)/login.tsx`, `register.tsx`, `pin-verify.tsx`

All three need RHF + zod. Schema definitions:

```ts
// utils/schemas/auth.ts
export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'At least 6 characters'),
});

export const pinSchema = z.object({
  pin: z.string().length(4, 'PIN must be 4 digits').regex(/^\d+$/, 'Numbers only'),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  companyCode: z.string().min(4),
});
```

---

## Phase 3 — Animation & Polish

**Goal:** Every state change, list entry, and action has motion feedback.

### 3.1 Skeleton Screens
**Replace all `ActivityIndicator` with skeleton components.**

```tsx
// components/ui/Skeleton.tsx
import Animated, { useSharedValue, withRepeat, withTiming, useAnimatedStyle } from 'react-native-reanimated';

export function Skeleton({ width, height, borderRadius = 8 }: SkeletonProps) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: colors.border }, style]} />;
}
```

**Create:** `components/ui/skeletons/DashboardSkeleton.tsx`, `ClockSkeleton.tsx`, `ScheduleSkeleton.tsx`

---

### 3.2 Animated Clock Button
The clock-in/out button is the most critical interaction in the app. It needs:

```tsx
// components/screens/clock/ClockButton.tsx
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Scale spring on press
// Color transition: green (clocked out) → red (clocked in)
// Success burst animation on confirmation
// Haptic: Heavy impact on press, NotificationFeedbackType.Success on confirm
```

---

### 3.3 List Item Entrance Animations
All `FlashList` item renders should use staggered entry:

```tsx
// In renderItem:
<Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
  <ShiftCard shift={item} />
</Animated.View>
```

Apply to: recent events list, upcoming shifts, time-off requests.

---

### 3.4 Replace All `TouchableOpacity` with `Pressable`
Global replace with scale feedback:

```tsx
// components/ui/PressableScale.tsx — reusable
const scale = useSharedValue(1);
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: scale.value }],
}));
// onPressIn: scale.value = withSpring(0.96)
// onPressOut: scale.value = withSpring(1)
```

---

### 3.5 Page Transition Animations (Expo Router)
Add shared element transitions for schedule → shift detail, dashboard → clock:

```tsx
// app/(tabs)/_layout.tsx screenOptions
screenOptions={{
  animation: 'slide_from_right',
  customAnimationOnGesture: true,
}}
```

---

## Phase 4 — Performance

### 4.1 Migrate All Lists to FlashList

| Screen | Current | Action |
|---|---|---|
| `clock.tsx` event history | `FlatList` | Replace with `FlashList estimatedItemSize={72}` |
| `schedule.tsx` shifts | `FlatList` | Replace with `FlashList estimatedItemSize={80}` |
| `dashboard.tsx` recent events | `FlatList` | Replace with `FlashList estimatedItemSize={64}` |
| `time-off-request.tsx` list | `FlatList` | Replace with `FlashList estimatedItemSize={88}` |

**Rule:** Never nest FlashList inside ScrollView. Use `ListHeaderComponent` for headers.

---

### 4.2 React Query for All Data

Every service call that lives in a `useEffect` + `setState` pair must become a `useQuery`.
Every mutation (clock-in, submit form) must use `useMutation` with `onSuccess` invalidation.

```ts
// hooks/useShiftEvents.ts
export const useShiftEvents = (companyId: string, personId: number) =>
  useQuery({
    queryKey: ['shiftEvents', companyId, personId],
    queryFn: () => shiftEventService.getPersonShiftEvents(companyId, personId),
    staleTime: 30_000,
  });

export const useClockIn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ClockInPayload) => shiftEventService.clockIn(payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['shiftEvents', vars.companyId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
};
```

---

### 4.3 Image Optimization

Replace all `<Image>` from `react-native` with `expo-image`:

```tsx
// Before
import { Image } from 'react-native';
<Image source={{ uri: photoUrl }} style={styles.photo} />

// After
import { Image } from 'expo-image';
<Image
  source={{ uri: photoUrl }}
  placeholder={blurhash}
  contentFit="cover"
  cachePolicy="memory-disk"
  transition={200}
  style={styles.photo}
/>
```

---

## Phase 5 — Testing

**Goal:** Critical paths covered. No regression on clock-in/out, auth, or form submission.

### 5.1 Setup
```bash
npm install --save-dev jest jest-expo @testing-library/react-native @types/jest
```

Add to `package.json`:
```json
"jest": {
  "preset": "jest-expo",
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
  ]
}
```

### 5.2 Test Priority Order

| Test | File | Type |
|---|---|---|
| `useClockAction` clock-in flow | `hooks/__tests__/useClockAction.test.ts` | Unit |
| `ClockButton` press states | `components/__tests__/ClockButton.test.tsx` | Component |
| Login form validation | `components/__tests__/LoginForm.test.tsx` | Component |
| `useAuthStore` signOut | `store/__tests__/authStore.test.ts` | Unit |
| PIN schema validation | `utils/__tests__/schemas.test.ts` | Unit |
| API client token injection | `services/__tests__/api-client.test.ts` | Unit |

---

## Phase 6 — Firebase Auth (Production Readiness)

**Current state:** Firebase Auth is mocked in `config/firebase.ts`. Dev token is used everywhere.

**Goal:** Real Firebase email/password + biometric login working on physical devices.

### Steps
1. Re-enable real Firebase Auth initialization in `config/firebase.ts`
2. Wire `login.tsx` to `signInWithEmailAndPassword`
3. Wire `register.tsx` to `createUserWithEmailAndPassword`
4. Store Firebase UID → map to `personId` on first login via API
5. Biometric: use `expo-local-authentication` to re-auth (not replace Firebase)
6. Remove `EXPO_PUBLIC_DEV_TOKEN` from all production builds

---

## Execution Order for Agent

```
Phase 1 (Foundation — no UI changes)
  [1.1] Create styles/tokens.ts
  [1.2] Create components/ErrorBoundary.tsx → wire in app/_layout.tsx
  [1.3] Add GestureHandlerRootView to app/_layout.tsx
  [1.4] Create utils/logger.ts → replace all console.log calls
  [1.5] Create components/ui/Toast.tsx + hooks/useToast.ts → replace Alert.alert

Phase 2 (Decomposition — screen by screen)
  [2.1] dashboard.tsx → extract 6 sub-components + expand useDashboardData hook
  [2.2] clock.tsx → extract 5 sub-components + useClockAction hook
  [2.3] profile.tsx → extract PIN form + RHF/zod
  [2.4] time-off-request.tsx → RHF/zod form
  [2.5] auth screens → schema file + RHF forms

Phase 3 (Animation)
  [3.1] Create components/ui/Skeleton.tsx + 3 skeleton screen variants
  [3.2] Animate ClockButton with Reanimated
  [3.3] Add list item entrance animations
  [3.4] Replace TouchableOpacity with PressableScale component
  [3.5] Add page transition config

Phase 4 (Performance)
  [4.1] Migrate FlatList → FlashList in all 4 screens
  [4.2] Convert useEffect+setState pairs → useQuery + useMutation
  [4.3] Replace react-native Image → expo-image

Phase 5 (Testing)
  [5.1] Configure jest-expo
  [5.2] Write 6 priority tests

Phase 6 (Firebase Auth)
  [6.1] Re-enable real Firebase Auth
  [6.2] Wire login/register flows
  [6.3] Remove dev token from production
```

---

## File Structure After Completion

```
ShiftWork.Mobile/
├── app/
│   ├── (auth)/          ← RHF + zod forms, real Firebase
│   └── (tabs)/          ← ≤200 lines each, orchestration only
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Skeleton.tsx          ← NEW
│   │   ├── Toast.tsx             ← NEW
│   │   ├── PressableScale.tsx    ← NEW
│   │   └── skeletons/            ← NEW
│   └── screens/                  ← NEW (decomposed screen sections)
│       ├── dashboard/
│       ├── clock/
│       └── profile/
├── hooks/
│   ├── useDashboardData.ts       ← expanded
│   ├── useClockAction.ts         ← NEW (from clock.tsx)
│   ├── useToast.ts               ← NEW
│   └── useScheduleData.ts
├── services/                     ← unchanged (already clean)
├── store/
│   └── authStore.ts
├── styles/
│   ├── theme.ts                  ← unchanged
│   └── tokens.ts                 ← NEW (extends theme.ts)
└── utils/
    ├── logger.ts                 ← NEW
    └── schemas/                  ← NEW
        ├── auth.ts
        └── timeOff.ts
```

---

## Acceptance Criteria (Agent Checkpoints)

| Check | Command | Pass condition |
|---|---|---|
| No screen > 200 lines | `Get-ChildItem app/(tabs) \| % { (Get-Content $_).Count }` | All ≤ 200 |
| No hardcoded hex in ui/ | `grep -r "#[0-9A-F]" components/ui/` | Zero results |
| No unguarded console.log | `grep -rn "console.log" app/ services/` | Zero results |
| No Alert.alert in tabs | `grep -rn "Alert.alert" app/(tabs)/` | Zero results |
| No FlatList in tabs | `grep -rn "FlatList" app/(tabs)/` | Zero results |
| All forms use RHF | `grep -rn "useState.*string\|useState.*''" app/(tabs)/` | Zero form states |
| Tests pass | `npx jest --passWithNoTests` | Exit 0 |

---

*Plan version 1.0 — March 2026*  
*Created for `feature/mobile-ui-enhancements` branch*
