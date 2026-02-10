# ShiftWork Mobile - Agent Guide

This document provides comprehensive information about the ShiftWork Mobile app (React Native + Expo) for AI agents and developers working on the project.

## Project Overview

ShiftWork Mobile is a cross-platform mobile application (iOS & Android) built with React Native and Expo that allows employees to:
- Clock in/out with photo and geolocation capture
- View their schedules (day, week, month views)
- See shift details and tasks
- Answer location-specific kiosk questions
- View dashboard with hours worked and upcoming shifts

## Technology Stack

- **Framework**: React Native 0.81.5 + Expo SDK 54
- **Routing**: Expo Router (file-based routing)
- **Language**: TypeScript (strict mode)
- **State Management**: Zustand
- **API Client**: Axios with Firebase JWT auth
- **Data Fetching**: TanStack Query (React Query)
- **Authentication**: Firebase Auth (currently mocked/disabled in config/firebase.ts)
- **Secure Storage**: expo-secure-store
- **Camera**: expo-camera
- **Location**: expo-location
- **Biometrics**: expo-local-authentication
- **Calendar**: react-native-calendars

## Project Structure

```
ShiftWork.Mobile/
├── app/                        # Expo Router screens
│   ├── (auth)/                # Auth-protected routes
│   │   ├── login.tsx
│   │   └── pin-verify.tsx
│   ├── (tabs)/                # Main tab navigation
│   │   ├── dashboard.tsx
│   │   ├── schedule.tsx
│   │   ├── clock.tsx
│   │   └── profile.tsx
│   ├── _layout.tsx            # Root layout
│   └── index.tsx              # Entry point
├── components/                # Reusable UI components
│   ├── ClockButton.tsx
│   ├── ShiftCard.tsx
│   ├── WeekCalendar.tsx
│   ├── PhotoCapture.tsx
│   └── LoadingSpinner.tsx
├── services/                  # API service layer
│   ├── api-client.ts          # Axios instance with interceptors
│   ├── auth.service.ts        # Auth endpoints
│   ├── schedule.service.ts    # Schedule/shift endpoints
│   ├── shift-event.service.ts # Clock in/out endpoints
│   ├── kiosk.service.ts       # Kiosk questions/answers
│   └── location.service.ts    # Location endpoints
├── hooks/                     # Custom React hooks
│   ├── useAuth.ts             # Auth state hook
│   ├── useSchedules.ts        # Schedules query hook
│   ├── useShiftEvents.ts      # Shift events query hook
│   └── useClock.ts            # Clock in/out logic
├── store/                     # Zustand stores
│   ├── authStore.ts           # Auth state
│   └── appStore.ts            # App-wide state
├── types/                     # TypeScript type definitions
│   ├── api.ts                 # API DTOs (matches backend)
│   └── index.ts               # App types
├── utils/                     # Utility functions
│   ├── date.utils.ts          # Date formatting/calculations
│   ├── storage.utils.ts       # Secure storage helpers
│   └── location.utils.ts      # Location helpers
├── config/                    # App configuration
│   └── firebase.ts            # Firebase initialization
├── assets/                    # Static assets
│   ├── images/
│   └── icons/
├── app.json                   # Expo configuration
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
└── .env.example               # Environment variables template
```

## Environment Variables

Create a `.env` file based on `.env.example` (Expo runtime reads `EXPO_PUBLIC_` variables):

```bash
# API Configuration (Expo runtime reads EXPO_PUBLIC_*)
EXPO_PUBLIC_API_URL=https://your-api-url.com
EXPO_PUBLIC_API_TIMEOUT=30000

# Firebase Configuration (Expo runtime reads EXPO_PUBLIC_*)
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
EXPO_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx

# AWS S3 (for photo uploads)
AWS_REGION=us-east-1
AWS_BUCKET_NAME=shiftwork-photos

# App Configuration (Expo runtime reads EXPO_PUBLIC_*)
EXPO_PUBLIC_DEFAULT_COMPANY_ID=your-company-id
```

