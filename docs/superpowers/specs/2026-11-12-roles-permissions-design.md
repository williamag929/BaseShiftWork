# Roles and permissions redesign — design

**Date:** 2026-11-12
**Status:** Draft for review
**Owner:** William Aguirre
**Scope:** spec 1 of 2. Spec 2 (kiosk device security) is separate and comes after this one.

## 1. Why

The roles and permissions module was built quickly and grew three overlapping assignment mechanisms. An audit on 2026-11-12 found:

| # | Problem | Effect today |
|---|---|---|
| 1 | Two role-assignment tables: `UserRoles` (read by authorization) and `CompanyUserProfiles` (written by the Roles screen). They sync only on mobile login, and only when the user has no `UserRoles` row. | A role given on the web has no effect until mobile login, and never if the user already had one. |
| 2 | Dead traces: `Person.RoleId` (marked obsolete) and `Role.Permissions` (free text, unused). | Confusion, dead data. |
| 3 | The web never loads permissions (`loadUserClaims` has no caller). | An Admin does not see Analytics, Credentials or Active sites in the menu, nor permission-gated create buttons. |
| 4 | Policies are listed by hand in `Program.cs` (94 lines) while controllers use 102 and the seed has 107. | Caused HTTP 500 on Cost codes, Areas, Procore, Analytics and kiosk questions (patched in `4997f80` by auto-registering missing policies). |
| 5 | The Admin role is recomputed on every API start with every permission. | Removing a permission from Admin is silently undone on restart. |
| 6 | The authorization handler queries the database on every request and every policy, and falls back to matching users by email. | Per-request cost; fragile identity match. |
| 7 | Employees (`Person`) and web users (`CompanyUser`) are separate identities joined only by email. | A mobile user without a matching `CompanyUser` passes no policy. |

Already fixed outside this spec (branch `feature/angular-design-system-screens`): unauthenticated role assignment and other open endpoints (`7efe36c`, `58dfb33`, `653d5aa`), a fallback policy that makes every endpoint private unless it opts out, and a test pinning the approved anonymous endpoints.

## 2. Goal and success criteria

**Goal:** giving someone a role works immediately and predictably, from one source of truth, and nobody sees or does what their role does not allow.

**Success looks like:**
- An Admin assigns "Supervisor" to a person on the web; on that person's next request they can see and do exactly what a Supervisor can, no more and no less.
- A test fails if any endpoint, menu item, route or button uses a permission key that is not in the catalog.
- No company can end up without an active Admin.

## 3. Decisions (from William)

- **Preset roles with adjustments.** Loqzen ships fixed roles; a company assigns them and may switch individual permissions on or off. Companies do not create or delete roles.
- **Company-wide scope.** A role applies to every location. No per-location scoping.
- **One role per person.**
- **Management on the web only for now.** The design keeps one identity per person so the employee app can use roles later. No management screens in the employee app in this project.
- **Loqzen super admin is included.** Kiosk device security is spec 2.
- **Database:** `dbshiftbase` is the QA database. Test companies may be created freely.

## 4. Permission catalog and preset roles

### 4.1 Catalog

One file in the API, `ShiftWork.Api/Authorization/PermissionCatalog.cs`, declares every permission once: key, area, English label, Spanish label. It is the only source for:

- the database seed of `Permissions` (replaces the list in `PermissionSeedService.cs`),
- API policy registration (replaces the 94 hand-written `AddPolicy` lines in `Program.cs`),
- the permission switches on the Roles screen (served by `GET /permissions/catalog`),
- an exported JSON snapshot (`shared/permission-catalog.json`) that the Angular test suite checks against.

Keys keep their current `resource.action` names. The five seeded keys that no endpoint uses (`analytics.export`, `reports.approve`, `reports.export`, `s3.write`, `safety.acknowledge`) are removed unless the plan finds a screen that needs them.

Areas follow the sidebar: Scheduling, Workforce, Time & timesheets, Time off, Job sites, Field communication, Credentials, Analytics & audit, Integrations, Company settings & devices, Users & roles, Billing.

### 4.2 Preset roles and defaults

Six role keys: `admin`, `manager`, `supervisor`, `office`, `viewer`, `employee`.

| Area (resources) | Admin | Manager | Supervisor / Foreman | Office / Payroll | Read only | Employee |
|---|---|---|---|---|---|---|
| Scheduling (schedules, schedule-shifts, tasks, replacement-requests) | All | All | Read; update shifts | Read | Read | — |
| Workforce (people, crews, person-crews) | All | All | Read | Read | Read | — |
| Time & timesheets (shift-events, summaries, approvals, geofence review) | All | All | Read, approve, geofence review | Read, approve | Read | — |
| Time off (timeoff-requests, pto) | All | All | Read, approve | Read | Read | — |
| Job sites (locations, areas, costcodes, active-sites) | All | All | Read | Read | Read | — |
| Field communication (bulletins, documents, safety, reports) | All | All | Read; create safety; submit reports | Read | Read | — |
| Credentials | All | All | Read | Read, track | Read | — |
| Analytics & audit | All | Read | — | Read | Read | — |
| Integrations (procore) | All | Read, sync | — | — | — | — |
| Company settings, kiosk, device tokens | All | Read | — | — | — | — |
| Users & roles (company-users, roles, permissions) | All | Read | — | — | — | — |
| Billing (companies.billing) | All | — | — | — | — | — |

