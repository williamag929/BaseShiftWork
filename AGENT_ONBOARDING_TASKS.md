# Agent Task Plan: Registration, Company Setup & Sandbox Onboarding

> **Source Feature Doc:** [FEATURE_REGISTRATION_ONBOARDING.md](FEATURE_REGISTRATION_ONBOARDING.md)  
> **Must Not Break:** [EMPLOYEE_REGISTRATION_FLOW.md](EMPLOYEE_REGISTRATION_FLOW.md)  
> **Agent:** @refactor  
> **Date:** 2026-03-05  

---

## Scope Separation (Critical — Read Before Starting)

These two features share infrastructure but serve **different actors**:

| Concern | EMPLOYEE_REGISTRATION_FLOW | FEATURE_REGISTRATION_ONBOARDING |
|---|---|---|
| Actor | Admin invites an existing employee | New customer self-registers |
| Entry point | `POST /api/companies/{cId}/people/{pId}/send-invite` | `POST /api/auth/register` (**new**) |
| Auth required | Yes (Firebase JWT, admin role) | **No** (public endpoint) |
| Creates Company | No — company already exists | **Yes** — creates company + defaults |
| Creates Person | Optional | **Yes** — sandbox employees |
| Plan/billing | Not applicable | Free/Pro tier, Stripe |
| IsSandbox flag | Never set | Set on seeded records |

**Rule:** All changes in this plan must be **additive** (nullable columns, new routes, new services). Nothing in this plan modifies existing invite/complete-invite logic.

---

## Phase 1 — Data Model & Database Migrations

> **Goal:** Extend the schema additively. No existing column renaming or removal.

### Tasks

**1.1 — Extend `Company` model**
- File: `ShiftWork.Api/Models/Company.cs`
- Add the following nullable properties:
  ```csharp
  public string? Plan { get; set; }                  // "Free" | "Pro" | "Trial"
  public DateTime? PlanExpiresAt { get; set; }       // null = no expiry
  public string? OnboardingStatus { get; set; }      // "Pending" | "Verified" | "Complete"
  public string? StripeCustomerId { get; set; }      // Stripe customer reference
  public string? StripeSubscriptionId { get; set; }  // Stripe subscription reference
  ```
- **Non-breaking:** all nullable, EF migration sets column default to NULL.

**1.2 — Add `IsSandbox` flag to seedable entities**
- Files: `Models/Person.cs`, `Models/Area.cs`, `Models/Location.cs`
- Add to each:
  ```csharp
  public bool IsSandbox { get; set; } = false;
  ```
- **Non-breaking:** default `false` means all existing records are unaffected.

**1.3 — Create EF migration for schema changes**
- Run from `ShiftWork.Api/` directory:
  ```
  dotnet ef migrations add AddOnboardingAndSandboxFields
  dotnet ef database update
  ```
- Migration must include:
  - `Company.Plan` (nvarchar, nullable)
  - `Company.PlanExpiresAt` (datetime2, nullable)
  - `Company.OnboardingStatus` (nvarchar, nullable)
  - `Company.StripeCustomerId` (nvarchar, nullable)
  - `Company.StripeSubscriptionId` (nvarchar, nullable)
  - `Person.IsSandbox` (bit, default 0)
  - `Area.IsSandbox` (bit, default 0)
  - `Location.IsSandbox` (bit, default 0)

**1.4 — Define sandbox seed template constants**
- File: `ShiftWork.Api/Services/SandboxSeedTemplate.cs` (new)
- Define static defaults for:
  - 1 sandbox Location (name: "Main Location - Example")
  - 1 sandbox Area (name: "Main Area - Example")
  - 2 sandbox Persons (names: "Sample Employee 1", "Sample Employee 2", PIN: "0000")
- All records tagged `IsSandbox = true`.

---

## Phase 2 — API: Registration & Onboarding Endpoints

> **Goal:** Implement the public registration endpoint and company-scoped sandbox management endpoints without modifying any existing routes.

### Tasks