Note: Expo uses `EXPO_PUBLIC_` prefix for environment variables accessible in the app.

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm/yarn
- Expo CLI: `npm install -g expo-cli`
- For iOS: macOS with Xcode
- For Android: Android Studio with SDK

### Installation

```powershell
# Navigate to mobile directory
cd ShiftWork.Mobile

# Install dependencies (React 19 peer deps)
npm install --legacy-peer-deps

# Copy environment variables
cp .env.example .env
# Edit .env with your actual values

# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web (for testing)
npm run web
```

### Physical Device Testing

```powershell
# Install Expo Go app on your phone
# iOS: App Store
# Android: Play Store

# Start dev server
npm start

# Scan QR code with:
# - iOS: Camera app
# - Android: Expo Go app
```

## API Integration

### Authentication Flow

1. **Firebase Login**
   ```typescript
   import { signInWithEmailAndPassword } from 'firebase/auth';
   import { auth } from '@/config/firebase';
   
   const user = await signInWithEmailAndPassword(auth, email, password);
   const token = await user.user.getIdToken();
   ```

2. **Get Person Data**
   ```typescript
   import { authService } from '@services';
   
   const person = await authService.getUserByEmail(email);
   ```

3. **Verify PIN** (optional biometric alternative)
   ```typescript
   const result = await authService.verifyPin({ personId, pin });
   if (result.verified) {
     // Proceed to app
   }
   ```

### Clock In/Out Workflow

```typescript
import { shiftEventService } from '@services';
import { getCurrentLocation } from '@utils';
import * as Device from 'expo-device';

// Clock In
const location = await getCurrentLocation();
const photoUrl = await captureAndUploadPhoto(); // Implement photo upload

const clockInEvent = await shiftEventService.clockIn(
  companyId,
  personId,
  location,
  photoUrl,
  Device.modelName
);

// Clock Out
const clockOutEvent = await shiftEventService.clockOut(
  companyId,
  personId,
  location,
  photoUrl,
  Device.modelName
);
```

### Schedule Retrieval

```typescript
import { scheduleService } from '@services';
import { getStartOfWeek, getEndOfWeek, formatDateForApi } from '@utils';

// Get current week shifts
const startDate = formatDateForApi(getStartOfWeek(new Date()));
const endDate = formatDateForApi(getEndOfWeek(new Date()));

const shifts = await scheduleService.getPersonShifts(
  companyId,
  personId,
  startDate,
  endDate
);
```

### Kiosk Questions

```typescript
import { kioskService } from '@services';

// Get questions
const questions = await kioskService.getKioskQuestions(companyId);

// Submit answers
const answers: KioskAnswerDto[] = questions.map(q => ({
  questionId: q.questionId,
  personId,
  companyId,
  eventLogId: clockInEvent.eventLogId,
  answerText: userAnswers[q.questionId],
  answeredAt: new Date(),
}));

await kioskService.submitKioskAnswers(answers);
```

## Key Features Implementation

### 1. Dashboard Screen

**Requirements:**
- Display total hours worked (current week/month)
- Show upcoming shifts (next 7 days)
- Recent clock events
- Quick clock in/out button

**API Calls:**
- `GET /api/companies/{companyId}/shiftevents/person/{personId}` - Recent events
- `GET /api/companies/{companyId}/schedules/search?personId={id}&startDate={date}&endDate={date}` - Upcoming shifts

**Calculations:**
- Parse shift events to calculate worked hours
- Filter clock_in/clock_out pairs
- Sum durations using `calculateDuration()` utility

**Offline & Caching:**
- Live data is fetched when online and persisted to SQLite; when offline, the dashboard reads from SQLite.
- Hook: `hooks/useDashboardData.ts` handles online/offline detection with `expo-network`, fetch → cache → render, and computes:
  - `hoursThisWeek`: from paired clock_in → clock_out events in the current week
  - `shiftsThisWeek`: scheduled shifts falling within the current week
