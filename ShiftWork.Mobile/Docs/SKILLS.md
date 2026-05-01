# ShiftWork Mobile — UI Skill Development Guide

> **For AI Agents & Contributors:** This document defines the expected skill set, libraries,
> patterns, and standards for building production-quality UI in this React Native / Expo project.
> Read this before writing any UI code.

---

## Stack Identity

| Layer | Technology | Status |
|---|---|---|
| Framework | React Native 0.81 + Expo 54 | ✅ Active |
| Routing | Expo Router 6 (file-based) | ✅ Active |
| Language | TypeScript 5.3 (strict) | ✅ Active |
| State | Zustand 4 | ✅ Active |
| Data Fetching | TanStack React Query 5 | ✅ Active |
| Styling | `styles/tokens.ts` (iOS HIG) | ✅ System in place |
| Animation | `react-native-reanimated` 4.1 | ✅ Used across all screens |
| Gestures | `react-native-gesture-handler` 2.28 | ✅ Active |
| Forms | `react-hook-form` 7 + `zod` 4 | ✅ All auth + profile forms |
| List Performance | `@shopify/flash-list` 2.0 | ⏳ Migration in progress |
| UI Components | `components/ui/` — Button, Card, Badge, EmptyState, PressableScale, Skeleton, SectionHeader | ✅ Apple-quality primitives |

---

## Required Skills for UI Work

### 1. React Native Core UI Fundamentals
**You must be fluent in:**
- `View`, `Text`, `TextInput`, `ScrollView`, `FlatList`, `SectionList`, `Pressable`
- `StyleSheet.create()` with typed styles — never use inline style objects in render
- Flexbox layout model as implemented in React Native (column-first, no `grid`)
- Platform-specific code: `Platform.OS === 'ios'` , `Platform.select({})`, `.ios.tsx` / `.android.tsx` file splitting
- `SafeAreaView` via `react-native-safe-area-context` — required on every screen root
- KeyboardAvoidingView + KeyboardDismissHandler patterns for forms

**Reference components:** `components/ui/Button.tsx`, `components/ui/Card.tsx`

---

### 2. Animations — `react-native-reanimated` ✅ Implemented
All screens use Reanimated 4.1 for entrances, press feedback, and state transitions.

**Expected competencies:**
```tsx
// Declarative shared values
const opacity = useSharedValue(0);
const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

// Spring / timing transitions
opacity.value = withSpring(1);
opacity.value = withTiming(0, { duration: 200 });

// Layout animations on mount/unmount
<Animated.View entering={FadeInDown.duration(300)} exiting={FadeOut}>

// Scroll-driven animations (collapsible headers, parallax)
const scrollY = useSharedValue(0);
const headerStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: interpolate(scrollY.value, [0, 100], [0, -50]) }],
}));
```

**When to use:** Every list item mount, screen transition, status badge change, modal open/close, loading skeleton pulse. **These are already wired in all current screens.**

---

### 3. Gesture Handling — `react-native-gesture-handler` ✅ Implemented
`GestureHandlerRootView` wraps root layout. `PressableScale` uses Reanimated-powered spring for all press interactions.

**Expected competencies:**
```tsx
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';

// Swipe actions on shift/employee list items
const renderRightActions = () => (
  <Pressable style={styles.deleteAction} onPress={handleDelete}>
    <Text>Delete</Text>
  </Pressable>
);

<GestureHandlerRootView style={{ flex: 1 }}>
  <Swipeable renderRightActions={renderRightActions}>
    <ShiftCard shift={shift} />
  </Swipeable>
</GestureHandlerRootView>
```

> **Note:** `GestureHandlerRootView` must wrap the entire app at the root layout — check `app/_layout.tsx`.

---

### 4. Form Management — `react-hook-form` + `zod` ✅ Implemented
All auth screens (login, register, pin-verify) and profile forms (edit info, change PIN) use RHF + Zod. No raw `useState` for form fields.

**Expected competencies:**
```tsx
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  pin: z.string().length(4, 'PIN must be 4 digits').regex(/^\d+$/, 'Digits only'),
  reason: z.string().min(10, 'Please provide more detail').max(500),
  startDate: z.string().datetime(),
});

type FormData = z.infer<typeof schema>;

const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
  resolver: zodResolver(schema),
});

// Always use Controller for RN inputs (no DOM refs)
<Controller
  name="pin"
  control={control}
  render={({ field: { onChange, value } }) => (
    <TextInput value={value} onChangeText={onChange} secureTextEntry keyboardType="numeric" />
  )}
/>
{errors.pin && <Text style={styles.error}>{errors.pin.message}</Text>}
```

**Schema location:** Define reusable schemas in `utils/schemas/` — e.g., `utils/schemas/timeOff.ts`.

---

### 5. High-Performance Lists — `@shopify/flash-list` *(to be added)*
Replace all `FlatList` usage with `FlashList` for any list with more than ~20 items. The schedule grid, employee directory, and shift history are current offenders.

**Expected competencies:**
```tsx
import { FlashList } from '@shopify/flash-list';

// Drop-in replacement — always provide estimatedItemSize
<FlashList
  data={shifts}
  renderItem={({ item }) => <ShiftCard shift={item} />}
  estimatedItemSize={80}   // measure your actual item height
  keyExtractor={(item) => item.id}
  onEndReached={fetchNextPage}
  onEndReachedThreshold={0.3}
/>
```

**Rule:** Never nest a `FlashList`/`FlatList` inside a `ScrollView` — use `ListHeaderComponent` and `ListFooterComponent` instead.

---

