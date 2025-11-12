# ShiftWork Mobile App - Features Implementation Summary

## Overview

This document summarizes the mobile app features implemented for time off management, weekly schedule viewing, and push notifications.

## Completed Features

### 1. Time Off Request Management ✅

#### Frontend (Mobile)
- **Service Layer** (`services/time-off-request.service.ts`)
  - Full CRUD operations for time off requests
  - PTO balance retrieval
  - Business days calculation (excludes weekends)
  - Hours estimation (8 hours per business day)
  - Filtered queries: pending, upcoming (30 days), history (90 days)

- **Dashboard Integration** (`app/(tabs)/dashboard.tsx`)
  - Time Off section displaying pending and upcoming requests
  - Status badges (Approved/Denied/Pending) with color coding
  - Empty state with "Request Time Off" link
  - Navigation to request form

- **Request Form** (`app/(tabs)/time-off-request.tsx`)
  - PTO balance display card
  - Type selector: Vacation, Sick, PTO, Unpaid, Personal
  - Start/End date pickers using @react-native-community/datetimepicker
  - Real-time hours estimation
  - Multiline reason input
  - Validation: end date >= start date, minimum date is today
  - Success/error handling with alerts

#### Features
- ✅ View pending and approved time off requests
- ✅ Submit new time off requests with validation
- ✅ View current PTO balance
- ✅ Automatic calculation of business days and hours
- ✅ Status-based UI (color-coded borders and badges)
- ✅ Navigation from dashboard to request form

---

### 2. Weekly Schedule View ✅

#### Frontend (Mobile)
- **Weekly Calendar Screen** (`app/(tabs)/weekly-schedule.tsx`)
  - Week navigation: Previous, Next, Current Week buttons
  - 7-day grid (Sunday - Saturday)
  - Stats header: Total hours and days scheduled for the week
  - Shift cards per day showing:
    - Time range (8:00 AM - 5:00 PM)
    - Duration in hours
    - Notes/description
    - Status badge
  - Today highlighting with blue border and text
  - Empty states for days without shifts
  - Only shows published/approved shifts

#### Features
- ✅ Weekly calendar view with Sunday-Saturday grid
- ✅ Navigate between weeks (previous/next/current)
- ✅ View all approved shifts for the week
- ✅ Calculate total hours per week
- ✅ Count days scheduled
- ✅ Today indicator
- ✅ Shift details: time, duration, notes, status

---

### 3. Push Notifications ✅

#### Frontend (Mobile)
- **Notification Service** (`services/notification.service.ts`)
  - Permission handling for iOS/Android
  - Expo push token registration
  - Device token management (save/remove)
  - Local notification scheduling (for testing)
  - Badge count management
  - Notification listeners (received/response)

- **React Hook** (`hooks/useNotifications.ts`)
  - Automatic registration on app start
  - Token storage in backend
  - Foreground notification handling
  - Deep linking based on notification type:
    - `schedule_published` → Weekly Schedule
    - `shift_assigned/changed` → Schedule Tab
    - `time_off_approved/denied` → Dashboard
  - Cold start notification handling

- **Integration** (`app/_layout.tsx`)
  - Hook initialized in root layout
  - Console logging for debugging

#### Backend (API)
- **DeviceToken Model** (`Models/DeviceToken.cs`)
  - Store Expo push tokens per user/device
  - Track platform (iOS/Android) and device name
  - Timestamps: created_at, last_updated

- **DeviceTokens Controller** (`Controllers/DeviceTokensController.cs`)
  - `GET /api/companies/{companyId}/people/{personId}/device-tokens` - List tokens
  - `POST /api/companies/{companyId}/people/{personId}/device-tokens` - Register token
  - `DELETE /api/companies/{companyId}/people/{personId}/device-tokens/{token}` - Remove token

- **Push Notification Service** (`Services/PushNotificationService.cs`)
  - Send notifications via Expo Push API
  - Target specific person, multiple people, or entire company
  - Event-specific helpers:
    - `NotifySchedulePublishedAsync()`
    - `NotifyShiftAssignedAsync()`
    - `NotifyTimeOffApprovedAsync()`
    - `NotifyTimeOffDeniedAsync()`
    - `NotifyShiftChangedAsync()`

#### Features
- ✅ Push notification registration on app start
- ✅ Device token storage in database
- ✅ Foreground notification display
- ✅ Notification tap handling with deep linking
- ✅ Backend service for sending notifications
- ✅ Event-specific notification methods
- ✅ Support for schedule, shift, and time off events

---

## Files Created/Modified

### Mobile App (ShiftWork.Mobile)

**New Files:**
1. `services/time-off-request.service.ts` - Time off CRUD service
2. `services/notification.service.ts` - Push notification service
3. `app/(tabs)/time-off-request.tsx` - Request form screen
4. `app/(tabs)/weekly-schedule.tsx` - Weekly calendar screen
5. `hooks/useNotifications.ts` - React hook for notifications

**Modified Files:**
1. `app/(tabs)/dashboard.tsx` - Added time off section and View Weekly button
2. `app/(tabs)/_layout.tsx` - Added hidden routes for new screens
3. `app/_layout.tsx` - Integrated useNotifications hook
4. `services/index.ts` - Exported new services

### Backend API (ShiftWork.Api)

**New Files:**
1. `Models/DeviceToken.cs` - Device token model
2. `Controllers/DeviceTokensController.cs` - Device token API
3. `Services/PushNotificationService.cs` - Push notification service