- SQLite schema (created on first run):
  - `shift_events(eventLogId PRIMARY KEY, eventDate, eventType, companyId, personId, description, kioskDevice, geoLocation, photoUrl, createdAt, updatedAt)`
  - `schedule_shifts(scheduleShiftId PRIMARY KEY, scheduleId, companyId, personId, locationId, areaId, startDate, endDate, status, updatedAt)`
- DB helpers in `services/db.ts`:
  - `upsertShiftEvents`, `upsertScheduleShifts`, `getRecentEvents`, `getUpcomingShifts`, `getEventsInRange`
- UI wiring in `app/(tabs)/dashboard.tsx` with loading/empty/error and offline banner.

### 2. Schedule Screen

**Requirements:**
- Calendar view (day/week/month toggle)
- Shift cards with time, location, notes
- Tap to view shift details
- Pull to refresh

**Components:**
- `react-native-calendars` for calendar
- Custom `ShiftCard` component
- `WeekCalendar` for week view

**State:**
- Selected date
- View mode (day/week/month)
- Cached schedules/shifts

### 3. Clock Screen

**Requirements:**
- Large Clock In / Clock Out button
- Current status indicator
- Photo capture
- Location detection
- Kiosk questions (if configured)
- Recent events list

**Flow:**
1. Check current shift status (last event type)
2. Show appropriate button (Clock In if not clocked in, Clock Out if clocked in)
3. On button press:
   - Request camera/location permissions
   - Capture photo (optional)
   - Get GPS coordinates
   - Show kiosk questions (if any)
   - Submit shift event
   - Submit kiosk answers
   - Update UI with success/error

**Permissions:**
```typescript
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';

const [cameraStatus, requestCameraPermission] = Camera.useCameraPermissions();
const [locationStatus, requestLocationPermission] = Location.useForegroundPermissions();
```

### 4. Profile Screen

**Requirements:**
- User info display
- Company info
- Settings
- Biometric login toggle
- Logout

**Data:**
- Person info from auth state
- Company info from API
- Settings from local storage

## State Management

### Auth Store (Zustand)

```typescript
import { create } from 'zustand';
import type { AuthUser, PersonDto } from '@types';

interface AuthState {
  user: AuthUser | null;
  person: PersonDto | null;
  companyId: string | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  setPerson: (person: PersonDto | null) => void;
  setCompanyId: (companyId: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  person: null,
  companyId: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setPerson: (person) => set({ person }),
  setCompanyId: (companyId) => set({ companyId }),
  logout: () => set({ user: null, person: null, companyId: null, isAuthenticated: false }),
}));
```

### React Query Integration

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduleService } from '@services';

// Query hook
export const useSchedules = (companyId: string, params: ScheduleSearchParams) => {
  return useQuery({
    queryKey: ['schedules', companyId, params],
    queryFn: () => scheduleService.searchSchedules(companyId, params),
    enabled: !!companyId,
  });
};