**2.1 — New DTOs for registration**
- File: `ShiftWork.Api/DTOs/RegistrationDtos.cs` (new)
- Define:
  ```csharp
  // POST /api/auth/register
  public class CompanyRegistrationRequest
  {
      // User fields
      public string FirebaseUid { get; set; }
      public string UserEmail { get; set; }
      public string UserDisplayName { get; set; }

      // Company fields
      public string CompanyName { get; set; }
      public string CompanyEmail { get; set; }
      public string? CompanyPhone { get; set; }
      public string TimeZone { get; set; }
  }

  public class CompanyRegistrationResponse
  {
      public string CompanyId { get; set; }
      public string Plan { get; set; }
      public string OnboardingStatus { get; set; }
      public CompanyUserDto AdminUser { get; set; }
  }

  // POST /api/companies/{companyId}/sandbox/hide
  public class SandboxHideRequest
  {
      public List<string> EntityTypes { get; set; } // "Person", "Area", "Location", "All"
  }

  // GET /api/companies/{companyId}/sandbox/status
  public class SandboxStatusResponse
  {
      public bool HasSandboxData { get; set; }
      public int SandboxPersonCount { get; set; }
      public int SandboxAreaCount { get; set; }
      public int SandboxLocationCount { get; set; }
  }
  ```

**2.2 — Registration endpoint in `AuthController`**
- File: `ShiftWork.Api/Controllers/AuthController.cs`
- Add `POST /api/auth/register` — **no `[Authorize]` attribute** (public route)
- Logic sequence:
  1. Validate Firebase UID is not already registered to another CompanyUser.
  2. Generate a new `CompanyId` (Guid).
  3. Create `Company` record with `Plan = "Free"`, `OnboardingStatus = "Pending"`.
  4. Create `CompanyUser` record with the provided `FirebaseUid` and `UserEmail`.
  5. Assign the "Owner" or "Admin" role via `CompanyUserProfile` (create record with highest privilege role for that company).
  6. Call `ISandboxService.SeedSandboxDataAsync(companyId)` to seed sandbox records.
  7. Return `CompanyRegistrationResponse`.

**2.3 — `ISandboxService` and `SandboxService`**
- Files: `ShiftWork.Api/Services/ISandboxService.cs` (new), `ShiftWork.Api/Services/SandboxService.cs` (new)
- Interface:
  ```csharp
  Task SeedSandboxDataAsync(string companyId);
  Task HideSandboxDataAsync(string companyId, IEnumerable<string> entityTypes);
  Task ResetSandboxDataAsync(string companyId);
  Task DeleteSandboxDataAsync(string companyId);
  Task<SandboxStatusResponse> GetSandboxStatusAsync(string companyId);
  ```
- `SeedSandboxDataAsync` creates 1 Location, 1 Area, 2 Persons from `SandboxSeedTemplate` with `IsSandbox = true`.
- `HideSandboxDataAsync` sets a `IsHidden` or `Status = "Hidden"` flag (see note in 2.4).
- `ResetSandboxDataAsync` deletes all `IsSandbox = true` records and re-seeds.
- `DeleteSandboxDataAsync` permanently removes all `IsSandbox = true` records (no re-seed).
- Register in `Program.cs`: `builder.Services.AddScoped<ISandboxService, SandboxService>();`

**2.4 — Sandbox "hide" strategy**
- Rather than adding a new `IsHidden` column, reuse `Person.Status = "Sandbox"` for hidden sandbox persons, and a similar pattern for Location/Area.
- This avoids another migration and keeps existing list queries working (`Status != "Sandbox"` filter).
- Document this decision in this file under the Decisions section at the bottom.

**2.5 — Sandbox management controller**
- File: `ShiftWork.Api/Controllers/SandboxController.cs` (new)
- Route prefix: `api/companies/{companyId}/sandbox`
- Endpoints:
  - `GET  /status` → `GetSandboxStatusAsync`
  - `POST /hide`   → `HideSandboxDataAsync`
  - `POST /reset`  → `ResetSandboxDataAsync`
  - `POST /delete` → `DeleteSandboxDataAsync`
- All endpoints require `[Authorize]` + company membership check.
- Inject `ISandboxService`.