### 6. Bottom Sheets — `@gorhom/bottom-sheet` *(to be added)*
Filters, detail panels, confirmations, and quick-action menus must use bottom sheets, not modals or full-screen navigation pushes.

**Expected competencies:**
```tsx
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

const sheetRef = useRef<BottomSheet>(null);
const snapPoints = useMemo(() => ['35%', '75%'], []);

// Open programmatically
sheetRef.current?.expand();
sheetRef.current?.close();

<BottomSheet ref={sheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose>
  <BottomSheetView>
    <ShiftDetailPanel shift={selectedShift} />
  </BottomSheetView>
</BottomSheet>
```

---

### 7. Image Handling — `expo-image` *(to be added)*
Replace all `Image` from `react-native` with `expo-image`. This is especially critical for clock-in photo thumbnails, profile photos, and any S3-hosted content.

**Expected competencies:**
```tsx
import { Image } from 'expo-image';

<Image
  source={{ uri: s3PhotoUrl }}
  placeholder={blurhash}           // low-res placeholder while loading
  contentFit="cover"
  transition={300}                  // smooth fade-in
  cachePolicy="memory-disk"         // aggressive caching
  style={styles.photo}
/>
```

---

### 8. Haptics — `expo-haptics` (already installed)
Every destructive action, successful submission, and error state must trigger haptic feedback.

**Expected competencies:**
```tsx
import * as Haptics from 'expo-haptics';

// On success (clock in confirmed, request submitted)
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// On error (wrong PIN, validation failure)
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

// On light interactions (tab switch, toggle)
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
```

---

### 9. Design Token System
All colors, spacing, typography, and border radii must come from `styles/tokens.ts` (create if absent). **Never hardcode hex values or pixel sizes in components.**

```ts
// styles/tokens.ts — source of truth
export const colors = {
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  surface: '#FFFFFF',
  surfaceSecondary: '#F9FAFB',
  border: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textDisabled: '#D1D5DB',
} as const;

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
} as const;

export const radius = {
  sm: 4, md: 8, lg: 12, xl: 16, full: 9999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700', lineHeight: 36 },
  h2: { fontSize: 22, fontWeight: '600', lineHeight: 30 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
} as const;
```

---

### 10. Accessibility (a11y) Standards
Every interactive element must meet these requirements:

```tsx
// Minimum touch target: 44x44pt
<Pressable
  accessible
  accessibilityRole="button"
  accessibilityLabel="Clock in for morning shift"
  accessibilityHint="Activates camera to capture your clock-in photo"
  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
  style={({ pressed }) => [styles.button, pressed && styles.pressed]}
>

// Status elements need accessibilityLiveRegion
<Text accessibilityLiveRegion="polite">{statusMessage}</Text>

// Images need labels
<Image accessibilityLabel="Your clock-in photo from Monday 9:02 AM" ... />
```

**WCAG AA contrast ratios:** Body text must be ≥ 4.5:1, large text ≥ 3:1. Use `colors` tokens — they are pre-validated.

---

## Component Architecture Rules

```
components/
  ui/              ← Primitives: Button, Card, Badge, EmptyState, SectionHeader
  shared/          ← Composed: ShiftCard, EmployeeAvatar, TimeOffBadge, PhotoCapture
  screens/         ← Screen-level layout containers (no business logic)
```

| Rule | Enforcement |
|---|---|
| UI primitives in `components/ui/` have **no API calls** | ESLint no-restricted-imports |
| Screens use hooks for data, pass down via props | Code review |
| No `any` type | `tsconfig strict: true` |
| No inline style objects in JSX | Custom ESLint rule |
| Every async action has loading + error state | Code review |

---

## Agent Instructions

When implementing any UI feature in this project:

1. **Check `components/ui/`** first — use existing `Button`, `Card`, `Badge`, `EmptyState` before creating new primitives.
2. **Use `colors`, `spacing`, `radius`, `typography` tokens** from `styles/tokens.ts` — never hardcode values.
3. **Wrap screens in `SafeAreaView`** from `react-native-safe-area-context`.
4. **Use `react-hook-form` + `zod`** for any form, even simple ones.
5. **Add haptic feedback** on every action with a visible outcome.
6. **Animate list item entries** using `Animated.View entering={FadeInDown}` when Reanimated is available.
7. **Handle all three states** for every data-dependent UI: loading skeleton → populated → empty state.
8. **Prefer `FlashList`** over `FlatList` for all lists.
9. **Test on both platforms** — use `Platform.select` for any diverging behavior.
10. **Never block the JS thread** — offload image processing, crypto, or heavy computation with `expo-task-manager` or worker patterns.

---

## Packages to Install (Pending)

Run from `ShiftWork.Mobile/` directory:

```bash
# ✅ Already installed (March 2026)
# react-native-reanimated ~4.1.1
# react-native-gesture-handler ~2.28.0
# @shopify/flash-list 2.0.2
# react-hook-form ^7.71.2
# zod ^4.3.6
# @hookform/resolvers ^5.2.2

# Priority 4 — UX Polish (next up)
npx expo install expo-image @gorhom/bottom-sheet

# Priority 4 — UX Polish
npx expo install expo-image expo-haptics @gorhom/bottom-sheet

# Priority 5 — Testing
npm install --save-dev jest jest-expo @testing-library/react-native @types/jest
```

> After installing `react-native-reanimated`, add `'react-native-reanimated/plugin'` as the
> **last entry** in the `plugins` array in `babel.config.js`, then clear the Metro cache:
> `npx expo start --clear`

---

*Last updated: March 2026 — aligned with Expo SDK 54, React Native 0.81, React 19*