The exact key list per role is written in `PermissionCatalog.cs` and reviewed in the plan.

### 4.3 Rules

- **Admin** always holds every permission and is not editable.
- **Last Admin.** Every company keeps at least one active Admin. The API refuses to remove or downgrade the last one.
- **Adjustable roles.** The other five can have individual permissions switched on or off by the company's Admin, and can be reset to defaults.
- **New catalog permissions.** When Loqzen adds a permission, roles that were never adjusted (`IsCustomized = false`) pick up the new default; adjusted roles keep their exact set and the new permission arrives off.
- **Employee** has no management access on the web. It exists for the future employee-app phase.
- **Super admin** is a flag on the account (`CompanyUser.IsPlatformAdmin`), not a company role. It is set only in the database, never from the UI. It grants the all-companies list and support screens.

## 5. Data model

| Table | Change |
|---|---|
| `Roles` | Add `Key` (nullable string, one of the six keys) and `IsCustomized` (bool). Unique index on (`CompanyId`, `Key`) where `Key` is not null. Drop `Permissions` in the cleanup step. |
| `UserRoles` | The single assignment table. Unique index on (`CompanyUserId`, `CompanyId`): one role per person per company. |
| `RolePermissions` | Unchanged. Holds each company's role-permission set, including adjustments. |
| `Permissions` | Seeded from the catalog. Unchanged shape. |
| `People` | Add `CompanyUserId` (nullable FK to `CompanyUsers`). Drop `RoleId` in the cleanup step. |
| `CompanyUsers` | Add `IsPlatformAdmin` (bool, default false). |
| `CompanyUserProfiles` | Dropped in the cleanup step. |

Each company gets its six roles when it is created (registration) and through the migration for existing companies.

## 6. API

### 6.1 Authorization

- `PermissionAuthorizationHandler` resolves the caller's permission set for the route's company:
  - identify the `CompanyUser` by `Uid`; for API JWTs (employee app), through `Person.CompanyUserId`. No email fallback.
  - permission set = permissions of the user's role in that company; every catalog key if the role is `admin`; every catalog key if `IsPlatformAdmin`.
- The set is cached in `IMemoryCache` for 5 minutes per (user, company). Changing a role's permissions, resetting a role, or changing a user's role evicts the affected entries immediately, so a change applies on the next request.
- Fails closed: if resolution throws, access is denied and the error is logged (`RequestErrorLoggingMiddleware` already records it).
- Policies are registered from the catalog. A test requires every `[Authorize(Policy = …)]` to exist in the catalog. `AddMissingPermissionPolicies` stays as a safety net so a missing key denies (403) instead of returning 500.

### 6.2 Endpoints

All under `api/companies/{companyId}`.

| Method and route | Permission | Behavior |
|---|---|---|
| `GET users/me/claims` | session | Role key, role name, permission keys, `isPlatformAdmin`. Keeps the current response fields so today's web keeps working during rollout. |
| `GET permissions/catalog` | `roles.read` | Catalog grouped by area with English and Spanish labels. |
| `GET roles` | `roles.read` | The six roles with their permission keys, `isCustomized`, people count. |
| `PUT roles/{key}/permissions` | `roles.permissions.update` | Replace a role's permission set; sets `IsCustomized`. 400 for `admin`. 400 for unknown keys. |
| `POST roles/{key}/reset` | `roles.permissions.update` | Restore defaults; clears `IsCustomized`. 400 for `admin`. |
| `PUT users/{companyUserId}/role` | `company-users.roles.update` | Set the user's single role. 409 when it would leave the company without an Admin. |
| `PUT people/{personId}/role` | `company-users.roles.update` | Same, from the People screen. 400 "Send the invitation first" when the person has no linked `CompanyUser` and the role is not `employee`. |

Retired in the cleanup step: `CompanyUserProfilesController` and role creation/deletion endpoints in `RolesController`.

## 7. Web (Angular)

