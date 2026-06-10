# Registration & Company Setup Feature - Architectural Review & Recommendations

**Date:** February 25, 2026  
**Status:** Pre-Implementation Review  
**Based On:** FEATURE_REGISTRATION_ONBOARDING.md specification + current codebase analysis

---

## Executive Summary

The proposed registration feature is **well-scoped and architecturally sound** with comprehensive documentation. The current codebase has solid foundational infrastructure (Firebase JWT auth, EF Core with migrations, DTOs, service layer pattern). The feature is implementable but requires careful sequencing to avoid rework. Success depends on proper **data model preparation (Phase 1)** and **security validation before shipping** (Phase 5).

**Risk Level:** **MEDIUM** (high impact but well-mitigated with proper execution)  
**Recommended Timeline:** 8-12 weeks (phases sequenced with appropriate testing gates)  
**Critical Path Item:** Database schema changes and migrations must precede API/UI layers

---

## 1. Current State Assessment

### Strengths to Build Upon

| Component | Current State | Readiness |
|-----------|--------------|-----------|
| **Authentication** | Firebase JWT + IDP verified | ✅ Solid foundation |
| **Service Layer** | Established pattern across controllers | ✅ Proven pattern |
| **Entity Framework** | Migrations in place, audit enabled | ✅ Migration infrastructure ready |
| **DTOs & Mapping** | AutoMapper configured | ✅ Ready for new DTOs |
| **API Structure** | Company-scoped routes (`/api/companies/{id}/...`) | ✅ Consistent pattern |
| **Authorization** | `[Authorize]` attribute applied | ✅ Can extend with roles |
| **Mobile Support** | React Native client established + dev token workaround | ✅ Connected |
| **Data Seeding** | Not currently implemented | ⚠️ Need custom seeder |

### Gaps to Address

| Gap | Impact | Solution |
|-----|--------|----------|
| **Plan/Tier field** | Missing on Company model | Add enum: Free (10 employees), Pro (unlimited) |
| **isSandbox flag** | Not on Area/Location/Person | Add bool with default false, index for queries |
| **Onboarding status** | No tracking of registration completion | Add enum to Company: NotStarted, Registered, EmailVerified, OnboardingCompleted |
| **Registration endpoint** | No POST /api/auth/register | Must create with transactional guarantee |
| **Email verification** | Not implemented | Requires email service integration |
| **Sandbox seeding** | No templates or service | Need RegistrationService with seed templates |

---

## 2. Data Model Changes (Phase 1)

### 2.1 Company Model Additions

**Current State:**
```csharp
public class Company {
  public string CompanyId { get; set; }
  public string Name { get; set; }
  // ... other fields
}
```

**Proposed Changes:**
```csharp
// Add these properties to Company model:

/// <summary>Billing plan: Free (10 employees) or Pro (unlimited)</summary>
public string Plan { get; set; } = "Free"; // Enum: "Free", "Pro"

/// <summary>Onboarding/registration completion status</summary>
public string OnboardingStatus { get; set; } = "NotStarted"; 
// Values: NotStarted, Registered, EmailVerified, OnboardingCompleted

/// <summary>Fire-and-forget timestamp for when company was registered</summary>
public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;

/// <summary>When user completed onboarding (sandbox exists)</summary>
public DateTime? OnboardingCompletedAt { get; set; }

/// <summary>stripe customer ID for billing integration</summary>
public string? StripeCustomerId { get; set; }

/// <summary>Date subscription automatically renews or null if never upgraded</summary>
public DateTime? ProSubscriptionRenewsAt { get; set; }
```

**EF Core Tracking:**
- Add `HasIndex(c => c.Plan)` for filtering Free vs Pro users
- Add `HasIndex(c => c.OnboardingStatus)` for finding incomplete onboarding
- `RegisteredAt` should be **non-indexable but required** (created only at registration)

### 2.2 Area Model Additions

**Current State:**
```csharp
public class Area {
  public int AreaId { get; set; }
  public string Name { get; set; }
  public string CompanyId { get; set; }
  // ...
}
```

**Proposed Changes:**
```csharp
// Add this property:
/// <summary>True if created as part of sandbox data for onboarding</summary>
public bool IsSandbox { get; set; } = false;
```