**2.6 — Plan upgrade endpoint**
- File: `ShiftWork.Api/Controllers/CompanyController.cs` (add action, do not rewrite file)
- Add `POST /api/companies/{companyId}/plan/upgrade`
- Accept body: `{ "stripePaymentMethodId": "pm_xxx", "targetPlan": "Pro" }`
- Delegate real Stripe calls to `IPlanService` (stub for now if Stripe not configured; log and return 200 with simulated success matching the notification service pattern).
- Update `Company.Plan`, `Company.StripeCustomerId`, `Company.StripeSubscriptionId` on success.

**2.7 — `IPlanService` and `PlanService`**
- Files: `ShiftWork.Api/Services/IPlanService.cs` (new), `ShiftWork.Api/Services/PlanService.cs` (new)
- Interface:
  ```csharp
  Task<bool> UpgradePlanAsync(string companyId, string stripePaymentMethodId, string targetPlan);
  string GetCurrentPlan(string companyId);
  bool IsFeatureEnabled(string companyId, string featureKey);
  ```
- `PlanService` reads `Company.Plan` from DB; if Stripe env vars are absent it simulates upgrade (same graceful fallback as notification service).
- Register in `Program.cs`: `builder.Services.AddScoped<IPlanService, PlanService>();`

---

## Phase 3 — Angular Web App

> **Goal:** Add public registration and onboarding routes. Do NOT modify existing authenticated routes.

### Tasks

**3.1 — Registration module/component**
- Path: `ShiftWork.Angular/src/app/registration/`
- Create a lazy-loaded `RegistrationModule` with 3 steps (route: `/register`):
  - Step 1: User info (display name, email — pre-filled from Firebase if available)
  - Step 2: Company info (name, phone, timezone)
  - Step 3: Confirm + submit → calls `POST /api/auth/register`
- This route is a **public route** (no auth guard). Add to `app-routing.module.ts` outside the auth-guarded section.
- On success, redirect to `/onboarding`.

**3.2 — Email verification step**
- After `POST /api/auth/register` succeeds, call Firebase `sendEmailVerification()` client-side.
- Show "Check your email" screen at `/register/verify`.
- Poll or listen for Firebase `currentUser.emailVerified` to become true.
- When verified, call `PATCH /api/companies/{companyId}` to set `OnboardingStatus = "Verified"`.

**3.3 — Onboarding module/component**
- Path: `ShiftWork.Angular/src/app/onboarding/`
- Route: `/onboarding` (public after registration but gated by `CompanyRegistrationResponse` data in session).
- Show sandbox data explanation banner.
- Actions:
  - "Hide sandbox data" → `POST /api/companies/{companyId}/sandbox/hide`
  - "Reset sandbox data" → `POST /api/companies/{companyId}/sandbox/reset`
  - "I'm ready, remove sandbox data" → `POST /api/companies/{companyId}/sandbox/delete`
- Show button to proceed to dashboard.

**3.4 — Plan upgrade page**
- Path: `ShiftWork.Angular/src/app/upgrade/`
- Route: `/upgrade` (authenticated route — add inside auth-guarded section)
- Show Free vs Pro feature comparison table.
- Integrate Stripe.js for payment collection; call `POST /api/companies/{companyId}/plan/upgrade`.
- Show confirmation/success screen after upgrade.

**3.5 — Guard existing employee invite route**
- File: `ShiftWork.Angular/src/app/app-routing.module.ts`  
- The existing `/accept-invite` route (used by `EMPLOYEE_REGISTRATION_FLOW.md`) must remain **outside** the auth guard and must **not** be modified.
- Add `canActivate` guards only to the new `/onboarding` and `/upgrade` routes, not to `/register` or `/accept-invite`.

---

## Phase 4 — Mobile App (React Native / Expo)

> **Goal:** Add registration and onboarding screens. Do not modify existing auth-disabled mock or employee flows.

### Tasks

**4.1 — Registration screens**
- Path: `ShiftWork.Mobile/app/register/`
- Mirror Angular 3-step flow (user info → company info → confirm).
- Uses Firebase `createUserWithEmailAndPassword` (will work once Firebase Auth mock is replaced; add TODO comment if still mocked).
- Calls `POST /api/auth/register` on completion.

