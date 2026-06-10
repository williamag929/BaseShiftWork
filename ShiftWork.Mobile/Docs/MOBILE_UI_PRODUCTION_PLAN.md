# Mobile UI Production Readiness Plan

## UI improvements to reach production quality

### Visual design system
- Define a unified color palette, typography scale, spacing scale, and elevation rules.
- Create reusable UI primitives (buttons, inputs, cards, badges, tabs, section headers) with variants.
- Standardize iconography and empty states (icon + title + guidance).

### Navigation and information architecture
- Ensure top-level tabs map to primary user jobs (Clock, Schedule, Dashboard, Profile).
- Add clear entry points for time off, upcoming shifts, and notifications.
- Add consistent back navigation patterns and headers on secondary screens.

### Accessibility and readability
- Increase base font size and line height for readability.
- Ensure color contrast meets WCAG AA for text and badges.
- Support dynamic text sizing and touch targets >= 44x44.

### Consistent status and feedback
- Standardize status colors (Approved/Denied/Pending, OnShift/OffShift).
- Add success/error/toast patterns for all critical actions.
- Add loading skeletons for slow API responses.

### Camera, location, and permissions UX
- Add permission primer screens for Camera/Location/Notifications.
- Provide fallback flows when permissions are denied.
- Show explicit capture progress and retry controls.

### Offline and poor network UX
- Show offline banner and cached data indicators.
- Queue actions with retry status (clock in/out, time off submit).
- Add pull-to-refresh with last-updated timestamps.

### Performance and polish
- Use image caching and optimized image components for avatars and photos.
- Reduce re-renders in lists (memoize, use keyExtractor, windowing).
- Add animations for screen transitions and card interactions.

## Pending features checklist (from current docs + production gaps)

### High priority
- Offline support: cache schedules, queue events, sync when online.
- Push notification production setup: device_tokens migration applied and physical device testing complete.
- Permission education flows (camera/location/notifications).
- Error/empty/loading states unified across all screens.

### Medium priority
- Profile photo management (view/update).
- Shift details modal on tap in weekly schedule.
- Schedule filters (location/area).
- Notification preferences per event type.

### Low priority
- Dark mode full support (colors, images, charts).
- Localization/multi-language.
- Accessibility improvements (screen readers, larger text).
- Notification history screen.

## Agent-ready task breakdown

### 1) Design system setup
- Create a `ui` folder for design tokens and base components.
- Implement `Button`, `Card`, `Badge`, `Input`, `SectionHeader`, `EmptyState`.
- Add `theme.ts` with colors, spacing, typography, radius, elevation.

### 2) Screen-by-screen UI polish
- Dashboard: add summary cards, clear empty states, and loading skeletons.
- Weekly Schedule: add shift details modal and timeline visual.
- Clock: add progress steps (permissions → capture → submit) and retry.
- Profile: add photo management and consistent settings layout.

### 3) UX consistency and feedback
- Add a global toast/snackbar system for success/error.
- Add a centralized loading indicator pattern.
- Add a network status banner and last-updated timestamps.

### 4) Accessibility and testing
- Ensure contrast ratios, font sizes, and touch targets meet accessibility.
- Test on small/large devices and tablets.
- Verify dynamic type scaling and screen reader labels.

### 5) Notifications & permissions flow
- Add permission primer screen before system prompts.
- Add a Notifications settings screen with toggles.
- Add in-app deep links for notification types.

## Files to start from
- UI components: ShiftWork.Mobile/components
- Screens: ShiftWork.Mobile/app/(tabs)
- Services: ShiftWork.Mobile/services
- Hooks: ShiftWork.Mobile/hooks

## Acceptance criteria for production UI
- Consistent typography, spacing, and colors across all screens.
- No raw API errors surfaced; all handled via user-friendly messaging.
- Clear empty states and loading states on every data-driven screen.
- Permission prompts are contextual and non-blocking.
- Tested on real devices with smooth animations and no layout breaks.