**Modified Files:**
1. `Data/ShiftWorkContext.cs` - Added DeviceTokens DbSet
2. `Program.cs` - Registered PushNotificationService and HttpClient

### Documentation

**New Files:**
1. `PUSH_NOTIFICATIONS.md` - Complete push notification guide

---

## Dependencies Installed

### Mobile App
- ✅ `expo-notifications` - Expo push notification SDK
- ✅ `expo-device` - Device information
- ✅ `@react-native-community/datetimepicker` - Date/time picker

---

## Database Changes Required

### New Table: device_tokens

```sql
CREATE TABLE device_tokens (
    device_token_id INT IDENTITY(1,1) PRIMARY KEY,
    company_id INT NOT NULL,
    person_id INT NOT NULL,
    token NVARCHAR(500) NOT NULL,
    platform NVARCHAR(20) NOT NULL,
    device_name NVARCHAR(200),
    created_at DATETIME2 NOT NULL,
    last_updated DATETIME2 NOT NULL,
    FOREIGN KEY (company_id) REFERENCES Companies(CompanyId),
    FOREIGN KEY (person_id) REFERENCES People(PersonId)
);

CREATE INDEX IX_device_tokens_company_person ON device_tokens(company_id, person_id);
CREATE INDEX IX_device_tokens_token ON device_tokens(token);
```

---

## Configuration Steps

### 1. Mobile App Configuration

Update `services/notification.service.ts` line 42:
```typescript
const tokenData = await Notifications.getExpoPushTokenAsync({
  projectId: 'your-actual-expo-project-id', // Get from app.json
});
```

### 2. Database Migration

Run the SQL script above to create the `device_tokens` table.

### 3. Expo Push Notification Setup

- Get Expo project ID from `app.json` or Expo dashboard
- Configure FCM (Firebase Cloud Messaging) for Android
- Configure APNs (Apple Push Notification service) for iOS

---

## How to Test

### Time Off Requests
1. Open mobile app and navigate to Dashboard
2. Tap "+ Request" in Time Off section (or the link if no requests)
3. Fill form: select type, pick dates, add reason
4. Tap "Submit Request"
5. Verify request appears on dashboard with "Pending" status

### Weekly Schedule
1. From Dashboard, tap "View Weekly" in Upcoming Shifts section
2. Navigate between weeks using arrows or "Current Week" button
3. Verify shifts display with correct times and details
4. Check that today is highlighted with blue border

### Push Notifications
1. **Local Test (Mobile)**:
   ```typescript
   import { notificationService } from '@/services';
   
   await notificationService.scheduleLocalNotification(
     'Test', 
     'This is a test notification'
   );
   ```

2. **Backend Test (API)**:
   ```csharp
   await _pushNotificationService.SendNotificationToPersonAsync(
       companyId,
       personId,
       "Test Title",
       "Test Message",
       new Dictionary<string, object> { { "type", "test" } }
   );
   ```

3. **Tap Notification**: Verify it navigates to correct screen based on type

---

## Integration Points

### When to Send Notifications

#### Schedule Published
```csharp
// In SchedulesController after publishing
await _pushNotificationService.NotifySchedulePublishedAsync(
    companyId, scheduleId, schedule.StartDate, schedule.EndDate
);
```

#### Time Off Approved
```csharp
// In PtoController after approval
await _pushNotificationService.NotifyTimeOffApprovedAsync(
    request.CompanyId, request.PersonId, 
    request.StartDate, request.EndDate, request.Type
);
```

#### Shift Assigned
```csharp
// When assigning shift to person
await _pushNotificationService.NotifyShiftAssignedAsync(
    companyId, personId, shiftId, shift.StartDate
);
```

---

## Known Limitations

1. **Push Notifications**
   - Only work on physical devices (not simulators/emulators)
   - Require user permission
   - Expo project ID must be configured

2. **Time Off Requests**
   - Backend approval flow not automated
   - No in-app cancellation (can be added)

3. **Weekly Schedule**
   - Shows only published/approved shifts
   - No filtering by location/area (can be added)

4. **General**
   - No offline support
   - No pull-to-refresh (can be added)

---

## Next Steps (Optional Enhancements)

### High Priority
- [ ] Create database migration for device_tokens
- [ ] Add push notification triggers in API controllers
- [ ] Configure Expo project ID in mobile app
- [ ] Test on physical iOS/Android devices

### Medium Priority
- [ ] Add ability to cancel pending time off requests
- [ ] Add pull-to-refresh on dashboard and weekly schedule
- [ ] Add shift details modal on tap
- [ ] Add filters to weekly schedule (location/area)

### Low Priority
- [ ] Rich notifications with images/actions
- [ ] Notification preferences (per event type)
- [ ] Notification history in-app
- [ ] Custom notification sounds

---

## Support & Documentation

- **Push Notifications Guide**: See `PUSH_NOTIFICATIONS.md` for detailed setup
- **Expo Notifications Docs**: https://docs.expo.dev/versions/latest/sdk/notifications/
- **Expo Push API**: https://docs.expo.dev/push-notifications/sending-notifications/

---

## Summary

All requested mobile app features have been successfully implemented:

1. ✅ **Dashboard with Time Off** - History and time off requests displayed
2. ✅ **Request Time Off** - Complete form with PTO balance and validation
3. ✅ **Weekly Schedule View** - See approved shifts by week with navigation
4. ✅ **Push Notifications** - Receive notifications when schedules published, time off approved/denied

The implementation is production-ready pending:
- Database migration for device_tokens table
- Expo project ID configuration
- Integration of notification triggers in API controllers
- Physical device testing