**4.2 — Onboarding screen**
- Path: `ShiftWork.Mobile/app/onboarding/`
- Show sandbox data banner and Hide/Delete actions.
- On completion, navigate to main tab navigator.

**4.3 — Upgrade screen**
- Path: `ShiftWork.Mobile/app/upgrade/`
- Show plan comparison.
- For payment, deep-link to web upgrade page (avoid PCI scope on mobile for MVP).

**4.4 — Do NOT modify existing mobile auth mock**
- File: `ShiftWork.Mobile/config/firebase.ts` must remain unchanged.
- New screens should tolerate the mock by checking if Firebase auth is enabled before calling Firebase methods.

---

## Phase 5 — Security & Compliance

### Tasks

**5.1 — Protect registration endpoint from abuse**
- Add rate limiting middleware to `POST /api/auth/register` (max 5 requests per IP per hour).
- Reject duplicate `FirebaseUid` registrations with `409 Conflict`.
- Reject duplicate `CompanyEmail` registrations with `409 Conflict`.

**5.2 — Firebase UID validation on register**
- Even though the endpoint is public, validate the Firebase JWT token in the request body's context:
  - The client must obtain a Firebase ID token after account creation and send it as `Authorization: Bearer {token}`.
  - The `FirebaseUid` in the body must match the JWT `sub` claim.
  - This prevents fake UID spoofing without blocking the pre-login registration.

**5.3 — Role assignment guard**
- `POST /api/auth/register` only ever assigns "Owner" role to the registering user — it must never accept a `roleIds` parameter from the client.
- Hardcode role assignment logic server-side.

**5.4 — Sandbox data isolation**
- Existing API list endpoints (`GET /api/companies/{companyId}/people`, areas, locations) must still return sandbox records (they are real data until explicitly hidden/deleted).
- After `HideSandboxDataAsync`, set `Person.Status = "Sandbox"` — existing queries that filter `Status = "Active"` will automatically exclude them. No query changes needed.
- Document this behavior in API response contracts.

**5.5 — PCI compliance note**
- For MVP: use Stripe.js hosted fields in Angular to avoid raw card data touching the server.
- Mobile upgrade links to web page (avoids PCI scope on mobile).
- Document in `WEBHOOK_INTEGRATION.md` that Stripe webhooks should be added for subscription lifecycle events.

---

## Phase 6 — Analytics & Monitoring

### Tasks

**6.1 — Signup funnel event logging**
- In `SandboxService.SeedSandboxDataAsync` and `AuthController` register action, call `ILogger` with structured events:
  - `registration_started` (on first call)
  - `email_verified` (on PATCH onboarding status)
  - `onboarding_completed` (on sandbox delete)
- Use `_logger.LogInformation("{EventName} {CompanyId}", ...)` pattern matching existing controllers.

**6.2 — Sandbox action logging**
- Log each sandbox action (hide/reset/delete) with `CompanyId` and actor `UserId`.

**6.3 — Plan upgrade logging**
- Log upgrade attempt, success, and failure with `CompanyId`, `TargetPlan`, and Stripe response code.

---

## Phase 7 — Testing & Release

### Tasks

**7.1 — Integration tests for registration flow**
- File: `ShiftWork.Api.Tests/Registration/RegistrationIntegrationTests.cs` (new, if test project exists)
- Test cases:
  - Happy path: register → company created → sandbox seeded → Admin role assigned
  - Duplicate UID returns 409
  - Duplicate email returns 409
  - Missing required fields returns 400

**7.2 — Unit tests for `SandboxService`**
- Test `SeedSandboxDataAsync` creates exactly 1 Location, 1 Area, 2 Persons with `IsSandbox = true`
- Test `DeleteSandboxDataAsync` removes only `IsSandbox = true` records
- Test `ResetSandboxDataAsync` = delete + seed

**7.3 — Unit tests for `PlanService`**
- Test `IsFeatureEnabled` returns correct gates for Free vs Pro
- Test graceful fallback when Stripe env vars absent

