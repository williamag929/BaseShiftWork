# Employee Registration & User Account Flow

## Overview
This document explains how to create employees in the ShiftWork system and optionally link them to Firebase-authenticated user accounts (CompanyUsers).

---

## Architecture Relationships

```
Firebase User (UID)
    ↓
CompanyUser (Uid, Email, DisplayName)
    ↓
CompanyUserProfile (CompanyUserId, RoleId, PersonId)
    ↓
Person (PersonId, Name, Email) ← Employee record
```

**Key Points:**
- **Person**: Employee record (always created)
- **CompanyUser**: Authenticated user account (optional, only if employee needs app login)
- **CompanyUserProfile**: Links CompanyUser to Roles, optionally linked to Person

---

## Recommended Flow (Simplified)

### Step 1: Create Employee (Always Done First)
**Use Case**: Admin creates employee record for any employee (kiosk-only or app user)

**Flow:**
1. Admin fills employee form in Angular:
   - Name, Email, Phone, PIN (for kiosk)
   - Status, Address, etc.
2. Frontend calls:
   ```http
   POST /api/companies/{companyId}/people
   {
     "name": "John Doe",
     "email": "john@example.com",
     "phoneNumber": "555-1234",
     "pin": "1234",
     "status": "Active"
   }
   ```
3. Backend creates `Person` entity only
4. Employee can now clock in/out via kiosk using PIN

**Result:** Employee exists in system, can use kiosk, but CANNOT login to app yet.

---

### Step 2: Enable App Access (Optional - Only When Needed)
**Use Case**: Employee needs to access mobile/web app

**UI Element:** "Send App Invite" button on Employee Edit page

**Flow:**
1. Admin opens employee edit page, clicks "Send App Invite" button
2. Angular shows role selection dialog:
   ```typescript
   // User selects roles: ["Employee", "Scheduler"]
   const selectedRoleIds = [2, 3];
   ```

3. Frontend calls invite endpoint:
   ```http
   POST /api/companies/{companyId}/people/{personId}/send-invite
   {
     "roleIds": [2, 3],
     "inviteUrl": "https://app.shiftwork.com/accept-invite"
   }
   ```

4. Backend:
   - Creates `CompanyUser` with pending status and temporary invite token
   - Stores selected roles in pending profiles or temp storage
   - Sends email with Firebase Auth invite link + invite token
   - Email contains: "Accept Invite" link

5. Employee receives email, clicks link

6. Employee lands on registration page:
   - Pre-filled: Name, Email (from Person record)
   - Employee enters: Password, confirms info
   - Page has invite token in URL

7. Frontend:
   - Creates Firebase account with email/password
   - Gets Firebase UID from created account
   - Calls backend to complete registration:
   ```http
   POST /api/companies/{companyId}/people/complete-invite
   Authorization: Bearer {firebase-token}
   {
     "inviteToken": "abc123",
     "personId": 456
   }
   ```

8. Backend:
   - Validates Firebase token, extracts real UID
   - Updates `CompanyUser` with real Firebase UID
   - Creates `CompanyUserProfile` entries for assigned roles
   - Links CompanyUserProfile.PersonId to existing Person
   - Marks invite as completed

**Result:** Employee can now login to app with email/password, has assigned roles, still linked to same Person record.

---

## Alternative: Quick Invite Without Pre-Selection

If you want even simpler flow without role pre-selection:

1. Admin clicks "Send App Invite" (no role dialog)
2. Backend sends invite with default "Employee" role
3. Admin can assign additional roles later via Profiles UI
4. Rest of flow is the same

---

## Database Structure

### Person Table (Employees)
```sql
PersonId (PK)
Name
Email
CompanyId
PhoneNumber
Pin  -- For kiosk clock-in
Status
RoleId  -- DEPRECATED, use CompanyUserProfiles instead
```

### CompanyUsers Table (Authenticated Users)
```sql
CompanyUserId (PK, auto-generated)
Uid  -- Firebase UID
Email
DisplayName
PhotoURL
EmailVerified
CompanyId
CreatedAt
UpdatedAt
```

### CompanyUserProfiles Table (User-Role Assignments)
```sql
ProfileId (PK)
CompanyUserId (FK)
CompanyId (FK)
RoleId (FK)
PersonId (FK, optional)  -- Links to Person if employee
IsActive
AssignedAt
AssignedBy
```

---

## Implementation Checklist

### Backend API Endpoints:

- [x] `POST /api/companies/{companyId}/people` - Create employee (existing)
- [ ] `POST /api/companies/{companyId}/people/{personId}/send-invite` - Send app invite with roles
- [ ] `POST /api/companies/{companyId}/people/complete-invite` - Complete registration with Firebase UID
- [ ] `GET /api/companies/{companyId}/people/{personId}/invite-status` - Check if employee has app access
- [x] `POST /api/companies/{companyId}/companyuserprofiles/assign` - Assign additional roles (existing)

### Frontend Components:

- [ ] "Send App Invite" button on People Edit page
- [ ] Role selection dialog for invite
- [ ] Invite acceptance/registration page (public route)
- [ ] Display invite status badge on People list ("Has App Access" / "Kiosk Only")
- [ ] Resend invite functionality

---

## Security Considerations

1. **Firebase Token Validation**: All endpoints that create CompanyUsers MUST validate Firebase JWT token
2. **Email Verification**: Consider requiring email verification before activating CompanyUser
3. **Role Permissions**: Only users with "Admin" or "HR" roles can create employees and assign roles
4. **UID Uniqueness**: Ensure Firebase UID is unique across company (enforced by DB constraint)

---

## Migration Path

For existing deployments with `People.roleId`:

1. Create CompanyUser records for employees with email addresses
2. Migrate `People.roleId` to `CompanyUserProfiles` entries
3. Send Firebase invites to existing employees
4. Remove `roleId` column from People table (future migration)

---

## Example Frontend Code

### Create Employee with User Account
```typescript
async createEmployeeWithLogin(employeeData: any, roleIds: number[]) {
  // Step 1: Send Firebase invite
  const inviteLink = await this.sendFirebaseInvite(employeeData.email);
  
  // Step 2: Create employee record
  const person = await this.peopleService.createPerson(companyId, {
    name: employeeData.name,
    email: employeeData.email,
    phoneNumber: employeeData.phoneNumber,
    status: 'Active'
  }).toPromise();
  
  // Step 3: When user completes registration, link them
  // (This happens in the registration completion page)
  // The Firebase token will be available from the auth context
}

// User Registration Completion Page
async completeRegistration(formData: any) {
  const token = await firebase.auth().currentUser.getIdToken();
  
  await this.http.post(
    `/api/companies/${companyId}/people/register-user`,
    {
      name: formData.name,
      phoneNumber: formData.phoneNumber,
      ...formData
    },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  ).toPromise();
}
```

---

*Last updated: 2026-02-19*