- **Load claims.** After a company is selected and on page reload, the app calls `GET users/me/claims` and stores the result in `PermissionService`. The sidebar shows a skeleton until claims arrive. On any 403 the app reloads claims and shows "You don't have access to this action."
- **Menu.** Every item in `nav.config.ts` declares its permission; `visibleSections` already filters by it.
- **Routes.** Every dashboard route uses the existing `permission.guard` with the same key. A route the user cannot open shows a "No access" page with a link home.
- **Buttons.** Create, edit, delete and approve actions use the existing `hasPermission` directive.
- **Roles screen (`profiles`).** Table of the six roles: name, people count, "Adjusted" chip. Selecting a role opens `lz-side-panel` with the permissions grouped by area as switches (labels from the catalog in the active language), plus "Save" and "Reset to defaults". Admin opens read-only with "Admin always has every permission." No create or delete.
- **People screen.** "Role" column and a single role select in the employee side panel. A person with no web access sees only Employee and an "Send invitation to give web access" action. The last-Admin error from the API is shown inline.
- **Super admin.** The all-companies screen (`manage-companies`) appears and loads only with `isPlatformAdmin`.
- **Key check.** An Angular spec fails if `nav.config.ts`, the route table or templates use a key missing from `shared/permission-catalog.json`.
- All screens follow the design system rules in `CLAUDE.md` (shared/ui, `lz-side-panel` for forms, sentence case, i18n ids with Spanish in `messages.es.xlf`).

## 8. Migration

One additive EF migration plus an idempotent data step that runs on API start (replacing today's `RoleSeedService` behavior):

1. Create the six roles for every company that lacks them, with default permissions.
2. Map existing roles: a role named "Admin" becomes `admin`. Any other existing role (today: "User") is kept with its permissions, `Key = null`, `IsCustomized = true`, and logged for review. Nothing is deleted.
3. Assign each `CompanyUser` exactly one role: its `UserRoles` row if present; else its active `CompanyUserProfiles` row; else `employee`. If a user has several, keep the highest (admin > manager > supervisor > office > viewer > employee > unmapped) and log the rest.
4. Every company without an Admin gets its oldest `CompanyUser` as Admin (one QA company today).
5. Link `People.CompanyUserId` by matching email within the company, once; log people with no match.
6. Running the step twice changes nothing.

QA data on 2026-11-12: 3 companies, 3 company users, 7 people, 4 roles (3 Admin, 1 User), 3 `UserRoles`, 3 active profiles (1 not reflected in `UserRoles`), 1 company without an Admin user, 2 people matching a company user by email.

A second migration (cleanup step) drops `CompanyUserProfiles`, `People.RoleId` and `Roles.Permissions` after the data step is confirmed on the target environment.

## 9. Error handling

| Situation | Behavior |
|---|---|
| Remove or downgrade the last Admin | 409 with a clear message; shown inline on the web |
| Edit Admin's permissions | 400; the web panel is read-only |
| Management role for a person without web access | 400 "Send the invitation first" |
| Company user with no role row | Treated as Employee; no error |
| Role changed while the user has a session | Cache evicted; next request uses the new set; the web reloads claims after the first 403 |
| Policy key missing from the catalog | Test fails; at runtime the policy is still registered and denies (403), never 500 |
| Permission resolution fails | Denied (fail closed) and logged |

## 10. Testing

- **Catalog:** every controller policy is in the catalog; every preset role uses only catalog keys; Admin holds all keys; the JSON snapshot matches the catalog.
- **Authorization handler:** allow and deny by role; adjustments apply; Admin and super admin get everything; cache eviction on each change; company isolation (a role in company A grants nothing in company B).
- **Business rules:** last-Admin guard; Admin not editable; reset to defaults; one role per person; web-access rule; new catalog key reaches non-customized roles only.
- **Migration:** seeded data reproducing today's QA cases (profile without `UserRoles`, "User" role, company without Admin, person without email match, user with several roles); second run is a no-op.
- **Web:** menu filtering; "No access" route; role panel save and reset; Admin read-only; People role select and invitation path; key check against the snapshot.
- **QA walkthrough:** one account per role in a dedicated QA company, driven from the browser pane, checking menu, routes, buttons and a write action per area.

## 11. Rollout

1. **API and additive migration.** New columns, preset roles, data step, catalog-driven policies, new endpoints, backward-compatible `me/claims`. The current web keeps working.
2. **Web.** Claims loading, menu, routes, buttons, Roles screen, People role assignment, super admin gate.
3. **Cleanup.** After the data step is confirmed: drop `CompanyUserProfiles`, `People.RoleId`, `Roles.Permissions`, the old controller and endpoints.

## 12. Out of scope

- Kiosk device security (spec 2): per-tablet tokens for the Kiosk app and the web `/kiosk` route, replacing company-id-only access to `/api/kiosk/...`.
- Management screens in the employee app.
- Per-location role scoping.

## 13. Open items

- **QA accounts.** One Firebase account per role is needed for the walkthrough. Claude cannot create Firebase users; William creates them (or provides one account that the walkthrough re-assigns between roles in a QA company).