// Mutation hook
export const useClockIn = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: ClockInData) => 
      shiftEventService.clockIn(data.companyId, data.personId, ...),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shiftEvents'] });
    },
  });
};
```

## Agent Tasks & Automation

### Common Agent Operations

#### 1. Automated Clock In/Out
```typescript
// Agent can trigger clock in for a person
async function agentClockIn(personId: number, companyId: string) {
  const location = await getCurrentLocation();
  const event = await shiftEventService.clockIn(
    companyId,
    personId,
    location,
    undefined, // no photo for agent
    'agent-automation'
  );
  return event;
}
```

#### 2. Schedule Report Generation
```typescript
// Generate weekly schedule report
async function generateWeeklyReport(personId: number, companyId: string) {
  const startDate = formatDateForApi(getStartOfWeek(new Date()));
  const endDate = formatDateForApi(getEndOfWeek(new Date()));
  
  const shifts = await scheduleService.getPersonShifts(
    companyId,
    personId,
    startDate,
    endDate
  );
  
  const events = await shiftEventService.getPersonShiftEvents(companyId, personId);
  
  // Calculate totals, format report
  return {
    shifts,
    events,
    totalHours: calculateTotalHours(events),
  };
}
```

#### 3. Shift Reminder Notifications
```typescript
// Check for upcoming shifts and send notifications
async function checkUpcomingShifts(personId: number, companyId: string) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const shifts = await scheduleService.getPersonShifts(
    companyId,
    personId,
    formatDateForApi(getStartOfDay(tomorrow)),
    formatDateForApi(getEndOfDay(tomorrow))
  );
  
  // Send push notifications via Expo Notifications
  for (const shift of shifts) {
    await sendPushNotification({
      title: 'Upcoming Shift',
      body: `You have a shift tomorrow at ${formatTime(shift.startDate)}`,
    });
  }
}
```

## Testing

### Unit Tests
```powershell
npm run test
```

### Type Checking
```powershell
npm run type-check
```

### Linting
```powershell
npm run lint
```

## Build & Deployment

### Development Build
```powershell
# iOS
eas build --profile development --platform ios

# Android
eas build --profile development --platform android
```

### Production Build
```powershell
# Configure eas.json first

# iOS
eas build --profile production --platform ios

# Android
eas build --profile production --platform android
```

### OTA Updates
```powershell
# Publish update without rebuilding
eas update --branch production --message "Bug fixes"
```

## Troubleshooting

### Common Issues

1. **TypeScript errors about missing modules**
   - Run `npm install` to ensure all dependencies are installed
   - Check that package.json includes all required packages

2. **Firebase auth not working**
   - Verify .env file has correct Firebase credentials
   - Check that Firebase project has Email/Password auth enabled

3. **API calls failing**
   - Verify API_URL in .env matches your backend
   - Check that backend is running and accessible
   - Inspect network tab for detailed error messages

4. **Camera/Location permissions not working**
   - Check app.json has correct permission configurations
   - Rebuild app after changing native permissions

5. **Expo Go vs Development Build**
   - Some native modules require development build
   - Use `expo prebuild` and build with EAS or locally

## Performance Optimization

1. **API Caching**: React Query caches API responses automatically
2. **Image Optimization**: Use `expo-image` for optimized image loading
3. **List Rendering**: Use `FlatList` with proper `keyExtractor` and `getItemLayout`
4. **Memoization**: Use `React.memo()`, `useMemo()`, `useCallback()` for expensive computations

## Security Best Practices

1. **Token Storage**: Use `expo-secure-store` for sensitive data
2. **API Keys**: Never commit .env files, use EAS Secrets for production
3. **Input Validation**: Validate all user inputs before API calls
4. **Biometric Auth**: Implement as alternative to PIN for security
5. **SSL Pinning**: Consider for production to prevent MITM attacks

## Future Enhancements

- [x] Offline mode with local database (SQLite)
- [x] Push notifications for shift reminders
- [ ] Team chat/messaging
- [x] Time-off requests
- [ ] Document/policy viewing
- [ ] Dark mode support
- [ ] Multi-language support
- [ ] Accessibility improvements (screen readers, larger text)

## Related Documentation

- Main project: `AGENT.md` in root directory
- Backend API: `ShiftWork.Api` folder
- Angular web app: `ShiftWork.Angular` folder

## Agent Integration Points

When automating tasks via MCP or other agent systems:

1. **Health Checks**: Monitor app connectivity to backend API
2. **User Management**: Sync user data between systems
3. **Schedule Updates**: Push schedule changes to mobile users
4. **Reporting**: Extract clock data for payroll/reporting systems
5. **Alerts**: Send notifications for missed clock in/out

## Contact & Support

For questions or issues with the mobile app, refer to:
- API documentation in main `AGENT.md`
- TypeScript type definitions in `types/api.ts`
- Service implementations in `services/` directory

---

**Last Updated**: February 9, 2026  
**Version**: 1.0.0  
**Maintained By**: ShiftWork Development Team