**Why:** Enables filtering/hiding sandbox data without deletion. Migration strategy:
- Add column with default false for existing areas
- Add **filtered unique index**: Users should not have duplicate area names within a company for real data

### 2.3 Location Model Additions

```csharp
// Add this property:
/// <summary>True if created as part of sandbox data for onboarding</summary>
public bool IsSandbox { get; set; } = false;
```

**Same rationale as Area.** Migration adds column, default false.

### 2.4 Person Model Additions

```csharp
// Add this property:
/// <summary>True if created as part of sandbox data for onboarding</summary>
public bool IsSandbox { get; set; } = false;
```

**Special concern:** Person already has extensive fields. Ensure migration tool doesn't misalign DTOs. Person also needs audit tracking (which is already enabled via `BaseEntity`).

### 2.5 Migration Strategy

**Approach:** Create discrete migration files, one per model change.

**File Naming Convention:**
```
Migrations/
  ├── AddPlanToCompany.cs          // Step 1
  ├── AddOnboardingStatusToCompany.cs  // Step 2
  ├── AddStripeFieldsToCompany.cs  // Step 3
  ├── AddIsSandboxToArea.cs        // Step 4
  ├── AddIsSandboxToLocation.cs    // Step 5
  └── AddIsSandboxToPerson.cs      // Step 6
```

**Execution Order:**
1. Run in sequence during **Phase 1 QA** (before API implementation).
2. Create rollback strategy: Each migration has `Down()` method to drop columns.
3. **Test on staging first:** Verify no errors on production-sized dataset (if available).

**Validation Checklist:**
- [ ] No duplicate index violations when adding plan/sandbox indexes
- [ ] Existing data migrates with correct defaults
- [ ] EF Core model matches database after migration
- [ ] Can query by `IsSandbox` and `Plan` efficiently

---

## 3. API Endpoint Design (Phase 2)

### 3.1 Registration Endpoint: POST /api/auth/register

**Purpose:** Create new user, company, settings, and sandbox data in single atomic transaction.

**Endpoint Specification:**

```
POST /api/auth/register
Content-Type: application/json
Authorization: none (public endpoint)

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@company.com",
  "password": "", // NOT NEEDED - Firebase handles auth; include for UI clarity
  "companyName": "Acme Corp",
  "companyPhone": "+1-555-0100",
  "companyCity": "San Francisco",
  "companyState": "CA",
  "companyCountry": "US",
  "agreedToTerms": true,
  "marketingConsent": false
}

Response 201 Created:
{
  "userId": "person-123",
  "companyId": "company-456",
  "email": "john@company.com",
  "companyName": "Acme Corp",
  "onboardingUrl": "https://app.shift-clock.com/onboarding/verify-email",
  "message": "Registration successful. Please verify your email."
}

Response 400 Bad Request (validation failures):
{
  "errors": {
    "email": ["Email already exists"],
    "companyName": ["Company name is required"]
  }
}

Response 409 Conflict:
{
  "message": "Email already registered with another company"
}
```

**Transaction Guarantee (Critical):**
```csharp
// Pseudocode - implement in RegistrationService
using (var transaction = await _context.Database.BeginTransactionAsync())
{
  try {
    // 1. Create Person (user)
    var person = new Person { Email = email, ... };
    _context.Persons.Add(person);
    
    // 2. Create Company (with Free plan, NotStarted status)
    var company = new Company { 
      Plan = "Free", 
      OnboardingStatus = "NotStarted", 
      ... 
    };
    _context.Companies.Add(company);
    
    // 3. Create CompanyUser mapping
    var companyUser = new CompanyUser { PersonId = person.PersonId, CompanyId = company.CompanyId };
    _context.CompanyUsers.Add(companyUser);
    
    // 4. Create default settings
    var settings = new CompanySettings { CompanyId = company.CompanyId, ... };
    _context.CompanySettings.Add(settings);
    
    // 5. Seed sandbox data (2 employees, 1 area, 1 location)
    var location = new Location { CompanyId = company.CompanyId, IsSandbox = true, ... };
    _context.Locations.Add(location);
    
    var area = new Area { CompanyId = company.CompanyId, LocationId = location.LocationId, IsSandbox = true, ... };
    _context.Areas.Add(area);
    
    // 2 sandbox employees
    var emp1 = new Person { CompanyId = company.CompanyId, IsSandbox = true, ... };
    var emp2 = new Person { CompanyId = company.CompanyId, IsSandbox = true, ... };
    _context.Persons.AddRange(emp1, emp2);
    
    await _context.SaveChangesAsync();
    
    // 6. Update company status AFTER successful save
    company.OnboardingStatus = "Registered";
    await _context.SaveChangesAsync();
    
    // 7. Send verification email (fire-and-forget, don't fail if email fails)
    _ = _notificationService.SendVerificationEmailAsync(email, verificationToken);
    
    await transaction.CommitAsync();
  } 
  catch (Exception ex) {
    await transaction.RollbackAsync();
    _logger.LogError(ex, "Registration transaction failed");
    throw;
  }
}
```