**7.4 — Rollback strategy**
- If `POST /api/auth/register` fails mid-way (e.g., sandbox seed fails after company creation), wrap in a database transaction so Company + CompanyUser + sandbox records are either all committed or all rolled back.
- Use `_context.Database.BeginTransactionAsync()` pattern.

**7.5 — Smoke test checklist before release**
- [ ] `POST /api/auth/register` → 201, returns `companyId`
- [ ] Sandbox records visible in `GET /api/companies/{companyId}/people`
- [ ] `POST /api/companies/{companyId}/sandbox/delete` removes only IsSandbox records
- [ ] Existing employee invite flow (`send-invite` / `complete-invite`) unaffected
- [ ] Existing kiosk clock-in with PIN unaffected
- [ ] Angular `/register` is publicly accessible (no auth redirect)
- [ ] Angular `/accept-invite` (employee flow) is publicly accessible and unchanged

---

## Non-Conflict Checklist

The following items from `EMPLOYEE_REGISTRATION_FLOW.md` must remain **untouched**:

| Item | File | Status |
|---|---|---|
| `POST .../people/{personId}/send-invite` | PeopleController.cs | Do not modify |
| `POST .../people/complete-invite` | PeopleController.cs | Do not modify |
| `GET .../people/{personId}/invite-status` | PeopleController.cs | Do not modify |
| `InviteDtos.cs` | DTOs/InviteDtos.cs | Do not modify |
| `EmployeeRegistrationDtos.cs` | DTOs/EmployeeRegistrationDtos.cs | Do not modify |
| `CompanyUserProfile` assignment logic | CompanyUserProfilesController.cs | Do not modify |
| Angular `/accept-invite` route | app-routing.module.ts | Do not modify or add guards |

---

## Decisions Log

| Decision | Rationale |
|---|---|
| `POST /api/auth/register` is a public endpoint requiring Firebase JWT | Firebase account is created client-side first; the token proves identity without a separate login step |
| `IsSandbox = false` default on all existing entities | Additive migration; zero impact on current records |
| Sandbox "hide" reuses `Status = "Sandbox"` instead of a new `IsHidden` column | Avoids extra migration; existing Active/Inactive filter queries exclude it naturally |
| `PlanService` stubs Stripe when env vars absent | Matches established graceful-fallback pattern used by notification service |
| Mobile upgrade deep-links to web | Avoids PCI scope on mobile for MVP; mirrors the pattern recommended in PUSH_NOTIFICATIONS.md |
| Registration wraps in DB transaction | Prevents orphaned Company records if sandbox seeding fails |

---

## File Summary (New Files to Create)

```
ShiftWork.Api/
  Controllers/
    SandboxController.cs              ← Phase 2.5
  DTOs/
    RegistrationDtos.cs               ← Phase 2.1
  Services/
    ISandboxService.cs                ← Phase 2.3
    SandboxService.cs                 ← Phase 2.3
    SandboxSeedTemplate.cs            ← Phase 1.4
    IPlanService.cs                   ← Phase 2.7
    PlanService.cs                    ← Phase 2.7

ShiftWork.Angular/src/app/
  registration/                       ← Phase 3.1–3.2
  onboarding/                         ← Phase 3.3
  upgrade/                            ← Phase 3.4

ShiftWork.Mobile/app/
  register/                           ← Phase 4.1
  onboarding/                         ← Phase 4.2
  upgrade/                            ← Phase 4.3
```

## Files to Modify (Additive Only)

```
ShiftWork.Api/Models/Company.cs           ← add 5 nullable fields
ShiftWork.Api/Models/Person.cs            ← add IsSandbox bool
ShiftWork.Api/Models/Area.cs              ← add IsSandbox bool
ShiftWork.Api/Models/Location.cs          ← add IsSandbox bool
ShiftWork.Api/Controllers/AuthController.cs  ← add POST /register action
ShiftWork.Api/Controllers/CompanyController.cs  ← add POST /plan/upgrade action
ShiftWork.Api/Program.cs                  ← register ISandboxService, IPlanService
ShiftWork.Angular/src/app/app-routing.module.ts  ← add /register, /onboarding, /upgrade routes
```
