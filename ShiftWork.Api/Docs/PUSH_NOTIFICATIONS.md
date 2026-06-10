# Push Notifications Implementation

This document describes the push notification system implemented in ShiftWork.Mobile.

## Overview

The mobile app uses Expo's Push Notification service to receive real-time notifications for:
- Schedule published events
- Shift assignments and changes
- Time off request approvals/denials

## Mobile App Components

### 1. Notification Service (`services/notification.service.ts`)

Core service for managing push notifications:

**Key Methods:**
- `registerForPushNotifications()` - Request permissions and get Expo push token
- `saveDeviceToken()` - Store device token in backend
- `removeDeviceToken()` - Remove token on logout
- `scheduleLocalNotification()` - For testing or offline scenarios
- `addNotificationReceivedListener()` - Listen for foreground notifications
- `addNotificationResponseReceivedListener()` - Handle user taps on notifications

### 2. React Hook (`hooks/useNotifications.ts`)

React hook that integrates notifications into the app lifecycle:

**Features:**
- Auto-registration on app start (when authenticated)
- Automatic token storage in backend
- Foreground notification handling
- Deep linking based on notification type
- Cold start notification handling

**Usage:**
```typescript
const { expoPushToken, notification, error, isRegistered } = useNotifications();
```

### 3. Integration (`app/_layout.tsx`)

The hook is initialized in the root layout to ensure notifications work app-wide:

```typescript
const { expoPushToken, error, isRegistered } = useNotifications();
```

## Backend Components

### 1. DeviceToken Model (`Models/DeviceToken.cs`)

Stores user device tokens:
- `DeviceTokenId` - Primary key
- `CompanyId` - Company association
- `PersonId` - User association
- `Token` - Expo push token
- `Platform` - "ios" or "android"
- `DeviceName` - Device name (optional)

### 2. DeviceTokens API (`Controllers/DeviceTokensController.cs`)

REST API endpoints:
- `GET /api/companies/{companyId}/people/{personId}/device-tokens` - List tokens
- `POST /api/companies/{companyId}/people/{personId}/device-tokens` - Register token
- `DELETE /api/companies/{companyId}/people/{personId}/device-tokens/{token}` - Remove token

### 3. Push Notification Service (`Services/PushNotificationService.cs`)

Backend service for sending push notifications via Expo:

**Core Methods:**
- `SendNotificationToPersonAsync()` - Send to specific person
- `SendNotificationToMultiplePeopleAsync()` - Send to list of people
- `SendNotificationToCompanyAsync()` - Broadcast to company

**Event-Specific Methods:**
- `NotifySchedulePublishedAsync()` - When schedule is published
- `NotifyShiftAssignedAsync()` - When shift assigned to person
- `NotifyTimeOffApprovedAsync()` - Time off approved
- `NotifyTimeOffDeniedAsync()` - Time off denied
- `NotifyShiftChangedAsync()` - Shift time/details changed

## Notification Types and Deep Linking

The app handles different notification types with automatic navigation:

| Notification Type | Navigates To | Triggered When |
|------------------|--------------|----------------|
| `schedule_published` | Weekly Schedule | New schedule published |
| `shift_assigned` | Schedule Tab | New shift assigned |
| `shift_changed` | Schedule Tab | Shift time/details changed |
| `time_off_approved` | Dashboard | Time off approved |
| `time_off_denied` | Dashboard | Time off denied |

## Implementation Examples

### Sending Notification from Backend

#### Example 1: Schedule Published
```csharp
// In your SchedulesController or service
private readonly PushNotificationService _pushNotificationService;

// When publishing a schedule
public async Task<IActionResult> PublishSchedule(int scheduleId)
{
    // ... your schedule publishing logic ...
    
    await _pushNotificationService.NotifySchedulePublishedAsync(
        companyId, 
        scheduleId, 
        schedule.StartDate, 
        schedule.EndDate
    );
    
    return Ok();
}
```

#### Example 2: Time Off Approval
```csharp
// In PtoController or service
public async Task<IActionResult> ApproveTimeOff(int requestId)
{
    var request = await GetTimeOffRequest(requestId);
    request.Status = "Approved";
    await SaveChanges();
    
    await _pushNotificationService.NotifyTimeOffApprovedAsync(
        request.CompanyId,
        request.PersonId,
        request.StartDate,
        request.EndDate,
        request.Type
    );
    
    return Ok();
}
```

#### Example 3: Shift Assignment
```csharp
// When assigning a shift to a person
public async Task<IActionResult> AssignShift(int shiftId, int personId)
{
    var shift = await AssignShiftToPerson(shiftId, personId);
    
    await _pushNotificationService.NotifyShiftAssignedAsync(
        companyId,
        personId,
        shiftId,
        shift.StartDate
    );
    
    return Ok();
}
```

## Database Migration

You'll need to create a migration for the `device_tokens` table:

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

CREATE INDEX IX_device_tokens_company_person 
    ON device_tokens(company_id, person_id);
CREATE INDEX IX_device_tokens_token 
    ON device_tokens(token);
```

## Configuration

### Mobile App

Update `services/notification.service.ts` with your Expo project ID:

```typescript
const tokenData = await Notifications.getExpoPushTokenAsync({
  projectId: 'your-actual-expo-project-id', // Get from app.json or Expo dashboard
});
```

### Testing

#### Test Local Notifications (Mobile)
```typescript
import { notificationService } from '@/services';

// Schedule a test notification
await notificationService.scheduleLocalNotification(
  'Test Title',
  'Test Body',
  { type: 'test', customData: 'value' }
);
```

#### Test Push Notifications (Backend)
```csharp
// In any controller
await _pushNotificationService.SendNotificationToPersonAsync(
    companyId,
    personId,
    "Test Notification",
    "This is a test message",
    new Dictionary<string, object> { { "type", "test" } }
);
```

## Troubleshooting

### Notifications Not Received

1. **Check Device Token Registration**
   - Verify token is saved in `device_tokens` table
   - Check app logs for registration errors

2. **Check Permissions**
   - iOS: Settings > Your App > Notifications
   - Android: Settings > Apps > Your App > Notifications

3. **Physical Device Required**
   - Push notifications don't work in simulators
   - Use actual iOS or Android device for testing

4. **Expo Token Format**
   - Tokens should start with `ExponentPushToken[`
   - Example: `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`

5. **Backend Errors**
   - Check API logs for failed notification sends
   - Verify Expo API responses (https://exp.host/--/api/v2/push/send)

### Common Issues

- **"Push notifications only work on physical devices"**: Use real device, not emulator
- **"Permission not granted"**: User denied permissions; prompt again or guide to settings
- **"Failed to get push token"**: Check network connection and Expo project configuration
- **"No device tokens found"**: User hasn't logged in or token registration failed

## Production Checklist

- [ ] Update Expo project ID in notification.service.ts
- [ ] Run database migration for device_tokens table
- [ ] Configure Expo Push Notification credentials
- [ ] Test on physical iOS device
- [ ] Test on physical Android device
- [ ] Add notification icons/sounds
- [ ] Implement notification channels (Android)
- [ ] Add opt-out preferences in user settings
- [ ] Monitor notification delivery rates
- [ ] Handle token refresh/expiration

## Future Enhancements

- [ ] Rich notifications with images/actions
- [ ] Notification preferences (per event type)
- [ ] Scheduled/delayed notifications
- [ ] Notification history in-app
- [ ] Analytics and delivery tracking
- [ ] Silent notifications for background updates
- [ ] Group/category notifications
- [ ] Custom notification sounds