**Key Considerations:**
- **Authentication:** Endpoint must be `[AllowAnonymous]` (public registration).
- **Email verification:** Token sent via notification service; don't verify email in API yet.
- **Audit trail:** AuditInterceptor already enabled; all creates will be tracked.
- **Password:** Do NOT store passwords; rely on Firebase authentication after user confirms email.

---

### 3.2 Email Verification Endpoint: POST /api/auth/verify-email

**Purpose:** Mark email as verified + update `OnboardingStatus` to `EmailVerified`.

```
POST /api/auth/verify-email
Authorization: required (Firebase JWT)

{
  "token": "verification-token-from-email-link"
}

Response 200 OK:
{
  "message": "Email verified successfully",
  "onboardingUrl": "https://app.shift-clock.com/onboarding/complete"
}

Response 400 Bad Request:
{
  "message": "Invalid or expired verification token"
}
```

**Implementation:** Store verification token in database (e.g., in Person or separate VerificationToken entity with TTL). Validate token and update company's `OnboardingStatus` to `EmailVerified`.

---

### 3.3 Sandbox Management Endpoints

#### 3.3.1 Hide Sandbox Data: POST /api/companies/{companyId}/sandbox/hide

**Purpose:** Hide sandbox data from UI (toggle visibility, don't delete).

```
POST /api/companies/{companyId}/sandbox/hide
Authorization: required (user must be owner of company)

{
  "hideAll": true  // false = show all sandbox data again
}

Response 204 No Content
```

**Implementation:** Add `IsVisible` boolean to Area, Location, Person models (separate from `IsSandbox`). This preserves data for inspection/recovery without clutter.

---

#### 3.3.2 Reset Sandbox: POST /api/companies/{companyId}/sandbox/reset

**Purpose:** Delete ALL sandbox-tagged records and re-seed fresh sandbox.

```
POST /api/companies/{companyId}/sandbox/reset
Authorization: required

Response 204 No Content
```

**Implementation:**
```csharp
// Delete all sandbox data for company
_context.Persons.Where(p => p.CompanyId == companyId && p.IsSandbox).ExecuteDelete();
_context.Areas.Where(a => a.CompanyId == companyId && a.IsSandbox).ExecuteDelete();
_context.Locations.Where(l => l.CompanyId == companyId && l.IsSandbox).ExecuteDelete();

// Re-seed fresh sandbox
await SeedSandboxDataAsync(companyId);
```

**⚠️ Warning:** `ExecuteDelete()` bypasses audit logging. Consider adding manual audit entries before deletion.

---

#### 3.3.3 Delete Sandbox: POST /api/companies/{companyId}/sandbox/delete

**Purpose:** Permanently remove sandbox data (irreversible).

```
POST /api/companies/{companyId}/sandbox/delete
Authorization: required

Response 204 No Content
```

**Same as Reset, but don't re-seed.** Log deletion in audit trail.

---

### 3.4 Plan Upgrade Endpoint: POST /api/companies/{companyId}/plan/upgrade

**Purpose:** Upgrade from Free to Pro, integrate with Stripe billing.

```
POST /api/companies/{companyId}/plan/upgrade
Authorization: required
Content-Type: application/json

{
  "stripePaymentMethodId": "pm_1234567890",  // Token from Stripe Elements
  "billingEmail": "billing@company.com",
  "cardholderName": "John Doe"
}

Response 200 OK:
{
  "plan": "Pro",
  "message": "Upgrade successful. You now have unlimited employees.",
  "stripeCustomerId": "cust_1234567890",
  "renewsAt": "2026-03-25T00:00:00Z"
}

Response 402 Payment Required:
{
  "message": "Payment declined",
  "stripeError": "card_declined"
}

Response 507 Insufficient Storage:
{
  "message": "Cannot upgrade: company has >10 employees. Free plan limited to 10."
}
```

**Implementation Notes:**
- Call Stripe API to create customer + subscription
- Update Company.Plan = "Pro" + StripeCustomerId + ProSubscriptionRenewsAt
- Webhook listener for subscription renewal/cancellation (separate implementation, see WEBHOOK_INTEGRATION.md)
- Consider rate-limiting this endpoint (attempt limit per company)

---

## 4. Authentication & Security Considerations (Phase 5)

### 4.1 Firebase Authentication Flow

**Current State (from codebase):**
- `Program.cs` configures JWT Bearer authentication via Firebase
- AuthController has `GetCurrentUser()` extracting email from `User.Identity.Name`
- All controllers require `[Authorize]` attribute

**For Registration Feature:**

**Issue 1: Registration is public, but creates users**
- Solution: `POST /api/auth/register` endpoint must be `[AllowAnonymous]`
- Trade-off: Opens to registration spam → implement rate limiting by IP

**Issue 2: Firebase doesn't auto-create users**
- Solution: After registration, admin creates user in Firebase console OR:
  - Call Firebase Admin SDK to create user programmatically
  - OR use separate identity provider (Auth0, etc.)

**Recommendation:** Consider **Firebase Admin SDK** to auto-create users after registration:
```csharp
// In RegistrationService, after Person created:
var firebaseUser = await FirebaseAuth.DefaultInstance.CreateUserAsync(
    new UserRecordArgs()
    {
        Email = email,
        DisplayName = firstName + " " + lastName,
        Disabled = false,
    });
```

**Security Checklist:**
- [ ] `POST /api/auth/register` allows anonymous requests
- [ ] Rate limiter on registration endpoint (e.g., 5 reqs/minute per IP)
- [ ] Email verification token has 24-hour TTL
- [ ] Verification token is cryptographically random (use `System.Security.Cryptography`)
- [ ] Password never transmitted or stored (Firebase handles)
- [ ] PII (email, phone, address) encrypted at rest if required by compliance
- [ ] HTTPS enforced (already in production, verify in dev via `https://localhost:5182`)

### 4.2 Authorization: Role-Based Access to Plan Features

**Current State:**
- `CompanyUser` entity exists (user → company mapping)
- `Role` entity exists (RBAC structure)
- No plan-based entitlement checks in code

**New Requirement:** Free plan limits to 10 employees, Pro unlimited.

**Implementation Approach:**

```csharp
// In PeopleService.CreatePersonAsync():
var company = await _context.Companies.FindAsync(companyId);

// Check employee limit
var employeeCount = await _context.Persons
    .Where(p => p.CompanyId == companyId && !p.IsSandbox)
    .CountAsync();

if (company.Plan == "Free" && employeeCount >= 10)
{
    throw new InvalidOperationException(
        "Free plan limited to 10 employees. Upgrade to Pro to add more.");
}
```

**Mobile & Web UI:**
- Show banner if employee count approaching limit
- Disable "Add Employee" button if limit reached
- Link to upgrade flow

---

## 5. Implementation Sequence Recommendations

### Recommended Phase Order (8-12 weeks total)

```
Phase 1: Requirements & Data Model (2 weeks)
  ├─ Create EF Core migrations
  ├─ Add Company.Plan, OnboardingStatus, StripeCustomerId
  ├─ Add IsSandbox to Area, Location, Person
  ├─ Test migrations on staging
  └─ Git commit: "feat(db): Add registration schema"

Phase 2: API Endpoints (3 weeks)
  ├─ Create RegistrationService with transactional registration
  ├─ Build sandbox seeding templates
  ├─ Implement POST /api/auth/register
  ├─ Implement POST /api/auth/verify-email
  ├─ Add plan enforcement to PeopleService.CreatePersonAsync()
  ├─ Write integration tests
  └─ Git commit: "feat(api): Registration & sandbox endpoints"
  
  [Security Review Gate: Phase 5 checks]

Phase 3: Web App UI (3 weeks, parallel with Phase 2)
  ├─ Build registration form (multi-step)
  ├─ Build email verification screen
  ├─ Build onboarding/sandbox prompt
  ├─ Build sandbox management UI (hide/reset/delete)
  ├─ Build pro upgrade comparison + Stripe integration
  └─ Git commit: "feat(web): Registration & onboarding UI"
  
  [E2E Testing Gate]

Phase 4: Mobile App (2 weeks, parallel with Phase 3)
  ├─ Port registration screens from web
  ├─ Show sandbox prompt on first login
  ├─ Link upgrade screen to web billing
  └─ Git commit: "feat(mobile): Registration & sandbox UI"

Phase 5: Security & Compliance (1 week, ongoing)
  ├─ Email verification + Firebase Admin SDK integration
  ├─ Rate limiting on /register endpoint
  ├─ PII encryption (if applicable)
  ├─ Security testing (OWASP top 10)
  └─ Git commit: "feat(auth): Firebase Admin SDK & rate limiting"

Phase 6: Analytics & Monitoring (1 week, ongoing)
  ├─ Track signup funnel events
  ├─ Track upgrade conversion
  └─ Alert on registration failures

Phase 7: QA & Release (1 week)
  ├─ Staging deployment + smoke tests
  ├─ Rollback procedure documented
  ├─ Runbook for debugging registration issues
  └─ Production canary deployment (5% traffic, then 50%, then 100%)
```

**Parallelization:** Phases 2, 3, 4, and 5 can overlap. Web UI (Phase 3) should start as soon as API contracts are finalized (mid-Phase 2).

---

## 6. Risk Analysis & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Sandbox data corruption** (seeding fails mid-transaction) | Medium | High | Use transactional guarantee; test seed with large datasets |
| **Email verification token spam/abuse** | Medium | Medium | Implement rate limiting + token TTL; log token generation |
| **Plan enforcement not enforced in all code paths** | High | Medium | Centralize plan checks in `CompanyService` validator; add tests |
| **Stripe integration incomplete** (payment fails, refund fail) | Low | High | Mock Stripe in dev; test payment failure scenarios; webhook recovery |
| **Firebase Admin SDK fails** (user auto-creation fails) | Low | Medium | Fallback to manual user creation; log all failures for support |
| **Mobile Firebase bug recurs** (React Native auth crashes) | Low | Medium | Maintain mock auth as fallback; plan upgrade after Firebase fix |
| **Duplicate company names allowed** | Low | Low | Add unique index on (CompanyId, Name) for areas/locations |
| **Partial onboarding completion** (user registers but doesn't verify email) | Medium | Low | Schedule cleanup job to remove > 48h unverified companies |

**Mitigation Priority:**
1. **Transactional guarantee** (prevents data corruption)
2. **Plan enforcement tests** (prevents entitlement bypass)
3. **Email rate limiting** (prevents abuse)

---

## 7. Mobile App Considerations (React Native/Expo)

### 7.1 Known Limitation: Firebase Auth Bug

**Current Workaround:** Mock Firebase auth + dev token from `.env`  
**Status:** Stable, suitable for development/testing indefinitely  
**Future:** Upgrade Firebase to v12+ when React Native support improves

### 7.2 Registration Flow on Mobile

**Approach:** Platform-native registration UI (not "open web browser to web app")

**UI Flow:**
```
Screen 1: Email + Password (or email-only, Firebase via phone)
  ↓
Screen 2: Company details
  ↓
Screen 3: Review + submit
  ↓
Screen 4: Verification (await email)
  ↓
Screen 5: Sandbox onboarding prompt
```

**Why not open web?** User expects native mobile experience; web registration redirecting is jarring.

### 7.3 Stripe Integration on Mobile

**Options:**
1. Open Stripe Checkout web modal (easiest, user leaves app)
2. Use Stripe's React Native SDK (`react-native-stripe-sdk`)
3. Link to web billing, return with results

**Recommendation:** **Option 1 (Stripe Checkout web modal)** for MVP. Implement as:
```javascript
// In mobile app upgrade screen:
const handleUpgrade = async () => {
  // Call backend to create Stripe session
  const response = await api.post(`/companies/${companyId}/plan/upgrade/session`);
  const { checkoutUrl } = response.data;
  
  // Open URL in WebView or browser
  Linking.openURL(checkoutUrl);
};
```

**Future:** Implement react-native-stripe-sdk for native payment entry.

---

## 8. Database Migration Execution Plan

### 8.1 Pre-Migration Checks

**Staging Environment:**
```powershell
# 1. Backup production database
sqlserver backup database [ShiftWork] to disk='...backup.bak'

# 2. Restore to staging
sqlserver restore database [ShiftWork_Staging] from disk='...backup.bak'

# 3. Run migrations on staging
cd ShiftWork.Api
dotnet ef database update --environment Staging

# 4. Validate with queries
SELECT COUNT(*) FROM Companies WHERE Plan IS NULL  -- Should be 0 (default not null)
SELECT TOP 10 * FROM Areas WHERE IsSandbox = 1     -- Should be empty initially
```

### 8.2 Production Rollout

**Step 1: Deploy code + migrations (Blue-Green)**
```powershell
# In production ECS/App Service:
dotnet migrate --environment Production

# Monitor for errors; if any, rollback:
dotnet migrate --environment Production --TargetMigration <PreviousMigration>
```

**Step 2: Validate**
```sql
-- Check row counts unchanged
SELECT COUNT(*) FROM Companies;  -- Should match pre-migration count
SELECT COUNT(*) FROM Areas WHERE IsSandbox = 1;  -- Should match expectations

-- Check new columns exist
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Companies' AND COLUMN_NAME IN ('Plan', 'OnboardingStatus');
```

**Step 3: Enable registration endpoint** (feature flag or code deployment)
```csharp
// In appsettings.json:
{
  "Features": {
    "RegistrationEnabled": true
  }
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests (Phase 2)

**Test Scenarios for RegistrationService:**

```csharp
[TestMethod]
public async Task RegisterNewUser_CreatesCompanyWithFreeplan()
{
    // Arrange
    var request = new RegistrationRequest { Email = "test@example.com", CompanyName = "Test Corp" };
    
    // Act
    var result = await _registrationService.RegisterAsync(request);
    
    // Assert
    Assert.IsNotNull(result.CompanyId);
    Assert.AreEqual("Free", result.Plan);
    Assert.AreEqual("NotStarted", result.OnboardingStatus);
}

[TestMethod]
public async Task RegisterNewUser_SeedsSandboxData()
{
    // Act
    var result = await _registrationService.RegisterAsync(request);
    
    // Assert
    var areas = await _context.Areas.Where(a => a.CompanyId == result.CompanyId && a.IsSandbox).ToListAsync();
    var employees = await _context.Persons.Where(p => p.CompanyId == result.CompanyId && p.IsSandbox).ToListAsync();
    
    Assert.AreEqual(1, areas.Count);
    Assert.AreEqual(2, employees.Count);
}

[TestMethod]
[ExpectedException(typeof(InvalidOperationException))]
public async Task RegisterNewUser_WithDuplicateEmail_Throws()
{
    // Arrange
    await _registrationService.RegisterAsync(request1);
    
    // Act - should throw
    await _registrationService.RegisterAsync(request1);
}

[TestMethod]
public async Task HideSandboxData_TogglesVisibility()
{
    // Arrange
    var companyId = "test-company";
    var area = new Area { CompanyId = companyId, IsSandbox = true, IsVisible = true };
    _context.Areas.Add(area);
    await _context.SaveChangesAsync();
    
    // Act
    await _sandboxService.HideSandboxDataAsync(companyId, hideAll: true);
    
    // Assert
    var updated = await _context.Areas.FindAsync(area.AreaId);
    Assert.IsFalse(updated.IsVisible);
}
```

### 9.2 Integration Tests (Phase 2)

```csharp
[TestClass]
public class RegistrationEndpointTests
{
    private TestWebApplicationFactory<Program> _factory;
    private HttpClient _client;
    
    [TestInitialize]
    public void Setup()
    {
        _factory = new TestWebApplicationFactory<Program>();
        _client = _factory.CreateClient();
    }
    
    [TestMethod]
    public async Task PostRegister_WithValidData_Returns201()
    {
        // Arrange
        var request = new { firstName = "John", lastName = "Doe", email = "john@example.com", companyName = "Test" };
        
        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/register", request);
        
        // Assert
        Assert.AreEqual(HttpStatusCode.Created, response.StatusCode);
        var content = await response.Content.ReadAsAsync<dynamic>();
        Assert.IsNotNull(content.companyId);
    }
    
    [TestMethod]
    public async Task PostRegister_WithDuplicateEmail_Returns409()
    {
        // Arrange + Act (first registration)
        var request = new { email = "john@example.com", companyName = "Test1" };
        await _client.PostAsJsonAsync("/api/auth/register", request);
        
        // Act (duplicate attempt)
        var response = await _client.PostAsJsonAsync("/api/auth/register", request);
        
        // Assert
        Assert.AreEqual(HttpStatusCode.Conflict, response.StatusCode);
    }
}
```

### 9.3 E2E Tests (Phase 3, web + mobile)

Web E2E (Cypress):
```javascript
describe('Registration Flow', () => {
  it('should register new user and show sandbox onboarding', () => {
    cy.visit('/register');
    cy.get('input[name=email]').type('newuser@example.com');
    cy.get('input[name=companyName]').type('Acme Corp');
    cy.get('button[type=submit]').click();
    cy.contains('Check your email to verify');
  });
});
```

Mobile E2E (Detox or Appium):
Similar flow, native touch events instead of cy.get().

---

## 10. Deployment Checklist

**Pre-Launch:**
- [ ] All Phase 1-5 tasks completed and tested
- [ ] Security review signed off (Phase 5)
- [ ] Email verification working end-to-end
- [ ] Stripe sandbox credentials configured
- [ ] Rate limiter enabled on /register
- [ ] Runbook for rollback prepared
- [ ] Monitoring alerts configured (registration failure rate, email bounce rate)

**Launch Day:**
- [ ] Canary deployment to 5% of servers
- [ ] Monitor registration metrics for 2 hours
- [ ] Expand to 50%, monitor 2 more hours
- [ ] Full rollout to 100%
- [ ] Announce feature to customers

**Post-Launch (Week 1):**
- [ ] Daily check-in on registration funnel metrics
- [ ] Support ticket monitoring for "can't register" issues
- [ ] Monitor database growth
- [ ] Verify email delivery reliability

---

## 11. Documentation & Knowledge Transfer

**Create/Update:**
- [ ] `REGISTRATION_API_REFERENCE.md` - API endpoint documentation
- [ ] `REGISTRATION_SETUP.md` - Developer setup for registration feature
- [ ] `SANDBOX_DATA_MANAGEMENT.md` - Admin guide for troubleshooting sandbox issues
- [ ] `PLAN_ENFORCEMENT_GUIDE.md` - Rules for Free vs Pro feature gating

**Runbooks:**
- [ ] "User can't verify email" troubleshooting
- [ ] "Rollback registration database migration"
- [ ] "Manually create user in Firebase"

---

## 12. Key Decisions & Trade-Offs

| Decision | Rationale | Alternative | Why Not Chosen |
|----------|-----------|-------------|-----------------|
| **Single-step registration with immediate sandbox seed** | Reduces time-to-value; users see data immediately | Multi-step wizard, seed later | UX suffers; empty app is jarring |
| **isSandbox flag vs separate SandboxData table** | Simpler queries, less data movement | Separate table for audit/recovery | More complex schema; YAGNI principle |
| **Email verification required (blocks onboarding)** | Prevents invalid email spam | Optional verification | Broken email = bounced notifications forever |
| **Free plan hard limit = 10 employees** | Simple to enforce; clear UX | Soft limit with warning | Users confused by gradual changes |
| **Stripe for billing** | Industry standard, mature SDKs | Custom billing, other providers | Reduces scope; Stripe proven |
| **Plan upgrade via API endpoint (not admin-only)** | Self-service user experience | Admin-triggered upgrades | Poor UX; support burden |

---

## 13. Success Metrics & Monitoring

**Phase Gate Criteria:**

| Phase | Gate Criteria | Owner |
|-------|--------------|-------|
| **Phase 1 Complete** | All migrations pass test + staging; 0 schema conflicts | DB Admin |
| **Phase 2 Complete** | All unit tests pass; integration tests 90%+ coverage; security review passed | Backend Team |
| **Phase 3 Complete** | Web UI E2E tests pass; registration flow works end-to-end on staging | Frontend Team |
| **Phase 4 Complete** | Mobile UI E2E tests pass; registration works on emulator | Mobile Team |
| **Phase 5 Complete** | Security audit signed off; email verification working; Stripe sandbox tested | Security + Backend |
| **Phase 7 Complete** | Canary deployment 0 errors; monitoring alerts working | DevOps + Backend |

**Post-Launch KPIs:**
- **Registration success rate:** >95% (should be high; registration is simple)
- **Email verification rate:** >80% (users verify within 24h)
- **Onboarding completion rate:** >70% (users finish sandbox intro)
- **Upgrade conversion rate:** Track Free → Pro; target 5-10% within 30 days
- **Support tickets:** <1% of registrations require support

---

## 14. Open Questions & Clarifications Needed

Before coding Phase 1, confirm with product/business:

1. **Free plan employee limit:** Is 10 employees correct? Or different number?
2. **Trial duration:** Does Free plan trial users for 14 days before requiring upgrade? Or indefinite free tier?
3. **Billing start date:** Day of registration? Day of verification? Explicit start date?
4. **Sandbox data customization:** Can users add their own employees/locations to sandbox, or is it read-only demo data?
5. **Plan downgrade:** Can Pro users downgrade to Free? If so, what happens if they exceed 10 employees?
6. **Org structure:** Multi-company support (user manages multiple companies)? Or 1 user → N employees in 1 company?
7. **Email verification retry:** If verification link expires, can user request new link? Limit?
8. **Password reset:** How does user reset password post-registration? (Firebase built-in?)

---

## Conclusion

The registration feature is **well-designed and implementable**. The key to success is:

1. **Prioritize Phase 1 (data model)** – Migrations must be bulletproof; test on staging.
2. **Strict transactional guardrails in Phase 2** – Seed-or-nothing; no partial registrations.
3. **Early security review in Phase 5** – Email verification + rate limiting + Firebase integration.
4. **Parallel web/mobile development in Phases 3-4** – Use same API contracts; diverge only in UI.
5. **Comprehensive testing before launch** – Unit + integration + E2E; test failure scenarios.

**Estimated effort:** 8-12 weeks with 3-4 person-weeks effort (distributed across backend, frontend, mobile).

**Blockers:** None identified. All infrastructure (Firebase auth, EF Core migrations, service layer) is in place.

---

## Appendix A: Sandbox Data Template

```csharp
// Define this in RegistrationService
private async Task SeedSandboxDataAsync(string companyId)
{
    // 1 Location (HQ)
    var location = new Location
    {
        CompanyId = companyId,
        Name = "Headquarters (Demo)",
        Address = "123 Demo St",
        City = "San Francisco",
        State = "CA",
        Country = "US",
        ZipCode = "94105",
        TimeZone = "America/Los_Angeles",
        GeoCoordinates = "37.7749,-122.4194",
        IsSandbox = true,
        Status = "Active",
        RatioMax = 100
    };
    _context.Locations.Add(location);
    await _context.SaveChangesAsync(); // Flush to get LocationId
    
    // 1 Area (Operations)
    var area = new Area
    {
        CompanyId = companyId,
        LocationId = location.LocationId,
        Name = "Operations (Demo)",
        IsSandbox = true
    };
    _context.Areas.Add(area);
    
    // 2 Employees (demo staff)
    var emp1 = new Person
    {
        CompanyId = companyId,
        Name = "Alice Johnson (Demo)",
        Email = $"alice-demo-{Guid.NewGuid()}@shift-clock-demo.com",
        PhoneNumber = "+1-555-0101",
        Status = "Active",
        IsSandbox = true
    };
    
    var emp2 = new Person
    {
        CompanyId = companyId,
        Name = "Bob Smith (Demo)",
        Email = $"bob-demo-{Guid.NewGuid()}@shift-clock-demo.com",
        PhoneNumber = "+1-555-0102",
        Status = "Active",
        IsSandbox = true
    };
    
    _context.Persons.AddRange(emp1, emp2);
    await _context.SaveChangesAsync();
}
```

---

**Document Version:** 1.0  
**Last Updated:** February 25, 2026  
**Next Review:** After Phase 1 completion
