# Role and Permission Refactor Plan

## Scope
Refactor user profile, role, and permission handling to a consistent, auditable, and secure RBAC model with clear API contracts and UI behavior.

## Current State Review (Key Files)
- Backend role model: [ShiftWork.Api/Models/Role.cs](ShiftWork.Api/Models/Role.cs)
- Backend role endpoints: [ShiftWork.Api/Controllers/RolesController.cs](ShiftWork.Api/Controllers/RolesController.cs)
- Backend role service: [ShiftWork.Api/Services/RoleService.cs](ShiftWork.Api/Services/RoleService.cs)
- Role DTO: [ShiftWork.Api/DTOs/RoleDto.cs](ShiftWork.Api/DTOs/RoleDto.cs)
- Role mapping: [ShiftWork.Api/Helpers/MappingProfiles.cs](ShiftWork.Api/Helpers/MappingProfiles.cs)
- User identity model: [ShiftWork.Api/Models/CompanyUser.cs](ShiftWork.Api/Models/CompanyUser.cs)
- User profile model: [ShiftWork.Api/Models/Person.cs](ShiftWork.Api/Models/Person.cs)
- People UI uses RoleId: [ShiftWork.Angular/src/app/features/dashboard/people/people.component.ts](ShiftWork.Angular/src/app/features/dashboard/people/people.component.ts)
- Role client: [ShiftWork.Angular/src/app/core/services/role.service.ts](ShiftWork.Angular/src/app/core/services/role.service.ts)
- Auth flow: [ShiftWork.Angular/src/app/core/services/auth.service.ts](ShiftWork.Angular/src/app/core/services/auth.service.ts)

## Current Behavior Summary
- Role permissions stored as a string in Role (JSON or comma-separated).
- Person has a nullable RoleId (single role per person).
- CompanyUser is a separate identity record (Firebase UID) with no explicit link to Role or Person.
- Auth uses Firebase, then fetches Person by email.
- No explicit permission checks in API controllers; access is effectively coarse-grained.

## Gaps and Risks
- No canonical permission registry (string list in Role is unvalidated).
- No explicit link between CompanyUser (auth identity) and Person (profile).
- Role is single-assignment via Person.RoleId; no support for multiple roles.
- Permissions are not enforced at API boundary, risking data overexposure.
- Permissions are not included in JWT claims, so UI cannot reliably gate actions.
- Inconsistent update patterns for role/permission changes (no invalidation or versioning).

## Refactor Goals
- Single source of truth for permissions.
- Explicit relationship between auth identity and profile.
- Enforce authorization server-side with policies.
- Enable feature gating in UI without duplicating rules.
- Preserve multi-tenant isolation with company scoping.

## Recommended Architecture (RBAC with Permission Registry)
### Data Model (Backend)
Introduce normalized tables to replace string-based permissions:

- Permission
  - PermissionId (int)
  - Key (string, unique) e.g. "people.read"
  - Name (string)
  - Description (string)
  - Status (Active/Inactive)

- RolePermission (join)
  - RoleId
  - PermissionId

- UserRole (join)
  - CompanyUserId (or PersonId)
  - RoleId
  - CompanyId

- CompanyUserProfile (link)
  - CompanyUserId (FK)
  - PersonId (FK)
  - CompanyId

### Notes
- Keep Person.RoleId for backward compatibility only (deprecated), then migrate to UserRole.
- Use CompanyUserId for auth identity; link to Person for profile data.

## Authorization Model
### Server-Side
- Add policy-based authorization using permission keys.
- Map permissions to claims in JWT (custom claims from Firebase or server-side enrichment).
- Example policy: "people.read" required for GET /people.

### Client-Side
- Add a PermissionService that reads permissions from auth token or a user profile endpoint.
- UI should hide actions if permissions are missing, but still rely on server enforcement.

## API Changes
### New Endpoints
- GET /api/companies/{companyId}/permissions
- GET /api/companies/{companyId}/roles/{roleId}/permissions
- PUT /api/companies/{companyId}/roles/{roleId}/permissions
- GET /api/companies/{companyId}/users/{uid}/roles
- PUT /api/companies/{companyId}/users/{uid}/roles

### Auth Claims
- Include "permissions" array and "roles" array in token claims.
- Add versioning for claims (permissionsVersion) to force refresh when roles change.

## Migration Plan (Safe, Phased)
1) Add new tables (Permission, RolePermission, UserRole, CompanyUserProfile).
2) Seed Permission registry with standard actions (read, create, update, delete per entity).
3) Backfill RolePermission from Role.Permissions string.
4) Backfill UserRole from Person.RoleId where possible.
5) Add CompanyUserProfile linking Person and CompanyUser by email or UID.
6) Update code paths to read from new tables.
7) Deprecate Role.Permissions string and Person.RoleId.

## Compatibility and Data Rules
- If Role.Permissions is empty, treat as no permissions, not full access.
- If user has no roles, default to read-only or deny-all based on policy.
- Enforce company boundary at every query.

## UI Changes (Angular)
- Add permissions in user state (NgRx or AuthService cache).
- Route guards for admin pages using permission checks.
- Disable actions (save, delete) when user lacks permissions.

## Auditing
- Track role and permission changes in audit history.
- Log role assignment changes as separate audit entries.

## Testing
- Unit tests for policy evaluation.
- Integration tests for role assignment and access denial.
- Migration tests for role/permission backfill.

## Open Decisions
- Single role vs multi-role per user (recommended: multi-role).
- Use CompanyUserId vs PersonId as principal (recommended: CompanyUserId).
- Where to store permissions claims (recommended: server-issued JWT or Firebase custom claims).

## Suggested Implementation Order
1) Data model + migrations
2) Permission registry and seeding
3) Role and user role endpoints
4) Auth claims enrichment
5) API policy enforcement
6) UI permission gating

## Definition of Done
- Permissions enforced in API for all company-scoped endpoints.
- UI reflects permissions without breaking usability.
- Role and permission changes are auditable.
- Legacy fields are deprecated with migration complete.
