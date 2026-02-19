# Company User Roles & Permissions Architecture

## Overview
This document summarizes the current architecture for managing user roles and permissions in the ShiftWork platform. It is intended for developers, architects, and reviewers to understand, maintain, and extend the system.

---

## Key Entities

### 1. CompanyUsers
- Represents a user's account at the company level.
- Linked to authentication (e.g., Firebase UID or email).
- Contains user identity, status, and references to profiles.

### 2. CompanyUserProfiles
- Stores the roles, permissions, and profile settings for each user within a company.
- A user can have multiple profiles (e.g., Admin, Manager, Employee) for the same or different companies.
- Each profile links to a set of permissions or roles.

### 3. CompanySettings
- Stores company-wide configuration, including available roles, permissions, and defaults for new users.

---

## Authentication & Authorization Flow

1. **Authentication**
   - Users authenticate via Firebase (or another provider).
   - On login, the backend matches the authenticated user (by UID/email) to a `CompanyUser`.
   - The system loads all `CompanyUserProfiles` for that user and company.

2. **Authorization**
   - The user’s permissions are determined by their `CompanyUserProfiles`.
   - Each profile contains a list of roles/permissions (e.g., `['admin', 'scheduler', 'employee']`).
   - The API and UI check these permissions to allow or restrict actions.

---

## New User Onboarding & Role Assignment

### Employee Registration Flow (2-Step Process)

**Step 1: Create Employee Record**
- Admin creates `Person` entity via People form
- API: `POST /api/companies/{companyId}/people`
- Employee can immediately clock in/out using PIN at kiosk
- No app access yet

**Step 2: Enable App Access (When Needed)**
- Admin clicks "Send App Invite" button on Employee Edit page
- Admin selects roles for the employee
- API: `POST /api/companies/{companyId}/people/{personId}/send-invite`
- Backend:
  - Creates `CompanyUser` with pending/invite token
  - Sends Firebase Auth invite email to employee
- Employee receives email, creates Firebase account with password
- Employee completes registration
- API: `POST /api/companies/{companyId}/people/complete-invite` (with Firebase token)
- Backend:
  - Updates `CompanyUser` with real Firebase UID
  - Creates `CompanyUserProfile` entries linking to Person and Roles
- Employee can now login to app

**Key Points:**
- **Person entity**: Created first, always exists
- **CompanyUser**: Created when invite sent, updated with UID when accepted
- **CompanyUserProfile**: Created when invite accepted, links Person + CompanyUser + Roles
- **Roles**: Selected by admin before sending invite
- **All permission checks** use CompanyUserProfiles, not Person.roleId

### API Endpoints

- `POST /api/companies/{companyId}/people` - Create employee
- `POST /api/companies/{companyId}/people/{personId}/send-invite` - Send app invite
- `POST /api/companies/{companyId}/people/complete-invite` - Complete registration
- `GET /api/companies/{companyId}/people/{personId}/invite-status` - Check app access status
- `POST /api/companies/{companyId}/companyuserprofiles/assign` - Manage roles

---

## Deprecation of People.roleId/roleIds

- The old `roleId`/`roleIds` field on the People entity is deprecated and no longer used for permissions.
- All role/permission logic is now handled by `CompanyUserProfiles` (per-user, per-company, multi-role).
- `CompanySettings` defines what roles exist and what defaults are assigned.

---

## Summary of Flow

1. **User logs in** → Auth token validated → `CompanyUser` loaded.
2. **Profiles loaded** → All `CompanyUserProfiles` for that user/company.
3. **Permissions checked** → UI/API uses these profiles for access control.
4. **New user** → `CompanyUser` + `CompanyUserProfile(s)` created, roles assigned from `CompanySettings`.

---

## Notes for Refactoring & Review
- Remove all usage of `roleId`/`roleIds` from People-related code.
- Ensure all permission checks reference `CompanyUserProfiles`.
- UI for role assignment should interact with the new profile/role system, not the People entity.
- Keep `CompanySettings` up to date with available roles and default assignments.
- See [EMPLOYEE_REGISTRATION_FLOW.md](EMPLOYEE_REGISTRATION_FLOW.md) for detailed employee onboarding flows.

---

*Last updated: 2026-02-19*
