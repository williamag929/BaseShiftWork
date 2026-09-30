# Stripe Billing v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real, safe subscription billing for Loqzen: a no-card Pro trial, Starter/Pro/Business tiers bought through Stripe Checkout and managed in the Customer Portal, plan state synced from webhooks, and server-side employee caps.

**Architecture:**
- A pure `PlanResolver` computes each company's effective tier from the stored subscription state and the trial date. Nothing downgrades a company based on dates alone.
- A thin `BillingController` and `StripeWebhookController` delegate to `BillingService` and `StripeWebhookService`.
- Both services reach Stripe only through `IStripeGateway`, which uses a `StripeClient`.
- Webhooks are deduplicated by event ID. Before applying any change, the webhook service re-fetches the subscription from Stripe.
- `PlanEnforcementService` guards every path in `PeopleService` that adds or reactivates an active employee.

**Tech Stack:** .NET 9 API with EF Core 8 / SQL Server, Stripe.net 52.2.0, xUnit + Moq + EF InMemory, Angular 19 (NgModule + standalone components) with Jasmine/Karma and ngx-toastr.

**Spec:** `Docs/superpowers/specs/2026-09-28-stripe-billing-design.md`

## Global Constraints

- Tiers and employee caps are exactly Free 5, Starter 25, Pro 100, Business unlimited. The cap counts `Status == "Active"` (case-insensitive; null counts as Active) and `IsSandbox == false`.
- The trial is exactly 14 days of Pro with no card. A new company gets `Plan = "Free"` and `TrialEndsAt = utcNow + 14 days`.
- Access is granted only by `SubscriptionStatus ∈ {active, trialing, past_due}` together with a paid `Plan`, or by `TrialEndsAt > utcNow`. `CurrentPeriodEnd` is for display only.
- Endpoint policies:
  - `GET billing` requires `company-settings.read`.
  - `checkout-session` and `portal-session` require `companies.billing`.
  - The webhook route is `POST /api/stripe/webhook` and is anonymous.
- Env vars (all read from the environment): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`, `APP_BASE_URL`.
- Simulation mode is allowed only when the environment is Development and there is no secret key. In any other environment a missing key returns 503 `billing_unavailable`.
- Plan-limit response: 409 with `{ code: "plan_limit_exceeded", tier, cap, count, message }`.
- CLAUDE.md rules apply:
  - Controllers stay thin.
  - Return DTOs, never EF models.
  - `CompanyId` comes only from the route; it is never hardcoded.
  - Authorize with `[Authorize(Policy=…)]`.
  - Comments explain *why*, never *what*.
- Angular:
  - Build URLs as `${environment.apiUrl}/companies/...`; never add a second `/api`.
  - New templates use `i18n="@@billing.*"` ids.
  - Notifications use ngx-toastr.
- Every commit ends with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_014c3yh5bcrJaEn7MNPR1Ra9
  ```

## Review Focus

1. **A `customer.subscription.created` event arrives before `checkout.session.completed`.** The company is already found by `StripeCustomerId` (the customer is created before Checkout), so it must adopt the subscription. Tested in Task 8.
2. **An admin double-clicks "Choose plan".** Both requests must reuse one Stripe idempotency key, so only one Checkout Session exists. Tested in Task 6.
3. **A past-due company adds an employee.** It keeps its paid tier's cap while Stripe retries the payment. Tested in Tasks 1 and 4.
4. **Sample data holds a legacy `Plan = "Trial"` or a null plan.** It resolves to Free, or to the trial if `TrialEndsAt` is in the future, and never gets cap 0. Tested in Task 1.
5. **A person is created with a null or lower-case `"active"` status.** It still counts toward the cap and is still guarded. Tested in Task 4.

---

## File map

**API: create**

| File | Purpose |
|---|---|
| `ShiftWork.Api/Helpers/PlanCatalog.cs` | Tiers, caps, features, trial length |
| `ShiftWork.Api/Helpers/PlanResolver.cs` | Pure effective-plan function, and the `EffectivePlan` record |
| `ShiftWork.Api/Helpers/StripeSettings.cs` | Env config and price↔tier mapping |
| `ShiftWork.Api/Helpers/PlanLimitExceededException.cs` | |
| `ShiftWork.Api/Models/StripeProcessedEvent.cs` | |
| `ShiftWork.Api/Services/PlanEnforcementService.cs` | Interface and implementation |
| `ShiftWork.Api/Services/StripeGateway.cs` | `IStripeGateway`, records, implementation |
| `ShiftWork.Api/Services/BillingService.cs` | Interface, `BillingOutcome`, implementation |
| `ShiftWork.Api/Services/StripeWebhookService.cs` | Interface and implementation |
| `ShiftWork.Api/DTOs/BillingDtos.cs` | |
| `ShiftWork.Api/Controllers/BillingController.cs` | |
| `ShiftWork.Api/Controllers/StripeWebhookController.cs` | |
| Migration `StripeBillingV2` | |

**API: modify**

| File | Change |
|---|---|
| `Models/Company.cs` | New fields |
| `Data/ShiftWorkContext.cs` | DbSet and index |
| `Services/PlanService.cs`, `Services/IPlanService.cs` | Use the resolver; drop the upgrade method |
| `Services/PeopleService.cs` | Enforcement hooks |
| `Controllers/PeopleController.cs` | 409 catches |
| `Controllers/CompanyController.cs` | Remove the upgrade endpoint |
| `Controllers/AuthController.cs` | Start the trial on registration |
| `DTOs/RegistrationDtos.cs` | Remove upgrade DTOs |
| `Services/PermissionSeedService.cs` | `companies.billing` |
| `Program.cs` | DI and the policy |
| `ShiftWork.Api.csproj` | Stripe.net |
| `.env.example`, `docker-compose.yml` | New variables |

**Tests: create**

`ShiftWork.Api.Tests/Billing/`:
- `PlanResolverTests.cs`
- `PlanEnforcementServiceTests.cs`
- `StripeSettingsTests.cs`
- `BillingServiceTests.cs`
- `BillingAuthorizationTests.cs`
- `StripeWebhookServiceTests.cs`
- `StripeWebhookControllerTests.cs`
- `FakeStripeGateway.cs`

**Tests: modify**

`Plan/PlanServiceTests.cs`

**Angular: create**

| File | Purpose |
|---|---|
| `core/models/billing.model.ts` | |
| `core/services/billing.service.ts` (+ `.spec.ts`) | |
| `features/dashboard/billing/billing.component.{ts,html,css}` (+ `.spec.ts`) | |
| `core/errors/plan-limit.error.ts` | |

**Angular: modify**

| File | Change |
|---|---|
| `features/dashboard/dashboard.module.ts` | Route |
| `features/dashboard/dashboard.component.{ts,html}` | Nav link and banner |
| `core/services/people.service.ts` | Keep the 409 details |
| `features/dashboard/people/people.component.ts` | Upgrade prompt |
| `core/services/registration.service.ts` | Remove `upgradePlan` |
| `features/upgrade/*` | Redirect route; delete the component |

**Docs:** `Docs/STRIPE_BILLING_RUNBOOK.md`

---

### Task 1: PlanCatalog and PlanResolver

**Files:**
- Create: `ShiftWork.Api/Helpers/PlanCatalog.cs`, `ShiftWork.Api/Helpers/PlanResolver.cs`
- Modify: `ShiftWork.Api/Models/Company.cs` (add `TrialEndsAt`, `SubscriptionStatus`, `CurrentPeriodEnd`; this is a model change only, and the migration comes in Task 2)
- Test: `ShiftWork.Api.Tests/Billing/PlanResolverTests.cs`

**Interfaces:**
- Produces:
  - `PlanCatalog.Free/Starter/Pro/Business` (string constants)
  - `PlanCatalog.PaidTiers` (`IReadOnlyList<string>`)
  - `PlanCatalog.TrialLength` (`TimeSpan`)
  - `PlanCatalog.EmployeeCap(string tier) : int?`
  - `PlanCatalog.Features(string tier) : IReadOnlySet<string>`
  - `PlanCatalog.IsPaidTier(string? tier) : bool`
  - `PlanCatalog.StartTrial(Company c, DateTime utcNow)`
  - `PlanResolver.Resolve(Company c, DateTime utcNow) : EffectivePlan`
  - `record EffectivePlan(string Tier, bool IsTrial, int TrialDaysRemaining, int? EmployeeCap, IReadOnlySet<string> Features)`
  - `PlanResolver.GrantsPaidAccess(string? status) : bool`

- [ ] **Step 1: Add the Company fields** (in `Models/Company.cs`, after `StripeSubscriptionId`)

```csharp
        public DateTime? TrialEndsAt { get; set; }
        public string? SubscriptionStatus { get; set; }
        // Display only ("renews on"); access decisions never read this.
        public DateTime? CurrentPeriodEnd { get; set; }
```
Also change the `Plan` comment to `// Paid tier from Stripe: "Free" | "Starter" | "Pro" | "Business"`, and mark `PlanExpiresAt` with `[Obsolete("Replaced by TrialEndsAt / SubscriptionStatus. Dropped in a later release.")]`.

- [ ] **Step 2: Write the failing tests** in `ShiftWork.Api.Tests/Billing/PlanResolverTests.cs`

```csharp
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;
using Xunit;

namespace ShiftWork.Api.Tests.Billing;

public class PlanResolverTests
{
    private static readonly DateTime Now = new(2026, 9, 28, 12, 0, 0, DateTimeKind.Utc);

    private static Company Co(string? plan = "Free", string? status = null, DateTime? trialEnds = null) => new()
    {
        CompanyId = "c1", Name = "C", Email = "c@x.com", Address = "", PhoneNumber = "", TimeZone = "UTC",
        Plan = plan, SubscriptionStatus = status, TrialEndsAt = trialEnds
    };

    [Theory]
    [InlineData("Starter", "active", "Starter")]
    [InlineData("Pro", "trialing", "Pro")]
    [InlineData("Business", "past_due", "Business")]
    public void PaidStatus_GrantsStoredTier(string plan, string status, string expected)
    {
        var p = PlanResolver.Resolve(Co(plan, status), Now);
        Assert.Equal(expected, p.Tier);
        Assert.False(p.IsTrial);
    }

    [Theory]
    [InlineData("canceled")]
    [InlineData("unpaid")]
    [InlineData("incomplete")]
    [InlineData("incomplete_expired")]
    [InlineData("paused")]
    public void NonPaidStatus_WithoutTrial_IsFree(string status)
    {
        Assert.Equal(PlanCatalog.Free, PlanResolver.Resolve(Co("Pro", status), Now).Tier);
    }

    [Fact]
    public void ActiveTrial_IsPro_WithRemainingDays()
    {
        var p = PlanResolver.Resolve(Co("Free", null, Now.AddDays(3).AddHours(-1)), Now);
        Assert.Equal(PlanCatalog.Pro, p.Tier);
        Assert.True(p.IsTrial);
        Assert.Equal(3, p.TrialDaysRemaining);
        Assert.Equal(100, p.EmployeeCap);
    }

    [Fact]
    public void ExpiredTrial_IsFree_WithZeroDays()
    {
        var p = PlanResolver.Resolve(Co("Free", null, Now.AddMinutes(-1)), Now);
        Assert.Equal(PlanCatalog.Free, p.Tier);
        Assert.False(p.IsTrial);
        Assert.Equal(0, p.TrialDaysRemaining);
        Assert.Equal(5, p.EmployeeCap);
    }

    [Fact]
    public void PaidSubscription_WinsOverActiveTrial()
    {
        var p = PlanResolver.Resolve(Co("Starter", "active", Now.AddDays(5)), Now);
        Assert.Equal(PlanCatalog.Starter, p.Tier);
        Assert.False(p.IsTrial);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("Trial")]
    [InlineData("Enterprise")]
    public void LegacyOrUnknownPlan_WithPaidStatus_IsFree_NeverCapZero(string? plan)
    {
        var p = PlanResolver.Resolve(Co(plan, "active"), Now);
        Assert.Equal(PlanCatalog.Free, p.Tier);
        Assert.Equal(5, p.EmployeeCap);
    }

    [Fact]
    public void LegacyTrialPlan_WithFutureTrialDate_IsTrial()
    {
        Assert.True(PlanResolver.Resolve(Co("Trial", null, Now.AddDays(2)), Now).IsTrial);
    }

    [Theory]
    [InlineData("Free", 5)]
    [InlineData("Starter", 25)]
    [InlineData("Pro", 100)]
    public void Caps_MatchCatalog(string tier, int cap) => Assert.Equal(cap, PlanCatalog.EmployeeCap(tier));

    [Fact]
    public void Business_IsUnlimited() => Assert.Null(PlanCatalog.EmployeeCap(PlanCatalog.Business));

    [Fact]
    public void Features_AreTiered()
    {
        Assert.DoesNotContain("sandbox.delete", PlanCatalog.Features(PlanCatalog.Free));
        Assert.Contains("sandbox.delete", PlanCatalog.Features(PlanCatalog.Starter));
        Assert.DoesNotContain("analytics", PlanCatalog.Features(PlanCatalog.Starter));
        Assert.Contains("export", PlanCatalog.Features(PlanCatalog.Pro));
        Assert.Contains("export", PlanCatalog.Features(PlanCatalog.Business));
        Assert.Contains("SANDBOX.HIDE", PlanCatalog.Features(PlanCatalog.Free));
    }

    [Fact]
    public void StartTrial_SetsFreePlanAndFourteenDays()
    {
        var c = Co("Pro", "canceled");
        PlanCatalog.StartTrial(c, Now);
        Assert.Equal(PlanCatalog.Free, c.Plan);
        Assert.Equal(Now.AddDays(14), c.TrialEndsAt);
    }
}
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `dotnet test ShiftWork.Api.Tests --filter "FullyQualifiedName~PlanResolverTests"`
Expected: build error saying `PlanResolver` / `PlanCatalog` do not exist.

- [ ] **Step 4: Implement** `ShiftWork.Api/Helpers/PlanCatalog.cs`

```csharp
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Helpers
{
    public static class PlanCatalog
    {
        public const string Free = "Free";
        public const string Starter = "Starter";
        public const string Pro = "Pro";
        public const string Business = "Business";

        public static readonly IReadOnlyList<string> PaidTiers = new[] { Starter, Pro, Business };
        public static readonly TimeSpan TrialLength = TimeSpan.FromDays(14);

        private static readonly string[] BaseFeatures = { "sandbox.hide", "sandbox.reset", "kiosk.clockin", "schedules.basic" };
        private static readonly string[] StarterFeatures = BaseFeatures.Append("sandbox.delete").ToArray();
        private static readonly string[] ProFeatures = StarterFeatures
            .Concat(new[] { "analytics", "advanced_scheduling", "multi_location", "export" }).ToArray();

        private static readonly Dictionary<string, (int? Cap, IReadOnlySet<string> Features)> Tiers =
            new(StringComparer.OrdinalIgnoreCase)
            {
                [Free] = (5, Set(BaseFeatures)),
                [Starter] = (25, Set(StarterFeatures)),
                [Pro] = (100, Set(ProFeatures)),
                [Business] = (null, Set(ProFeatures)),
            };

        private static IReadOnlySet<string> Set(IEnumerable<string> keys) => new HashSet<string>(keys, StringComparer.OrdinalIgnoreCase);

        public static bool IsPaidTier(string? tier) => tier != null && PaidTiers.Contains(tier, StringComparer.OrdinalIgnoreCase);

        public static int? EmployeeCap(string tier) => Tiers.TryGetValue(tier, out var t) ? t.Cap : Tiers[Free].Cap;

        public static IReadOnlySet<string> Features(string tier) => Tiers.TryGetValue(tier, out var t) ? t.Features : Tiers[Free].Features;

        public static string Normalize(string tier) => PaidTiers.FirstOrDefault(t => t.Equals(tier, StringComparison.OrdinalIgnoreCase)) ?? Free;

        public static void StartTrial(Company company, DateTime utcNow)
        {
            company.Plan = Free;
            company.TrialEndsAt = utcNow.Add(TrialLength);
        }
    }
}
```

`ShiftWork.Api/Helpers/PlanResolver.cs`

```csharp
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Helpers
{
    public sealed record EffectivePlan(string Tier, bool IsTrial, int TrialDaysRemaining, int? EmployeeCap, IReadOnlySet<string> Features);

    public static class PlanResolver
    {
        // past_due keeps access so Stripe's dunning retries don't lock out a paying customer mid-retry.
        private static readonly HashSet<string> PaidStatuses = new(StringComparer.OrdinalIgnoreCase) { "active", "trialing", "past_due" };

        public static bool GrantsPaidAccess(string? status) => status != null && PaidStatuses.Contains(status);

        public static EffectivePlan Resolve(Company company, DateTime utcNow)
        {
            var trialDays = company.TrialEndsAt is DateTime end && end > utcNow
                ? (int)Math.Ceiling((end - utcNow).TotalDays)
                : 0;

            string tier;
            var isTrial = false;
            if (GrantsPaidAccess(company.SubscriptionStatus) && PlanCatalog.IsPaidTier(company.Plan))
            {
                tier = PlanCatalog.Normalize(company.Plan!);
            }
            else if (trialDays > 0)
            {
                tier = PlanCatalog.Pro;
                isTrial = true;
            }
            else
            {
                tier = PlanCatalog.Free;
            }

            return new EffectivePlan(tier, isTrial, isTrial ? trialDays : 0, PlanCatalog.EmployeeCap(tier), PlanCatalog.Features(tier));
        }
    }
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `dotnet test ShiftWork.Api.Tests --filter "FullyQualifiedName~PlanResolverTests"`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add ShiftWork.Api/Helpers/PlanCatalog.cs ShiftWork.Api/Helpers/PlanResolver.cs ShiftWork.Api/Models/Company.cs ShiftWork.Api.Tests/Billing/PlanResolverTests.cs
git commit -m "feat(billing): add PlanCatalog tiers and pure PlanResolver"
```

---

### Task 2: Schema, migration and starting the trial on registration

**Files:**
- Create: `ShiftWork.Api/Models/StripeProcessedEvent.cs`, and the migration `StripeBillingV2` (generated)
- Modify:
  - `ShiftWork.Api/Data/ShiftWorkContext.cs` (DbSet and model config)
  - `ShiftWork.Api/Controllers/AuthController.cs` (call `PlanCatalog.StartTrial` in `Register`)
  - `ShiftWork.Api/DTOs/RegistrationDtos.cs` (`CompanyRegistrationResponse.TrialEndsAt`)
- Test: `ShiftWork.Api.Tests/Billing/StripeProcessedEventModelTests.cs`

**Interfaces:**
- Consumes: `PlanCatalog.StartTrial` (from Task 1).
- Produces:
  - `StripeProcessedEvent { string EventId; string Type; DateTime ProcessedAt }`
  - `ShiftWorkContext.StripeProcessedEvents`

- [ ] **Step 1: Write the failing test**

```csharp
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using Xunit;

namespace ShiftWork.Api.Tests.Billing;

public class StripeProcessedEventModelTests
{
    [Fact]
    public async Task ProcessedEvent_IsKeyedByEventId()
    {
        var ctx = new ShiftWorkContext(new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        ctx.StripeProcessedEvents.Add(new StripeProcessedEvent { EventId = "evt_1", Type = "x", ProcessedAt = DateTime.UtcNow });
        await ctx.SaveChangesAsync();

        var key = ctx.Model.FindEntityType(typeof(StripeProcessedEvent))!.FindPrimaryKey()!;
        Assert.Equal(nameof(StripeProcessedEvent.EventId), Assert.Single(key.Properties).Name);

        var customerIndex = ctx.Model.FindEntityType(typeof(Company))!.GetIndexes()
            .Single(i => i.Properties.Single().Name == nameof(Company.StripeCustomerId));
        Assert.True(customerIndex.IsUnique);
    }
}
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `dotnet test ShiftWork.Api.Tests --filter "FullyQualifiedName~StripeProcessedEventModelTests"`
Expected: compile error, because `StripeProcessedEvent` does not exist.

- [ ] **Step 3: Implement.** Create `Models/StripeProcessedEvent.cs`:

```csharp
namespace ShiftWork.Api.Models
{
    public class StripeProcessedEvent
    {
        public string EventId { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public DateTime ProcessedAt { get; set; }
    }
}
```

In `ShiftWorkContext`, add `public DbSet<StripeProcessedEvent> StripeProcessedEvents { get; set; }`. In `OnModelCreating`, after `modelBuilder.Entity<Company>().ToTable("Companies");`, add:

```csharp
            modelBuilder.Entity<Company>()
                .HasIndex(c => c.StripeCustomerId)
                .IsUnique()
                .HasFilter("[StripeCustomerId] IS NOT NULL");

            modelBuilder.Entity<StripeProcessedEvent>(e =>
            {
                e.ToTable("StripeProcessedEvents");
                e.HasKey(x => x.EventId);
                e.Property(x => x.EventId).HasMaxLength(255);
                e.Property(x => x.Type).HasMaxLength(100);
            });
```

In `AuthController.Register`, add `PlanCatalog.StartTrial(company, DateTime.UtcNow);` right after the `new Company { … }` initializer. In the response initializer, add `TrialEndsAt = company.TrialEndsAt`. Add `public DateTime? TrialEndsAt { get; set; }` to `CompanyRegistrationResponse`. Add `using ShiftWork.Api.Helpers;` if missing.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `dotnet test ShiftWork.Api.Tests --filter "FullyQualifiedName~StripeProcessedEventModelTests"`
Expected: PASS.

- [ ] **Step 5: Generate the migration, then add the sample-data reset** (all existing data is sample data, per William)

Run: `cd ShiftWork.Api; dotnet ef migrations add StripeBillingV2`

Then, at the end of the generated `Up()`, append:

```csharp
            // All pre-launch companies are sample data: restart everyone on a clean 14-day trial.
            migrationBuilder.Sql(
                "UPDATE Companies SET [Plan] = 'Free', TrialEndsAt = DATEADD(day, 14, SYSUTCDATETIME()), " +
                "SubscriptionStatus = NULL, CurrentPeriodEnd = NULL, StripeCustomerId = NULL, StripeSubscriptionId = NULL");
```

Check that the generated `Up()` adds the 3 columns, the `StripeProcessedEvents` table and the filtered unique index `IX_Companies_StripeCustomerId`.

- [ ] **Step 6: Build and run the full suite**

Run: `dotnet build ShiftWork.Api; dotnet test ShiftWork.Api.Tests`
Expected: the build succeeds and all tests pass.

- [ ] **Step 7: Commit**

```bash
git add ShiftWork.Api/Models ShiftWork.Api/Data/ShiftWorkContext.cs ShiftWork.Api/Migrations ShiftWork.Api/Controllers/AuthController.cs ShiftWork.Api/DTOs/RegistrationDtos.cs ShiftWork.Api.Tests/Billing/StripeProcessedEventModelTests.cs
git commit -m "feat(billing): add trial/subscription columns, processed-events table, trial on signup"
```

---

### Task 3: PlanService uses the resolver; remove the card-token upgrade

**Files:**
- Modify:
  - `ShiftWork.Api/Services/PlanService.cs`, `ShiftWork.Api/Services/IPlanService.cs`
  - `ShiftWork.Api/Controllers/CompanyController.cs` (delete the `UpgradePlan` action; drop `_planService` only if nothing else uses it)
  - `ShiftWork.Api/DTOs/RegistrationDtos.cs` (delete `PlanUpgradeRequest` / `PlanUpgradeResponse`)
- Test: `ShiftWork.Api.Tests/Plan/PlanServiceTests.cs` (rewrite)

**Interfaces:**
- Consumes: `PlanResolver.Resolve`, `EffectivePlan` (from Task 1).
- Produces:
  - `IPlanService.GetEffectivePlanAsync(string companyId) : Task<EffectivePlan>` (a missing company resolves as a bare Free company)
  - `IPlanService.GetCurrentPlanAsync(string companyId) : Task<string>` (returns the effective tier)
  - `IPlanService.IsFeatureEnabledAsync(string companyId, string featureKey) : Task<bool>`
  - The constructor takes `(ShiftWorkContext context, ILogger<PlanService> logger, TimeProvider? clock = null)`.

- [ ] **Step 1: Rewrite the tests.** Replace the body of `PlanServiceTests` with:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Plan;

public class PlanServiceTests : IDisposable
{
    private static readonly DateTimeOffset Now = new(2026, 9, 28, 12, 0, 0, TimeSpan.Zero);
    private readonly ShiftWorkContext _context;
    private readonly PlanService _svc;

    public PlanServiceTests()
    {
        _context = new ShiftWorkContext(new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        _svc = new PlanService(_context, NullLogger<PlanService>.Instance, new FakeTimeProvider(Now));
    }

    private async Task<string> AddCompany(string plan, string? status = null, DateTime? trialEnds = null)
    {
        var id = Guid.NewGuid().ToString();
        _context.Companies.Add(new Company
        {
            CompanyId = id, Name = "C", Email = $"{id}@t.com", PhoneNumber = "", Address = "", TimeZone = "UTC",
            Plan = plan, SubscriptionStatus = status, TrialEndsAt = trialEnds
        });
        await _context.SaveChangesAsync();
        return id;
    }

    [Fact]
    public async Task Free_NoTrial_CannotDeleteSandbox()
        => Assert.False(await _svc.IsFeatureEnabledAsync(await AddCompany("Free"), "sandbox.delete"));

    [Fact]
    public async Task ActiveTrial_GetsProFeatures()
    {
        var id = await AddCompany("Free", null, Now.UtcDateTime.AddDays(3));
        Assert.True(await _svc.IsFeatureEnabledAsync(id, "analytics"));
        Assert.Equal("Pro", await _svc.GetCurrentPlanAsync(id));
    }

    [Fact]
    public async Task ActiveStarter_HasSandboxDelete_ButNotAnalytics()
    {
        var id = await AddCompany("Starter", "active");
        Assert.True(await _svc.IsFeatureEnabledAsync(id, "sandbox.delete"));
        Assert.False(await _svc.IsFeatureEnabledAsync(id, "analytics"));
    }

    [Fact]
    public async Task CanceledPro_IsFree()
        => Assert.Equal("Free", await _svc.GetCurrentPlanAsync(await AddCompany("Pro", "canceled")));

    [Fact]
    public async Task MissingCompany_IsFree()
    {
        var p = await _svc.GetEffectivePlanAsync("nope");
        Assert.Equal("Free", p.Tier);
        Assert.False(await _svc.IsFeatureEnabledAsync("nope", "sandbox.delete"));
    }

    [Fact]
    public async Task FeatureKey_IsCaseInsensitive()
        => Assert.True(await _svc.IsFeatureEnabledAsync(await AddCompany("Pro", "active"), "SANDBOX.DELETE"));

    public void Dispose() => _context.Dispose();
}
```

Add the package `Microsoft.Extensions.TimeProvider.Testing` (version 9.0.0) to `ShiftWork.Api.Tests.csproj`.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `dotnet test ShiftWork.Api.Tests --filter "FullyQualifiedName~PlanServiceTests"`
Expected: compile error, because the constructor has no `TimeProvider` parameter and `GetEffectivePlanAsync` does not exist.

- [ ] **Step 3: Implement.** New `IPlanService`:

```csharp
using ShiftWork.Api.Helpers;

namespace ShiftWork.Api.Services
{
    /// <summary>Effective plan and feature gates for a company; paid state is written only by Stripe webhooks.</summary>
    public interface IPlanService
    {
        Task<EffectivePlan> GetEffectivePlanAsync(string companyId);
        Task<string> GetCurrentPlanAsync(string companyId);
        Task<bool> IsFeatureEnabledAsync(string companyId, string featureKey);
    }
}
```

New `PlanService`:

```csharp
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public class PlanService : IPlanService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<PlanService> _logger;
        private readonly TimeProvider _clock;

        public PlanService(ShiftWorkContext context, ILogger<PlanService> logger, TimeProvider? clock = null)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _clock = clock ?? TimeProvider.System;
        }

        public async Task<EffectivePlan> GetEffectivePlanAsync(string companyId)
        {
            var company = await _context.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.CompanyId == companyId)
                ?? new Company { CompanyId = companyId, Plan = PlanCatalog.Free };
            return PlanResolver.Resolve(company, _clock.GetUtcNow().UtcDateTime);
        }

        public async Task<string> GetCurrentPlanAsync(string companyId) => (await GetEffectivePlanAsync(companyId)).Tier;

        public async Task<bool> IsFeatureEnabledAsync(string companyId, string featureKey)
            => (await GetEffectivePlanAsync(companyId)).Features.Contains(featureKey);
    }
}
```

In `CompanyController`: delete the whole `UpgradePlan` action (the `[HttpPost("{companyId}/plan/upgrade")]` block). In `RegistrationDtos.cs`: delete `PlanUpgradeRequest` and `PlanUpgradeResponse`. Then run `dotnet build ShiftWork.Api` and fix any remaining reference it reports.

- [ ] **Step 4: Run the suite and confirm it passes**

Run: `dotnet test ShiftWork.Api.Tests`
Expected: all pass. `SandboxService` callers of `IsFeatureEnabledAsync` are unchanged.

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Api ShiftWork.Api.Tests
git commit -m "refactor(billing): PlanService resolves effective plan; remove card-token upgrade endpoint"
```

---

### Task 4: Server-side employee cap

**Files:**
- Create: `ShiftWork.Api/Helpers/PlanLimitExceededException.cs`, `ShiftWork.Api/Services/PlanEnforcementService.cs`
- Modify:
  - `ShiftWork.Api/Services/PeopleService.cs` (constructor and 3 hooks)
  - `ShiftWork.Api/Controllers/PeopleController.cs` (409 catch in `PostPerson`, `PutPerson`, `PatchPerson`, `UpdatePersonStatus`, `RegisterUser`, `CreateEmployeeWithUser`)
  - `Program.cs` (`AddScoped<IPlanEnforcementService, PlanEnforcementService>()`)
- Test: `ShiftWork.Api.Tests/Billing/PlanEnforcementServiceTests.cs`

**Interfaces:**
- Consumes: `IPlanService.GetEffectivePlanAsync` (Task 3).
- Produces:
  - `IPlanEnforcementService.EnsureCanActivateEmployeeAsync(string companyId) : Task` (throws `PlanLimitExceededException`)
  - `PlanLimitExceededException(string tier, int cap, int count)` with a `.ToResponseBody()` method
  - `PlanEnforcementService.IsActiveStatus(string? status) : bool`

- [ ] **Step 1: Write the failing tests**

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using ShiftWork.Api.Data;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Billing;

public class PlanEnforcementServiceTests : IDisposable
{
    private static readonly DateTimeOffset Now = new(2026, 9, 28, 12, 0, 0, TimeSpan.Zero);
    private readonly ShiftWorkContext _ctx;
    private readonly PlanEnforcementService _sut;
    private readonly PeopleService _people;

    public PlanEnforcementServiceTests()
    {
        _ctx = new ShiftWorkContext(new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var plans = new PlanService(_ctx, NullLogger<PlanService>.Instance, new FakeTimeProvider(Now));
        _sut = new PlanEnforcementService(_ctx, plans);
        _people = new PeopleService(_ctx, NullLogger<PeopleService>.Instance, _sut);
    }

    private void Company(string plan = "Free", string? status = null, DateTime? trialEnds = null) =>
        _ctx.Companies.Add(new Company { CompanyId = "c1", Name = "C", Email = "c@t.com", Address = "", PhoneNumber = "",
            TimeZone = "UTC", Plan = plan, SubscriptionStatus = status, TrialEndsAt = trialEnds });

    private void People(int n, string status = "Active", bool sandbox = false)
    {
        for (var i = 0; i < n; i++)
            _ctx.Persons.Add(new Person { Name = $"p{i}", Email = $"{Guid.NewGuid()}@t.com", CompanyId = "c1", Status = status, IsSandbox = sandbox });
    }

    [Fact]
    public async Task UnderCap_Passes()
    {
        Company(); People(4); await _ctx.SaveChangesAsync();
        await _sut.EnsureCanActivateEmployeeAsync("c1");
    }

    [Fact]
    public async Task AtCap_Throws_WithDetails()
    {
        Company(); People(5); await _ctx.SaveChangesAsync();
        var ex = await Assert.ThrowsAsync<PlanLimitExceededException>(() => _sut.EnsureCanActivateEmployeeAsync("c1"));
        Assert.Equal(("Free", 5, 5), (ex.Tier, ex.Cap, ex.Count));
    }

    [Fact]
    public async Task InactiveAndSandbox_AreNotCounted()
    {
        Company(); People(4); People(3, "Inactive"); People(10, sandbox: true); await _ctx.SaveChangesAsync();
        await _sut.EnsureCanActivateEmployeeAsync("c1");
    }

    [Fact]
    public async Task Trial_UsesProCap()
    {
        Company(trialEnds: Now.UtcDateTime.AddDays(2)); People(99); await _ctx.SaveChangesAsync();
        await _sut.EnsureCanActivateEmployeeAsync("c1");
    }

    [Fact]
    public async Task PastDueStarter_KeepsStarterCap()
    {
        Company("Starter", "past_due"); People(24); await _ctx.SaveChangesAsync();
        await _sut.EnsureCanActivateEmployeeAsync("c1");
    }

    [Fact]
    public async Task Business_IsUnlimited()
    {
        Company("Business", "active"); People(500); await _ctx.SaveChangesAsync();
        await _sut.EnsureCanActivateEmployeeAsync("c1");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("active")]
    [InlineData("Active")]
    public async Task PeopleAdd_NullOrAnyCaseActive_IsGuarded(string? status)
    {
        Company(); People(5); await _ctx.SaveChangesAsync();
        await Assert.ThrowsAsync<PlanLimitExceededException>(() =>
            _people.Add(new Person { Name = "n", Email = "n@t.com", CompanyId = "c1", Status = status! }));
    }

    [Fact]
    public async Task PeopleAdd_Sandbox_IsExempt()
    {
        Company(); People(5); await _ctx.SaveChangesAsync();
        await _people.Add(new Person { Name = "s", Email = "s@t.com", CompanyId = "c1", Status = "Active", IsSandbox = true });
    }

    [Fact]
    public async Task Reactivation_IsGuarded_ButInactiveEdit_IsNot()
    {
        Company(); People(5); People(1, "Inactive"); await _ctx.SaveChangesAsync();
        var inactive = await _ctx.Persons.FirstAsync(p => p.Status == "Inactive");

        await _people.UpdatePersonStatus(inactive.PersonId, "Inactive");
        await Assert.ThrowsAsync<PlanLimitExceededException>(() => _people.UpdatePersonStatus(inactive.PersonId, "Active"));

        var edit = new Person { PersonId = inactive.PersonId, CompanyId = "c1", Name = "x", Email = inactive.Email, Status = "Active" };
        await Assert.ThrowsAsync<PlanLimitExceededException>(() => _people.Update(edit));
    }

    [Fact]
    public async Task EditingAnAlreadyActivePerson_OverCap_IsAllowed()
    {
        Company(); People(7); await _ctx.SaveChangesAsync();
        var p = await _ctx.Persons.FirstAsync();
        await _people.Update(new Person { PersonId = p.PersonId, CompanyId = "c1", Name = "renamed", Email = p.Email, Status = "Active" });
    }

    public void Dispose() => _ctx.Dispose();
}
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `dotnet test ShiftWork.Api.Tests --filter "FullyQualifiedName~PlanEnforcementServiceTests"`
Expected: compile error, because the types don't exist and the `PeopleService` constructor doesn't match.

- [ ] **Step 3: Implement.** `Helpers/PlanLimitExceededException.cs`:

```csharp
namespace ShiftWork.Api.Helpers
{
    public class PlanLimitExceededException : Exception
    {
        public string Tier { get; }
        public int Cap { get; }
        public int Count { get; }

        public PlanLimitExceededException(string tier, int cap, int count)
            : base($"Your {tier} plan allows {cap} active employees. Upgrade to add more.")
        {
            Tier = tier; Cap = cap; Count = count;
        }

        public object ToResponseBody() => new { code = "plan_limit_exceeded", tier = Tier, cap = Cap, count = Count, message = Message };
    }
}
```

`Services/PlanEnforcementService.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Helpers;

namespace ShiftWork.Api.Services
{
    public interface IPlanEnforcementService
    {
        Task EnsureCanActivateEmployeeAsync(string companyId);
    }

    public class PlanEnforcementService : IPlanEnforcementService
    {
        private readonly ShiftWorkContext _context;
        private readonly IPlanService _plans;

        public PlanEnforcementService(ShiftWorkContext context, IPlanService plans)
        {
            _context = context;
            _plans = plans;
        }

        public static bool IsActiveStatus(string? status) =>
            status == null || status.Equals("Active", StringComparison.OrdinalIgnoreCase);

        public async Task EnsureCanActivateEmployeeAsync(string companyId)
        {
            var plan = await _plans.GetEffectivePlanAsync(companyId);
            if (plan.EmployeeCap is not int cap) return;

            var count = await _context.Persons.CountAsync(p =>
                p.CompanyId == companyId && !p.IsSandbox && (p.Status == null || p.Status.ToLower() == "active"));

            if (count >= cap) throw new PlanLimitExceededException(plan.Tier, cap, count);
        }
    }
}
```

In `PeopleService`, add the field `private readonly IPlanEnforcementService _planEnforcement;`, change the constructor to `PeopleService(ShiftWorkContext context, ILogger<PeopleService> logger, IPlanEnforcementService planEnforcement)`, and assign the field. Then add the hooks:

```csharp
        // In Add(), first line:
            if (!person.IsSandbox && PlanEnforcementService.IsActiveStatus(person.Status))
                await _planEnforcement.EnsureCanActivateEmployeeAsync(person.CompanyId);

        // In Update(), after the existingPerson null check, before assigning fields:
            if (!existingPerson.IsSandbox
                && !PlanEnforcementService.IsActiveStatus(existingPerson.Status)
                && PlanEnforcementService.IsActiveStatus(person.Status))
                await _planEnforcement.EnsureCanActivateEmployeeAsync(existingPerson.CompanyId);

        // In UpdatePersonStatus(), inside `if (person != null)`, before assigning Status:
                if (!person.IsSandbox
                    && !PlanEnforcementService.IsActiveStatus(person.Status)
                    && PlanEnforcementService.IsActiveStatus(status))
                    await _planEnforcement.EnsureCanActivateEmployeeAsync(person.CompanyId);
```

Add `using ShiftWork.Api.Helpers;` where needed. In `PeopleController`, in each of the 6 actions listed above, add this as the **first** catch of the outermost `try`:

```csharp
            catch (PlanLimitExceededException ex)
            {
                return Conflict(ex.ToResponseBody());
            }
```

Add `[ProducesResponseType(409)]` to those actions. Register the service in `Program.cs` next to `IPeopleService`. Then search the solution for `new PeopleService(` and pass `Mock.Of<IPlanEnforcementService>()` in any other test that constructs it.

- [ ] **Step 4: Run the suite and confirm it passes**

Run: `dotnet test ShiftWork.Api.Tests`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Api ShiftWork.Api.Tests
git commit -m "feat(billing): enforce employee cap on every activate path, 409 plan_limit_exceeded"
```

---

### Task 5: Stripe settings and gateway

**Files:**
- Create: `ShiftWork.Api/Helpers/StripeSettings.cs`, `ShiftWork.Api/Services/StripeGateway.cs`
- Modify: `ShiftWork.Api/ShiftWork.Api.csproj` (add `<PackageReference Include="Stripe.net" Version="52.2.0" />`)
- Test: `ShiftWork.Api.Tests/Billing/StripeSettingsTests.cs`, `ShiftWork.Api.Tests/Billing/FakeStripeGateway.cs`

**Interfaces:**
- Produces:
  - `StripeSettings` with the properties `SecretKey`, `WebhookSecret`, `PriceStarter`, `PricePro`, `PriceBusiness`, `AppBaseUrl`, `IsConfigured`
  - `StripeSettings.FromEnvironment()`
  - `StripeSettings.PriceIdFor(string tier) : string?`
  - `StripeSettings.TierForPriceId(string? priceId) : string?`
  - `StripeSettings.AppUrl(string path) : string`
  - `IStripeGateway` with:
    - `CreateCustomerAsync(string companyId, string email, string name) : Task<string>`
    - `CreateCheckoutSessionAsync(CheckoutSessionRequest r) : Task<string>` (returns the URL)
    - `CreatePortalSessionAsync(string customerId, string returnUrl) : Task<string>` (returns the URL)
    - `GetSubscriptionAsync(string subscriptionId) : Task<StripeSubscriptionSnapshot?>`
  - `record CheckoutSessionRequest(string CompanyId, string CustomerId, string PriceId, string SuccessUrl, string CancelUrl, string IdempotencyKey)`
  - `record StripeSubscriptionSnapshot(string Id, string CustomerId, string Status, string? PriceId, DateTime? CurrentPeriodEnd)`
  - `FakeStripeGateway` (test double) with the public lists `Checkouts`, `Portals`, `CreatedCustomers`, the dictionary `Subscriptions`, and a `Func<Exception?> FailGetSubscription`

- [ ] **Step 1: Write the failing tests**

```csharp
using ShiftWork.Api.Helpers;
using Xunit;

namespace ShiftWork.Api.Tests.Billing;

public class StripeSettingsTests
{
    private static StripeSettings S() => new()
    {
        SecretKey = "sk_test", PriceStarter = "price_s", PricePro = "price_p", PriceBusiness = "price_b",
        AppBaseUrl = "https://app.loqzen.com/"
    };

    [Theory]
    [InlineData("Starter", "price_s")]
    [InlineData("pro", "price_p")]
    [InlineData("Business", "price_b")]
    [InlineData("Free", null)]
    [InlineData("Enterprise", null)]
    public void PriceIdFor_MapsPaidTiersOnly(string tier, string? expected) => Assert.Equal(expected, S().PriceIdFor(tier));

    [Theory]
    [InlineData("price_s", "Starter")]
    [InlineData("price_b", "Business")]
    [InlineData("price_unknown", null)]
    [InlineData(null, null)]
    public void TierForPriceId_ReverseMaps(string? price, string? expected) => Assert.Equal(expected, S().TierForPriceId(price));

    [Fact]
    public void AppUrl_JoinsWithoutDoubleSlash() =>
        Assert.Equal("https://app.loqzen.com/dashboard/billing", S().AppUrl("/dashboard/billing"));

    [Fact]
    public void IsConfigured_RequiresSecretKey()
    {
        Assert.True(S().IsConfigured);
        Assert.False(new StripeSettings().IsConfigured);
    }
}
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `dotnet test ShiftWork.Api.Tests --filter "FullyQualifiedName~StripeSettingsTests"`
Expected: compile error.

- [ ] **Step 3: Implement.** `Helpers/StripeSettings.cs`:

```csharp
namespace ShiftWork.Api.Helpers
{
    public sealed class StripeSettings
    {
        public string? SecretKey { get; init; }
        public string? WebhookSecret { get; init; }
        public string? PriceStarter { get; init; }
        public string? PricePro { get; init; }
        public string? PriceBusiness { get; init; }
        public string? AppBaseUrl { get; init; }

        public bool IsConfigured => !string.IsNullOrWhiteSpace(SecretKey);

        public static StripeSettings FromEnvironment() => new()
        {
            SecretKey = Environment.GetEnvironmentVariable("STRIPE_SECRET_KEY"),
            WebhookSecret = Environment.GetEnvironmentVariable("STRIPE_WEBHOOK_SECRET"),
            PriceStarter = Environment.GetEnvironmentVariable("STRIPE_PRICE_STARTER"),
            PricePro = Environment.GetEnvironmentVariable("STRIPE_PRICE_PRO"),
            PriceBusiness = Environment.GetEnvironmentVariable("STRIPE_PRICE_BUSINESS"),
            AppBaseUrl = Environment.GetEnvironmentVariable("APP_BASE_URL"),
        };

        private IEnumerable<(string Tier, string? Price)> Map() => new[]
        {
            (PlanCatalog.Starter, PriceStarter), (PlanCatalog.Pro, PricePro), (PlanCatalog.Business, PriceBusiness)
        };

        public string? PriceIdFor(string tier) =>
            Map().FirstOrDefault(m => m.Tier.Equals(tier, StringComparison.OrdinalIgnoreCase)).Price is { Length: > 0 } p ? p : null;

        public string? TierForPriceId(string? priceId) =>
            string.IsNullOrWhiteSpace(priceId) ? null : Map().FirstOrDefault(m => m.Price == priceId).Tier;

        public string AppUrl(string path) => $"{(AppBaseUrl ?? "http://localhost:4200").TrimEnd('/')}/{path.TrimStart('/')}";
    }
}
```

`Services/StripeGateway.cs`:

```csharp
using ShiftWork.Api.Helpers;
using Stripe;

namespace ShiftWork.Api.Services
{
    public record CheckoutSessionRequest(string CompanyId, string CustomerId, string PriceId, string SuccessUrl, string CancelUrl, string IdempotencyKey);
    public record StripeSubscriptionSnapshot(string Id, string CustomerId, string Status, string? PriceId, DateTime? CurrentPeriodEnd);

    /// <summary>Only seam to Stripe, so billing and webhook logic are testable without the network.</summary>
    public interface IStripeGateway
    {
        Task<string> CreateCustomerAsync(string companyId, string email, string name);
        Task<string> CreateCheckoutSessionAsync(CheckoutSessionRequest request);
        Task<string> CreatePortalSessionAsync(string customerId, string returnUrl);
        Task<StripeSubscriptionSnapshot?> GetSubscriptionAsync(string subscriptionId);
    }

    public class StripeGateway : IStripeGateway
    {
        private readonly StripeClient _client;

        public StripeGateway(StripeSettings settings)
        {
            // Placeholder key keeps DI construction working in simulation mode; BillingService never calls us then.
            _client = new StripeClient(settings.SecretKey ?? "sk_unconfigured");
        }

        public async Task<string> CreateCustomerAsync(string companyId, string email, string name)
        {
            var customer = await new CustomerService(_client).CreateAsync(new CustomerCreateOptions
            {
                Email = email,
                Name = name,
                Metadata = new Dictionary<string, string> { ["companyId"] = companyId }
            }, new RequestOptions { IdempotencyKey = $"customer:{companyId}" });
            return customer.Id;
        }

        public async Task<string> CreateCheckoutSessionAsync(CheckoutSessionRequest r)
        {
            var session = await new Stripe.Checkout.SessionService(_client).CreateAsync(new Stripe.Checkout.SessionCreateOptions
            {
                Mode = "subscription",
                Customer = r.CustomerId,
                ClientReferenceId = r.CompanyId,
                Metadata = new Dictionary<string, string> { ["companyId"] = r.CompanyId },
                SubscriptionData = new Stripe.Checkout.SessionSubscriptionDataOptions
                {
                    Metadata = new Dictionary<string, string> { ["companyId"] = r.CompanyId }
                },
                LineItems = new List<Stripe.Checkout.SessionLineItemOptions> { new() { Price = r.PriceId, Quantity = 1 } },
                SuccessUrl = r.SuccessUrl,
                CancelUrl = r.CancelUrl,
            }, new RequestOptions { IdempotencyKey = r.IdempotencyKey });
            return session.Url;
        }

        public async Task<string> CreatePortalSessionAsync(string customerId, string returnUrl)
        {
            var session = await new Stripe.BillingPortal.SessionService(_client).CreateAsync(
                new Stripe.BillingPortal.SessionCreateOptions { Customer = customerId, ReturnUrl = returnUrl });
            return session.Url;
        }

        public async Task<StripeSubscriptionSnapshot?> GetSubscriptionAsync(string subscriptionId)
        {
            try
            {
                var s = await new SubscriptionService(_client).GetAsync(subscriptionId);
                var item = s.Items?.Data?.FirstOrDefault();
                return new StripeSubscriptionSnapshot(s.Id, s.CustomerId, s.Status, item?.Price?.Id, item?.CurrentPeriodEnd);
            }
            catch (StripeException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return null;
            }
        }
    }
}
```

`ShiftWork.Api.Tests/Billing/FakeStripeGateway.cs`:

```csharp
using ShiftWork.Api.Services;

namespace ShiftWork.Api.Tests.Billing;

public class FakeStripeGateway : IStripeGateway
{
    public List<CheckoutSessionRequest> Checkouts { get; } = new();
    public List<(string CustomerId, string ReturnUrl)> Portals { get; } = new();
    public List<string> CreatedCustomers { get; } = new();
    public Dictionary<string, StripeSubscriptionSnapshot> Subscriptions { get; } = new();
    public Func<Exception?> FailGetSubscription { get; set; } = () => null;

    public Task<string> CreateCustomerAsync(string companyId, string email, string name)
    {
        var id = $"cus_{companyId}";
        CreatedCustomers.Add(id);
        return Task.FromResult(id);
    }

    public Task<string> CreateCheckoutSessionAsync(CheckoutSessionRequest request)
    {
        Checkouts.Add(request);
        return Task.FromResult($"https://checkout.stripe.test/{Checkouts.Count}");
    }

    public Task<string> CreatePortalSessionAsync(string customerId, string returnUrl)
    {
        Portals.Add((customerId, returnUrl));
        return Task.FromResult("https://billing.stripe.test/portal");
    }

    public Task<StripeSubscriptionSnapshot?> GetSubscriptionAsync(string subscriptionId)
    {
        if (FailGetSubscription() is Exception ex) throw ex;
        return Task.FromResult(Subscriptions.TryGetValue(subscriptionId, out var s) ? s : null);
    }
}
```

- [ ] **Step 4: Restore and run the tests; confirm they pass**

Run: `dotnet restore ShiftWork.Api; dotnet test ShiftWork.Api.Tests --filter "FullyQualifiedName~StripeSettingsTests"`
Expected: PASS. If `SubscriptionItem.CurrentPeriodEnd` or `Subscription.CustomerId` fail to compile, check the Stripe.net 52.2.0 model in the IDE and adjust only those property names.

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Api/ShiftWork.Api.csproj ShiftWork.Api/Helpers/StripeSettings.cs ShiftWork.Api/Services/StripeGateway.cs ShiftWork.Api.Tests/Billing/StripeSettingsTests.cs ShiftWork.Api.Tests/Billing/FakeStripeGateway.cs
git commit -m "feat(billing): add StripeSettings price mapping and IStripeGateway on StripeClient"
```

---

### Task 6: BillingService (summary, checkout, portal, simulation)

**Files:**
- Create: `ShiftWork.Api/Services/BillingService.cs`, `ShiftWork.Api/DTOs/BillingDtos.cs`
- Test: `ShiftWork.Api.Tests/Billing/BillingServiceTests.cs`

**Interfaces:**
- Consumes:
  - `IPlanService.GetEffectivePlanAsync` (Task 3)
  - `IStripeGateway`, `CheckoutSessionRequest` (Task 5)
  - `StripeSettings` (Task 5)
  - `PlanEnforcementService.IsActiveStatus` (Task 4)
- Produces:
  - `IBillingService` with:
    - `GetSummaryAsync(string companyId, bool canManageBilling) : Task<BillingSummaryDto?>`
    - `CreateCheckoutSessionAsync(string companyId, string tier) : Task<BillingRedirectResult>`
    - `CreatePortalSessionAsync(string companyId) : Task<BillingRedirectResult>`
  - `enum BillingOutcome { Ok, CompanyNotFound, InvalidTier, SubscriptionExists, NoCustomer, BillingUnavailable }`
  - `record BillingRedirectResult(BillingOutcome Outcome, string? Url = null)`
  - `BillingSummaryDto`, `CheckoutSessionRequestDto { string Tier }`, `BillingRedirectDto { string Url }`
  - The constructor takes `(ShiftWorkContext, IPlanService, IStripeGateway, StripeSettings, IHostEnvironment, ILogger<BillingService>, TimeProvider? clock = null)`.

- [ ] **Step 1: Write the failing tests**

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Moq;
using ShiftWork.Api.Data;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Billing;

public class BillingServiceTests : IDisposable
{
    private static readonly DateTimeOffset Now = new(2026, 9, 28, 12, 0, 30, TimeSpan.Zero);
    private readonly ShiftWorkContext _ctx;
    private readonly FakeStripeGateway _gw = new();
    private readonly FakeTimeProvider _clock = new(Now);

    private static readonly StripeSettings Configured = new()
    {
        SecretKey = "sk_test", PriceStarter = "price_s", PricePro = "price_p", PriceBusiness = "price_b",
        AppBaseUrl = "https://app.loqzen.com"
    };

    public BillingServiceTests()
    {
        _ctx = new ShiftWorkContext(new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        _ctx.Companies.Add(new Company { CompanyId = "c1", Name = "Acme", Email = "a@acme.com", Address = "",
            PhoneNumber = "", TimeZone = "UTC", Plan = "Free", TrialEndsAt = Now.UtcDateTime.AddDays(10) });
        _ctx.Persons.Add(new Person { Name = "p", Email = "p@t.com", CompanyId = "c1", Status = "Active" });
        _ctx.SaveChanges();
    }

    private BillingService Sut(StripeSettings? s = null, string env = "Production")
    {
        var host = Mock.Of<IHostEnvironment>(h => h.EnvironmentName == env);
        var plans = new PlanService(_ctx, NullLogger<PlanService>.Instance, _clock);
        return new BillingService(_ctx, plans, _gw, s ?? Configured, host, NullLogger<BillingService>.Instance, _clock);
    }

    [Fact]
    public async Task Summary_ReportsTrialUsageAndCap()
    {
        var dto = await Sut().GetSummaryAsync("c1", canManageBilling: true);
        Assert.NotNull(dto);
        Assert.Equal(("Pro", true, 10, 1, (int?)100, true),
            (dto!.Tier, dto.IsTrial, dto.TrialDaysRemaining, dto.EmployeeCount, dto.EmployeeCap, dto.CanManageBilling));
    }

    [Fact]
    public async Task Summary_UnknownCompany_IsNull() => Assert.Null(await Sut().GetSummaryAsync("nope", true));

    [Fact]
    public async Task Checkout_CreatesCustomerOnce_AndServerBuiltUrls()
    {
        var r = await Sut().CreateCheckoutSessionAsync("c1", "pro");
        Assert.Equal(BillingOutcome.Ok, r.Outcome);
        var req = Assert.Single(_gw.Checkouts);
        Assert.Equal(("c1", "cus_c1", "price_p"), (req.CompanyId, req.CustomerId, req.PriceId));
        Assert.Equal("https://app.loqzen.com/dashboard/billing?checkout=success", req.SuccessUrl);
        Assert.Equal("https://app.loqzen.com/dashboard/billing?checkout=cancel", req.CancelUrl);
        Assert.Equal("cus_c1", (await _ctx.Companies.FindAsync("c1"))!.StripeCustomerId);

        await Sut().CreateCheckoutSessionAsync("c1", "Starter");
        Assert.Single(_gw.CreatedCustomers);
    }

    [Fact]
    public async Task Checkout_DoubleClickSameMinute_ReusesIdempotencyKey()
    {
        await Sut().CreateCheckoutSessionAsync("c1", "Pro");
        _clock.Advance(TimeSpan.FromSeconds(20));
        await Sut().CreateCheckoutSessionAsync("c1", "Pro");
        Assert.Equal(_gw.Checkouts[0].IdempotencyKey, _gw.Checkouts[1].IdempotencyKey);
        Assert.Equal("checkout:c1:Pro:202609281200", _gw.Checkouts[0].IdempotencyKey);
    }

    [Theory]
    [InlineData("Free")]
    [InlineData("Enterprise")]
    [InlineData("")]
    public async Task Checkout_InvalidTier(string tier) =>
        Assert.Equal(BillingOutcome.InvalidTier, (await Sut().CreateCheckoutSessionAsync("c1", tier)).Outcome);

    [Theory]
    [InlineData("active")]
    [InlineData("past_due")]
    [InlineData("incomplete")]
    public async Task Checkout_WithLiveSubscription_IsRefused(string status)
    {
        var c = await _ctx.Companies.FindAsync("c1");
        c!.StripeSubscriptionId = "sub_1"; c.SubscriptionStatus = status; await _ctx.SaveChangesAsync();
        Assert.Equal(BillingOutcome.SubscriptionExists, (await Sut().CreateCheckoutSessionAsync("c1", "Pro")).Outcome);
        Assert.Empty(_gw.Checkouts);
    }

    [Fact]
    public async Task Checkout_AfterCanceledSubscription_IsAllowed()
    {
        var c = await _ctx.Companies.FindAsync("c1");
        c!.StripeSubscriptionId = "sub_old"; c.SubscriptionStatus = "canceled"; await _ctx.SaveChangesAsync();
        Assert.Equal(BillingOutcome.Ok, (await Sut().CreateCheckoutSessionAsync("c1", "Pro")).Outcome);
    }

    [Fact]
    public async Task Checkout_Unconfigured_InProduction_IsUnavailable() =>
        Assert.Equal(BillingOutcome.BillingUnavailable,
            (await Sut(new StripeSettings(), "Production").CreateCheckoutSessionAsync("c1", "Pro")).Outcome);

    [Fact]
    public async Task Checkout_Unconfigured_InDevelopment_Simulates()
    {
        var r = await Sut(new StripeSettings { AppBaseUrl = "http://localhost:4200" }, "Development")
            .CreateCheckoutSessionAsync("c1", "Business");
        Assert.Equal(BillingOutcome.Ok, r.Outcome);
        Assert.Equal("http://localhost:4200/dashboard/billing?checkout=success", r.Url);
        var c = await _ctx.Companies.FindAsync("c1");
        Assert.Equal(("Business", "active"), (c!.Plan, c.SubscriptionStatus));
        Assert.Empty(_gw.Checkouts);
    }

    [Fact]
    public async Task Portal_WithoutCustomer_IsNoCustomer() =>
        Assert.Equal(BillingOutcome.NoCustomer, (await Sut().CreatePortalSessionAsync("c1")).Outcome);

    [Fact]
    public async Task Portal_UsesServerReturnUrl()
    {
        var c = await _ctx.Companies.FindAsync("c1");
        c!.StripeCustomerId = "cus_x"; await _ctx.SaveChangesAsync();
        var r = await Sut().CreatePortalSessionAsync("c1");
        Assert.Equal(BillingOutcome.Ok, r.Outcome);
        Assert.Equal(("cus_x", "https://app.loqzen.com/dashboard/billing"), Assert.Single(_gw.Portals));
    }

    [Fact]
    public async Task UnknownCompany_IsNotFound()
    {
        Assert.Equal(BillingOutcome.CompanyNotFound, (await Sut().CreateCheckoutSessionAsync("nope", "Pro")).Outcome);
        Assert.Equal(BillingOutcome.CompanyNotFound, (await Sut().CreatePortalSessionAsync("nope")).Outcome);
    }

    public void Dispose() => _ctx.Dispose();
}
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `dotnet test ShiftWork.Api.Tests --filter "FullyQualifiedName~BillingServiceTests"`
Expected: compile error.

- [ ] **Step 3: Implement.** `DTOs/BillingDtos.cs`:

```csharp
namespace ShiftWork.Api.DTOs
{
    public class BillingSummaryDto
    {
        public string Tier { get; set; } = "Free";
        public bool IsTrial { get; set; }
        public int TrialDaysRemaining { get; set; }
        public DateTime? TrialEndsAt { get; set; }
        public string? SubscriptionStatus { get; set; }
        public bool HasSubscription { get; set; }
        public DateTime? CurrentPeriodEnd { get; set; }
        public int EmployeeCount { get; set; }
        public int? EmployeeCap { get; set; }
        public bool CanManageBilling { get; set; }
    }

    public class CheckoutSessionRequestDto
    {
        public string Tier { get; set; } = string.Empty;
    }

    public class BillingRedirectDto
    {
        public string Url { get; set; } = string.Empty;
    }
}
```

`Services/BillingService.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Helpers;

namespace ShiftWork.Api.Services
{
    public enum BillingOutcome { Ok, CompanyNotFound, InvalidTier, SubscriptionExists, NoCustomer, BillingUnavailable }
    public record BillingRedirectResult(BillingOutcome Outcome, string? Url = null);

    public interface IBillingService
    {
        Task<BillingSummaryDto?> GetSummaryAsync(string companyId, bool canManageBilling);
        Task<BillingRedirectResult> CreateCheckoutSessionAsync(string companyId, string tier);
        Task<BillingRedirectResult> CreatePortalSessionAsync(string companyId);
    }

    public class BillingService : IBillingService
    {
        private const string BillingPath = "/dashboard/billing";
        private static readonly HashSet<string> EndedStatuses = new(StringComparer.OrdinalIgnoreCase) { "canceled", "incomplete_expired" };

        private readonly ShiftWorkContext _context;
        private readonly IPlanService _plans;
        private readonly IStripeGateway _stripe;
        private readonly StripeSettings _settings;
        private readonly IHostEnvironment _env;
        private readonly ILogger<BillingService> _logger;
        private readonly TimeProvider _clock;

        public BillingService(ShiftWorkContext context, IPlanService plans, IStripeGateway stripe, StripeSettings settings,
            IHostEnvironment env, ILogger<BillingService> logger, TimeProvider? clock = null)
        {
            _context = context; _plans = plans; _stripe = stripe; _settings = settings; _env = env; _logger = logger;
            _clock = clock ?? TimeProvider.System;
        }

        public async Task<BillingSummaryDto?> GetSummaryAsync(string companyId, bool canManageBilling)
        {
            var company = await _context.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.CompanyId == companyId);
            if (company == null) return null;

            var plan = await _plans.GetEffectivePlanAsync(companyId);
            var count = await _context.Persons.CountAsync(p =>
                p.CompanyId == companyId && !p.IsSandbox && (p.Status == null || p.Status.ToLower() == "active"));

            return new BillingSummaryDto
            {
                Tier = plan.Tier,
                IsTrial = plan.IsTrial,
                TrialDaysRemaining = plan.TrialDaysRemaining,
                TrialEndsAt = company.TrialEndsAt,
                SubscriptionStatus = company.SubscriptionStatus,
                HasSubscription = HasLiveSubscription(company.StripeSubscriptionId, company.SubscriptionStatus),
                CurrentPeriodEnd = company.CurrentPeriodEnd,
                EmployeeCount = count,
                EmployeeCap = plan.EmployeeCap,
                CanManageBilling = canManageBilling,
            };
        }

        public async Task<BillingRedirectResult> CreateCheckoutSessionAsync(string companyId, string tier)
        {
            var company = await _context.Companies.FirstOrDefaultAsync(c => c.CompanyId == companyId);
            if (company == null) return new(BillingOutcome.CompanyNotFound);
            if (!PlanCatalog.IsPaidTier(tier)) return new(BillingOutcome.InvalidTier);
            tier = PlanCatalog.Normalize(tier);

            // One live subscription per company: tier changes go through the Customer Portal so Stripe prorates.
            if (HasLiveSubscription(company.StripeSubscriptionId, company.SubscriptionStatus))
                return new(BillingOutcome.SubscriptionExists);

            if (!_settings.IsConfigured)
            {
                if (!_env.IsDevelopment()) return new(BillingOutcome.BillingUnavailable);
                company.Plan = tier;
                company.SubscriptionStatus = "active";
                await _context.SaveChangesAsync();
                _logger.LogInformation("{EventName} {CompanyId} {Tier} stripe=simulated", FunnelEventNames.PlanUpgradeSimulated, companyId, tier);
                return new(BillingOutcome.Ok, _settings.AppUrl($"{BillingPath}?checkout=success"));
            }

            var priceId = _settings.PriceIdFor(tier);
            if (priceId == null)
            {
                _logger.LogError("No Stripe price configured for tier {Tier}.", tier);
                return new(BillingOutcome.BillingUnavailable);
            }

            if (string.IsNullOrWhiteSpace(company.StripeCustomerId))
            {
                company.StripeCustomerId = await _stripe.CreateCustomerAsync(company.CompanyId, company.Email, company.Name);
                await _context.SaveChangesAsync();
            }

            var minute = _clock.GetUtcNow().UtcDateTime.ToString("yyyyMMddHHmm");
            var url = await _stripe.CreateCheckoutSessionAsync(new CheckoutSessionRequest(
                company.CompanyId, company.StripeCustomerId!, priceId,
                _settings.AppUrl($"{BillingPath}?checkout=success"),
                _settings.AppUrl($"{BillingPath}?checkout=cancel"),
                $"checkout:{company.CompanyId}:{tier}:{minute}"));

            _logger.LogInformation("{EventName} {CompanyId} {Tier}", FunnelEventNames.PlanUpgradeStarted, companyId, tier);
            return new(BillingOutcome.Ok, url);
        }

        public async Task<BillingRedirectResult> CreatePortalSessionAsync(string companyId)
        {
            var company = await _context.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.CompanyId == companyId);
            if (company == null) return new(BillingOutcome.CompanyNotFound);
            if (string.IsNullOrWhiteSpace(company.StripeCustomerId)) return new(BillingOutcome.NoCustomer);
            if (!_settings.IsConfigured) return new(BillingOutcome.BillingUnavailable);

            var url = await _stripe.CreatePortalSessionAsync(company.StripeCustomerId, _settings.AppUrl(BillingPath));
            return new(BillingOutcome.Ok, url);
        }

        private static bool HasLiveSubscription(string? subscriptionId, string? status) =>
            !string.IsNullOrWhiteSpace(subscriptionId) && !(status != null && EndedStatuses.Contains(status));
    }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `dotnet test ShiftWork.Api.Tests --filter "FullyQualifiedName~BillingServiceTests"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Api/Services/BillingService.cs ShiftWork.Api/DTOs/BillingDtos.cs ShiftWork.Api.Tests/Billing/BillingServiceTests.cs
git commit -m "feat(billing): BillingService for summary, Checkout, Portal and dev-only simulation"
```

---

### Task 7: BillingController, permission and tenant isolation

**Files:**
- Create: `ShiftWork.Api/Controllers/BillingController.cs`
- Modify:
  - `ShiftWork.Api/Services/PermissionSeedService.cs` (add `Create("companies.billing", "Companies - Billing", "Manage subscription and billing")` next to `companies.delete`)
  - `Program.cs` (register the policy, `StripeSettings`, gateway and `BillingService`)
- Test: `ShiftWork.Api.Tests/Billing/BillingAuthorizationTests.cs`

**Interfaces:**
- Consumes: `IBillingService`, `BillingOutcome`, and the DTOs from Task 6; `PermissionAuthorizationHandler`, `PermissionRequirement` (existing).
- Produces:
  - `GET  api/companies/{companyId}/billing`
  - `POST api/companies/{companyId}/billing/checkout-session`
  - `POST api/companies/{companyId}/billing/portal-session`

- [ ] **Step 1: Write the failing tests.** Before writing the handler test, read `Models/Permission.cs`, `Models/RolePermission.cs`, `Models/UserRole.cs` and `Models/Role.cs`, and fill every required property in the entity initializers below.

```csharp
using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Moq;
using ShiftWork.Api.Authorization;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using Xunit;

namespace ShiftWork.Api.Tests.Billing;

public class BillingAuthorizationTests
{
    [Theory]
    [InlineData(nameof(BillingController.GetSummary), "company-settings.read")]
    [InlineData(nameof(BillingController.CreateCheckoutSession), "companies.billing")]
    [InlineData(nameof(BillingController.CreatePortalSession), "companies.billing")]
    public void EveryBillingAction_HasCompanyScopedPolicy(string action, string policy)
    {
        var method = typeof(BillingController).GetMethod(action)!;
        var attr = Assert.Single(method.GetCustomAttributes<AuthorizeAttribute>());
        Assert.Equal(policy, attr.Policy);
        Assert.Empty(typeof(BillingController).GetCustomAttributes<AllowAnonymousAttribute>());
    }

    [Theory]
    [InlineData("company-a", true)]
    [InlineData("company-b", false)]
    public async Task BillingPermission_OnlyAppliesToOwnCompany(string routeCompanyId, bool expected)
    {
        var ctx = new ShiftWorkContext(new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var perm = new Permission { Key = "companies.billing", Name = "Companies - Billing" };
        var role = new Role { Name = "Admin", CompanyId = "company-a" };
        ctx.AddRange(perm, role);
        ctx.CompanyUsers.Add(new CompanyUser { CompanyUserId = "cu1", Uid = "uid-1", Email = "a@a.com", DisplayName = "A", CompanyId = "company-a" });
        await ctx.SaveChangesAsync();
        ctx.RolePermissions.Add(new RolePermission { RoleId = role.RoleId, PermissionId = perm.PermissionId });
        ctx.UserRoles.Add(new UserRole { CompanyUserId = "cu1", CompanyId = "company-a", RoleId = role.RoleId });
        await ctx.SaveChangesAsync();

        var http = new DefaultHttpContext();
        http.Request.RouteValues = new RouteValueDictionary { ["companyId"] = routeCompanyId };
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, "uid-1") }, "test"));
        var requirement = new PermissionRequirement("companies.billing");
        var authCtx = new AuthorizationHandlerContext(new[] { requirement }, user, http);

        await new PermissionAuthorizationHandler(ctx, Mock.Of<IHttpContextAccessor>()).HandleAsync(authCtx);

        Assert.Equal(expected, authCtx.HasSucceeded);
    }
}
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `dotnet test ShiftWork.Api.Tests --filter "FullyQualifiedName~BillingAuthorizationTests"`
Expected: compile error, because `BillingController` does not exist.

- [ ] **Step 3: Implement** `Controllers/BillingController.cs`

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/billing")]
    public class BillingController : ControllerBase
    {
        private readonly IBillingService _billing;
        private readonly IAuthorizationService _authorization;

        public BillingController(IBillingService billing, IAuthorizationService authorization)
        {
            _billing = billing;
            _authorization = authorization;
        }

        [HttpGet]
        [Authorize(Policy = "company-settings.read")]
        [ProducesResponseType(typeof(BillingSummaryDto), 200)]
        [ProducesResponseType(404)]
        public async Task<ActionResult<BillingSummaryDto>> GetSummary(string companyId)
        {
            var canManage = (await _authorization.AuthorizeAsync(User, HttpContext, "companies.billing")).Succeeded;
            var summary = await _billing.GetSummaryAsync(companyId, canManage);
            return summary == null ? NotFound() : Ok(summary);
        }

        [HttpPost("checkout-session")]
        [Authorize(Policy = "companies.billing")]
        [ProducesResponseType(typeof(BillingRedirectDto), 200)]
        public async Task<ActionResult<BillingRedirectDto>> CreateCheckoutSession(string companyId, [FromBody] CheckoutSessionRequestDto request)
            => ToResult(await _billing.CreateCheckoutSessionAsync(companyId, request?.Tier ?? string.Empty));

        [HttpPost("portal-session")]
        [Authorize(Policy = "companies.billing")]
        [ProducesResponseType(typeof(BillingRedirectDto), 200)]
        public async Task<ActionResult<BillingRedirectDto>> CreatePortalSession(string companyId)
            => ToResult(await _billing.CreatePortalSessionAsync(companyId));

        private ActionResult<BillingRedirectDto> ToResult(BillingRedirectResult r) => r.Outcome switch
        {
            BillingOutcome.Ok => Ok(new BillingRedirectDto { Url = r.Url! }),
            BillingOutcome.CompanyNotFound => NotFound(),
            BillingOutcome.InvalidTier => BadRequest(new { code = "invalid_tier", message = "Choose Starter, Pro or Business." }),
            BillingOutcome.SubscriptionExists => Conflict(new { code = "subscription_exists", message = "Use Manage billing to change your plan." }),
            BillingOutcome.NoCustomer => Conflict(new { code = "no_customer", message = "No billing account yet. Choose a plan first." }),
            _ => StatusCode(503, new { code = "billing_unavailable", message = "Billing is temporarily unavailable." }),
        };
    }
}
```

In `Program.cs`, next to the `companies.*` policies, add:

```csharp
    options.AddPolicy("companies.billing", policy => policy.Requirements.Add(new PermissionRequirement("companies.billing")));
```

Next to `AddScoped<IPlanService, PlanService>()`, add:

```csharp
builder.Services.AddSingleton(StripeSettings.FromEnvironment());
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IStripeGateway, StripeGateway>();
builder.Services.AddScoped<IBillingService, BillingService>();
```

- [ ] **Step 4: Run the suite and confirm it passes**

Run: `dotnet test ShiftWork.Api.Tests`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Api ShiftWork.Api.Tests
git commit -m "feat(billing): tenant-scoped BillingController with companies.billing permission"
```

---

### Task 8: StripeWebhookService (dedup, fresh sync, linking, payment-failed email)

**Files:**
- Create: `ShiftWork.Api/Services/StripeWebhookService.cs`
- Test: `ShiftWork.Api.Tests/Billing/StripeWebhookServiceTests.cs`

**Interfaces:**
- Consumes: `IStripeGateway.GetSubscriptionAsync`, `StripeSettings.TierForPriceId` (Task 5); `INotificationService.SendEmailAsync` (existing); `StripeProcessedEvent` (Task 2).
- Produces: `IStripeWebhookService.ProcessAsync(Stripe.Event stripeEvent) : Task`.

- [ ] **Step 1: Write the failing tests**

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Data;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Stripe;
using Xunit;
using Company = ShiftWork.Api.Models.Company;

namespace ShiftWork.Api.Tests.Billing;

public class StripeWebhookServiceTests : IDisposable
{
    private readonly ShiftWorkContext _ctx;
    private readonly FakeStripeGateway _gw = new();
    private readonly Mock<INotificationService> _notify = new();
    private readonly StripeWebhookService _sut;

    public StripeWebhookServiceTests()
    {
        _ctx = new ShiftWorkContext(new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        _ctx.Companies.Add(new Company { CompanyId = "c1", Name = "Acme", Email = "owner@acme.com", Address = "",
            PhoneNumber = "", TimeZone = "UTC", Plan = "Free", StripeCustomerId = "cus_1" });
        _ctx.SaveChanges();
        var settings = new StripeSettings { SecretKey = "sk", PriceStarter = "price_s", PricePro = "price_p", PriceBusiness = "price_b" };
        _sut = new StripeWebhookService(_ctx, _gw, settings, _notify.Object, NullLogger<StripeWebhookService>.Instance);
    }

    private static Event Evt(string id, string type, IHasObject obj) => new() { Id = id, Type = type, Data = new EventData { Object = obj } };
    private void Sub(string id, string status, string price = "price_p", string customer = "cus_1") =>
        _gw.Subscriptions[id] = new StripeSubscriptionSnapshot(id, customer, status, price, new DateTime(2026, 10, 28, 0, 0, 0, DateTimeKind.Utc));
    private Company C() => _ctx.Companies.AsNoTracking().Single(c => c.CompanyId == "c1");

    [Fact]
    public async Task CheckoutCompleted_LinksAndSyncsFromStripe()
    {
        Sub("sub_1", "active");
        await _sut.ProcessAsync(Evt("evt_1", EventTypes.CheckoutSessionCompleted,
            new Stripe.Checkout.Session { Mode = "subscription", ClientReferenceId = "c1", CustomerId = "cus_1", SubscriptionId = "sub_1" }));
        var c = C();
        Assert.Equal(("sub_1", "active", "Pro"), (c.StripeSubscriptionId, c.SubscriptionStatus, c.Plan));
        Assert.Equal(new DateTime(2026, 10, 28, 0, 0, 0, DateTimeKind.Utc), c.CurrentPeriodEnd);
    }

    [Fact]
    public async Task CheckoutCompleted_WithMismatchedCustomer_IsIgnored()
    {
        Sub("sub_x", "active", customer: "cus_attacker");
        await _sut.ProcessAsync(Evt("evt_1", EventTypes.CheckoutSessionCompleted,
            new Stripe.Checkout.Session { Mode = "subscription", ClientReferenceId = "c1", CustomerId = "cus_attacker", SubscriptionId = "sub_x" }));
        Assert.Null(C().StripeSubscriptionId);
        Assert.Equal("Free", C().Plan);
    }

    [Fact]
    public async Task SubscriptionCreated_BeforeCheckoutCompleted_IsAdoptedByCustomer()
    {
        Sub("sub_1", "active", "price_s");
        await _sut.ProcessAsync(Evt("evt_1", EventTypes.CustomerSubscriptionCreated, new Subscription { Id = "sub_1", CustomerId = "cus_1" }));
        Assert.Equal(("sub_1", "Starter"), (C().StripeSubscriptionId, C().Plan));
    }

    [Fact]
    public async Task DuplicateEvent_IsProcessedOnce()
    {
        Sub("sub_1", "active");
        var e = Evt("evt_dup", EventTypes.CustomerSubscriptionUpdated, new Subscription { Id = "sub_1", CustomerId = "cus_1" });
        await _sut.ProcessAsync(e);
        Sub("sub_1", "canceled");
        await _sut.ProcessAsync(e);
        Assert.Equal("active", C().SubscriptionStatus);
        Assert.Single(_ctx.StripeProcessedEvents);
    }

    [Fact]
    public async Task OutOfOrder_StaleActiveAfterDeleted_StaysFree()
    {
        Sub("sub_1", "canceled");
        await _sut.ProcessAsync(Evt("evt_del", EventTypes.CustomerSubscriptionDeleted, new Subscription { Id = "sub_1", CustomerId = "cus_1", Status = "canceled" }));
        await _sut.ProcessAsync(Evt("evt_old", EventTypes.CustomerSubscriptionUpdated, new Subscription { Id = "sub_1", CustomerId = "cus_1", Status = "active" }));
        Assert.Equal(("canceled", "Free"), (C().SubscriptionStatus, C().Plan));
    }

    [Fact]
    public async Task ForeignSubscription_WhileCurrentIsLive_IsIgnored()
    {
        Sub("sub_1", "active"); Sub("sub_2", "active", "price_b");
        await _sut.ProcessAsync(Evt("e1", EventTypes.CustomerSubscriptionCreated, new Subscription { Id = "sub_1", CustomerId = "cus_1" }));
        await _sut.ProcessAsync(Evt("e2", EventTypes.CustomerSubscriptionCreated, new Subscription { Id = "sub_2", CustomerId = "cus_1" }));
        Assert.Equal(("sub_1", "Pro"), (C().StripeSubscriptionId, C().Plan));
    }

    [Fact]
    public async Task NewSubscription_AfterCanceled_IsAdopted()
    {
        Sub("sub_1", "canceled"); Sub("sub_2", "active", "price_b");
        await _sut.ProcessAsync(Evt("e1", EventTypes.CustomerSubscriptionDeleted, new Subscription { Id = "sub_1", CustomerId = "cus_1" }));
        await _sut.ProcessAsync(Evt("e2", EventTypes.CustomerSubscriptionCreated, new Subscription { Id = "sub_2", CustomerId = "cus_1" }));
        Assert.Equal(("sub_2", "Business"), (C().StripeSubscriptionId, C().Plan));
    }

    [Fact]
    public async Task UnknownPrice_KeepsPlan_ButUpdatesStatus()
    {
        Sub("sub_1", "active", "price_p");
        await _sut.ProcessAsync(Evt("e1", EventTypes.CustomerSubscriptionCreated, new Subscription { Id = "sub_1", CustomerId = "cus_1" }));
        Sub("sub_1", "past_due", "price_mystery");
        await _sut.ProcessAsync(Evt("e2", EventTypes.CustomerSubscriptionUpdated, new Subscription { Id = "sub_1", CustomerId = "cus_1" }));
        Assert.Equal(("past_due", "Pro"), (C().SubscriptionStatus, C().Plan));
    }

    [Fact]
    public async Task HandlerFailure_SavesNothing_SoStripeRetries()
    {
        _gw.FailGetSubscription = () => new StripeException("boom");
        await Assert.ThrowsAsync<StripeException>(() => _sut.ProcessAsync(
            Evt("evt_f", EventTypes.CustomerSubscriptionUpdated, new Subscription { Id = "sub_1", CustomerId = "cus_1" })));
        Assert.Empty(_ctx.StripeProcessedEvents.AsNoTracking());
    }

    [Fact]
    public async Task UnknownCustomer_IsRecordedAndIgnored()
    {
        await _sut.ProcessAsync(Evt("e1", EventTypes.CustomerSubscriptionUpdated, new Subscription { Id = "sub_9", CustomerId = "cus_nobody" }));
        Assert.Single(_ctx.StripeProcessedEvents);
    }

    [Fact]
    public async Task PaymentFailed_EmailsCompany_OncePerEvent()
    {
        var e = Evt("evt_pf", EventTypes.InvoicePaymentFailed, new Invoice { CustomerId = "cus_1" });
        await _sut.ProcessAsync(e);
        await _sut.ProcessAsync(e);
        _notify.Verify(n => n.SendEmailAsync("owner@acme.com", It.IsAny<string>(), It.IsAny<string>()), Times.Once);
    }

    public void Dispose() => _ctx.Dispose();
}
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `dotnet test ShiftWork.Api.Tests --filter "FullyQualifiedName~StripeWebhookServiceTests"`
Expected: compile error.

- [ ] **Step 3: Implement** `Services/StripeWebhookService.cs`

```csharp
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;
using Stripe;
using Company = ShiftWork.Api.Models.Company;

namespace ShiftWork.Api.Services
{
    public interface IStripeWebhookService
    {
        Task ProcessAsync(Event stripeEvent);
    }

    public class StripeWebhookService : IStripeWebhookService
    {
        private static readonly HashSet<string> EndedStatuses = new(StringComparer.OrdinalIgnoreCase) { "canceled", "incomplete_expired" };

        private readonly ShiftWorkContext _context;
        private readonly IStripeGateway _stripe;
        private readonly StripeSettings _settings;
        private readonly INotificationService _notifications;
        private readonly ILogger<StripeWebhookService> _logger;

        public StripeWebhookService(ShiftWorkContext context, IStripeGateway stripe, StripeSettings settings,
            INotificationService notifications, ILogger<StripeWebhookService> logger)
        {
            _context = context; _stripe = stripe; _settings = settings; _notifications = notifications; _logger = logger;
        }

        public async Task ProcessAsync(Event stripeEvent)
        {
            if (await _context.StripeProcessedEvents.AnyAsync(e => e.EventId == stripeEvent.Id))
            {
                _logger.LogInformation("Stripe event {EventId} already processed; skipping.", stripeEvent.Id);
                return;
            }

            _context.StripeProcessedEvents.Add(new StripeProcessedEvent
            {
                EventId = stripeEvent.Id, Type = stripeEvent.Type, ProcessedAt = DateTime.UtcNow
            });

            string? paymentFailedEmail = null;
            switch (stripeEvent.Data.Object)
            {
                case Stripe.Checkout.Session s when stripeEvent.Type == EventTypes.CheckoutSessionCompleted && s.Mode == "subscription":
                    await HandleCheckoutCompletedAsync(s);
                    break;
                case Subscription sub when stripeEvent.Type is EventTypes.CustomerSubscriptionCreated
                                                           or EventTypes.CustomerSubscriptionUpdated
                                                           or EventTypes.CustomerSubscriptionDeleted:
                    await HandleSubscriptionEventAsync(sub);
                    break;
                case Invoice inv when stripeEvent.Type == EventTypes.InvoicePaymentFailed:
                    paymentFailedEmail = (await FindByCustomerAsync(inv.CustomerId))?.Email;
                    break;
                default:
                    _logger.LogInformation("Stripe event {EventType} recorded without action.", stripeEvent.Type);
                    break;
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // A concurrent delivery of the same event won the insert race; its handler already applied the change.
                _logger.LogWarning(ex, "Stripe event {EventId} raced a duplicate delivery; ignoring.", stripeEvent.Id);
                return;
            }

            if (paymentFailedEmail != null)
            {
                await _notifications.SendEmailAsync(paymentFailedEmail, "Loqzen payment failed",
                    "<p>We couldn't process your latest Loqzen payment. Please update your card from <b>Plan &amp; Billing</b> to keep your plan.</p>");
            }
        }

        private async Task HandleCheckoutCompletedAsync(Stripe.Checkout.Session session)
        {
            var company = await _context.Companies.FirstOrDefaultAsync(c => c.CompanyId == session.ClientReferenceId);
            if (company == null || string.IsNullOrWhiteSpace(session.SubscriptionId))
            {
                _logger.LogWarning("Checkout session for unknown company {CompanyId}.", session.ClientReferenceId);
                return;
            }

            // client_reference_id comes from our own server, but the customer must still match so a session can't be replayed onto another tenant.
            if (company.StripeCustomerId != null && company.StripeCustomerId != session.CustomerId)
            {
                _logger.LogWarning("Checkout customer {CustomerId} does not match company {CompanyId}; ignoring.", session.CustomerId, company.CompanyId);
                return;
            }

            company.StripeCustomerId ??= session.CustomerId;
            if (!CanAdopt(company, session.SubscriptionId)) return;
            company.StripeSubscriptionId = session.SubscriptionId;
            await SyncAsync(company);
        }

        private async Task HandleSubscriptionEventAsync(Subscription sub)
        {
            var company = await FindByCustomerAsync(sub.CustomerId);
            if (company == null)
            {
                _logger.LogWarning("Subscription {SubscriptionId} for unknown customer {CustomerId}.", sub.Id, sub.CustomerId);
                return;
            }

            if (!CanAdopt(company, sub.Id)) return;
            company.StripeSubscriptionId = sub.Id;
            await SyncAsync(company);
        }

        private bool CanAdopt(Company company, string subscriptionId)
        {
            if (company.StripeSubscriptionId == null || company.StripeSubscriptionId == subscriptionId) return true;
            if (company.SubscriptionStatus == null || EndedStatuses.Contains(company.SubscriptionStatus)) return true;

            _logger.LogWarning("Ignoring subscription {SubscriptionId}: company {CompanyId} already has live {Current}.",
                subscriptionId, company.CompanyId, company.StripeSubscriptionId);
            return false;
        }

        // Always re-read from Stripe: event payloads can arrive late or out of order, the API is current.
        private async Task SyncAsync(Company company)
        {
            var snap = await _stripe.GetSubscriptionAsync(company.StripeSubscriptionId!);
            if (snap == null)
            {
                _logger.LogWarning("Subscription {SubscriptionId} not found in Stripe.", company.StripeSubscriptionId);
                return;
            }

            company.SubscriptionStatus = snap.Status;
            company.CurrentPeriodEnd = snap.CurrentPeriodEnd;

            if (EndedStatuses.Contains(snap.Status))
            {
                company.Plan = PlanCatalog.Free;
            }
            else if (_settings.TierForPriceId(snap.PriceId) is string tier)
            {
                company.Plan = tier;
            }
            else
            {
                _logger.LogError("Unknown Stripe price {PriceId} on subscription {SubscriptionId}; plan unchanged.", snap.PriceId, snap.Id);
            }
        }

        private Task<Company?> FindByCustomerAsync(string? customerId) =>
            string.IsNullOrWhiteSpace(customerId)
                ? Task.FromResult<Company?>(null)
                : _context.Companies.FirstOrDefaultAsync(c => c.StripeCustomerId == customerId);
    }
}
```

The email goes to `Company.Email`, the address the company registered with. The spec said "admin users"; the company's registered address is a simpler recipient that reaches the same people, so use it here.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `dotnet test ShiftWork.Api.Tests --filter "FullyQualifiedName~StripeWebhookServiceTests"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Api/Services/StripeWebhookService.cs ShiftWork.Api.Tests/Billing/StripeWebhookServiceTests.cs
git commit -m "feat(billing): idempotent webhook service that re-syncs subscriptions from Stripe"
```

---

### Task 9: Webhook endpoint, wiring and config

**Files:**
- Create: `ShiftWork.Api/Controllers/StripeWebhookController.cs`
- Modify: `Program.cs` (`AddScoped<IStripeWebhookService, StripeWebhookService>()`), `ShiftWork.Api/.env.example`, `docker-compose.yml`
- Test: `ShiftWork.Api.Tests/Billing/StripeWebhookControllerTests.cs`

**Interfaces:**
- Consumes: `IStripeWebhookService` (Task 8), `StripeSettings.WebhookSecret` (Task 5).
- Produces: `POST /api/stripe/webhook`.

- [ ] **Step 1: Write the failing tests**

```csharp
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Services;
using Stripe;
using Xunit;

namespace ShiftWork.Api.Tests.Billing;

public class StripeWebhookControllerTests
{
    private const string Secret = "whsec_test";
    private const string Payload =
        "{\"id\":\"evt_1\",\"object\":\"event\",\"api_version\":\"2020-08-27\",\"type\":\"customer.created\",\"data\":{\"object\":{\"id\":\"cus_1\",\"object\":\"customer\"}}}";

    private readonly Mock<IStripeWebhookService> _svc = new();

    private StripeWebhookController Sut(string? secret, string signature)
    {
        var http = new DefaultHttpContext();
        http.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(Payload));
        http.Request.Headers["Stripe-Signature"] = signature;
        return new StripeWebhookController(_svc.Object, new StripeSettings { WebhookSecret = secret }, NullLogger<StripeWebhookController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = http }
        };
    }

    private static string Sign(string secret)
    {
        var t = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        using var h = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var sig = Convert.ToHexString(h.ComputeHash(Encoding.UTF8.GetBytes($"{t}.{Payload}"))).ToLowerInvariant();
        return $"t={t},v1={sig}";
    }

    [Fact]
    public async Task ValidSignature_Dispatches_Returns200()
    {
        var result = await Sut(Secret, Sign(Secret)).Receive();
        Assert.IsType<OkResult>(result);
        _svc.Verify(s => s.ProcessAsync(It.Is<Event>(e => e.Id == "evt_1")), Times.Once);
    }

    [Fact]
    public async Task BadSignature_Returns400_AndDoesNotDispatch()
    {
        var result = await Sut(Secret, Sign("whsec_wrong")).Receive();
        Assert.IsType<BadRequestObjectResult>(result);
        _svc.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task MissingSecret_Returns500()
    {
        var result = await Sut(null, Sign(Secret)).Receive();
        Assert.Equal(500, Assert.IsType<ObjectResult>(result).StatusCode);
    }
}
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `dotnet test ShiftWork.Api.Tests --filter "FullyQualifiedName~StripeWebhookControllerTests"`
Expected: compile error.

- [ ] **Step 3: Implement** `Controllers/StripeWebhookController.cs`

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Services;
using Stripe;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/stripe/webhook")]
    public class StripeWebhookController : ControllerBase
    {
        private readonly IStripeWebhookService _webhooks;
        private readonly StripeSettings _settings;
        private readonly ILogger<StripeWebhookController> _logger;

        public StripeWebhookController(IStripeWebhookService webhooks, StripeSettings settings, ILogger<StripeWebhookController> logger)
        {
            _webhooks = webhooks; _settings = settings; _logger = logger;
        }

        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> Receive()
        {
            if (string.IsNullOrWhiteSpace(_settings.WebhookSecret))
            {
                _logger.LogError("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured.");
                return StatusCode(500, "Webhook is not configured.");
            }

            var payload = await new StreamReader(Request.Body).ReadToEndAsync();
            Event stripeEvent;
            try
            {
                // Version mismatch must not reject events: the dashboard endpoint version and Stripe.net's pin drift independently.
                stripeEvent = EventUtility.ConstructEvent(payload, Request.Headers["Stripe-Signature"].ToString(),
                    _settings.WebhookSecret, throwOnApiVersionMismatch: false);
            }
            catch (StripeException ex)
            {
                _logger.LogWarning(ex, "Stripe webhook signature verification failed.");
                return BadRequest("Invalid Stripe webhook signature.");
            }

            await _webhooks.ProcessAsync(stripeEvent);
            return Ok();
        }
    }
}
```

Register the service in `Program.cs`. In `ShiftWork.Api/.env.example`, add:

```
# Stripe billing (test keys from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=
APP_BASE_URL=http://localhost:4200
```

In `docker-compose.yml`, under the API service's `environment:`, add `STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}` and the same form for the other 5 variables.

- [ ] **Step 4: Run the full suite and build**

Run: `dotnet build ShiftWork.Api; dotnet test ShiftWork.Api.Tests`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Api ShiftWork.Api.Tests docker-compose.yml
git commit -m "feat(billing): signed Stripe webhook endpoint and billing env config"
```

---

### Task 10: Angular BillingService and model

**Files:**
- Create:
  - `ShiftWork.Angular/src/app/core/models/billing.model.ts`
  - `ShiftWork.Angular/src/app/core/services/billing.service.ts`
  - `ShiftWork.Angular/src/app/core/services/billing.service.spec.ts`
- Modify: `ShiftWork.Angular/src/app/core/services/registration.service.ts` (delete `PlanUpgradeRequest`, `PlanUpgradeResponse` and `upgradePlan`)

**Interfaces:**
- Produces:
  - `type PaidTier = 'Starter' | 'Pro' | 'Business'`
  - `interface BillingSummary` (mirrors `BillingSummaryDto` in camelCase)
  - `BillingService` with:
    - `getSummary(companyId): Observable<BillingSummary>`
    - `refresh(companyId): void`
    - `summary$: Observable<BillingSummary | null>`
    - `startCheckout(companyId, tier): Observable<string>` (the URL)
    - `openPortal(companyId): Observable<string>` (the URL)
    - `redirect(url): void`

- [ ] **Step 1: Write the failing spec**

```ts
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BillingService } from './billing.service';
import { environment } from '../../../environments/environment';

describe('BillingService', () => {
  let service: BillingService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/companies/co-1/billing`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(BillingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('never doubles the /api prefix', () => {
    service.getSummary('co-1').subscribe();
    const req = http.expectOne(base);
    expect(req.request.url).not.toContain('/api/api/');
    req.flush({});
  });

  it('refresh() publishes the summary on summary$', () => {
    let latest: any = null;
    service.summary$.subscribe(s => (latest = s));
    service.refresh('co-1');
    http.expectOne(base).flush({ tier: 'Pro', isTrial: true });
    expect(latest.tier).toBe('Pro');
  });

  it('startCheckout posts the tier and returns the url', () => {
    let url = '';
    service.startCheckout('co-1', 'Starter').subscribe(u => (url = u));
    const req = http.expectOne(`${base}/checkout-session`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tier: 'Starter' });
    req.flush({ url: 'https://checkout.stripe.com/x' });
    expect(url).toBe('https://checkout.stripe.com/x');
  });

  it('openPortal posts and returns the url', () => {
    let url = '';
    service.openPortal('co-1').subscribe(u => (url = u));
    http.expectOne(`${base}/portal-session`).flush({ url: 'https://billing.stripe.com/p' });
    expect(url).toBe('https://billing.stripe.com/p');
  });
});
```

- [ ] **Step 2: Run the spec and confirm it fails**

Run (in `ShiftWork.Angular`): `npx ng test --watch=false --browsers=ChromeHeadless --include src/app/core/services/billing.service.spec.ts`
Expected: compile error, because `./billing.service` does not exist.

- [ ] **Step 3: Implement.** `core/models/billing.model.ts`:

```ts
export type PaidTier = 'Starter' | 'Pro' | 'Business';

export interface BillingSummary {
  tier: 'Free' | PaidTier;
  isTrial: boolean;
  trialDaysRemaining: number;
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
  hasSubscription: boolean;
  currentPeriodEnd: string | null;
  employeeCount: number;
  employeeCap: number | null;
  canManageBilling: boolean;
}
```

`core/services/billing.service.ts`:

```ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { BillingSummary, PaidTier } from '../models/billing.model';

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly summarySubject = new BehaviorSubject<BillingSummary | null>(null);
  readonly summary$ = this.summarySubject.asObservable();

  constructor(private http: HttpClient) {}

  private base(companyId: string): string {
    return `${environment.apiUrl}/companies/${companyId}/billing`;
  }

  getSummary(companyId: string): Observable<BillingSummary> {
    return this.http.get<BillingSummary>(this.base(companyId));
  }

  refresh(companyId: string): void {
    this.getSummary(companyId).subscribe({
      next: s => this.summarySubject.next(s),
      error: () => this.summarySubject.next(null)
    });
  }

  startCheckout(companyId: string, tier: PaidTier): Observable<string> {
    return this.http.post<{ url: string }>(`${this.base(companyId)}/checkout-session`, { tier }).pipe(map(r => r.url));
  }

  openPortal(companyId: string): Observable<string> {
    return this.http.post<{ url: string }>(`${this.base(companyId)}/portal-session`, {}).pipe(map(r => r.url));
  }

  redirect(url: string): void {
    window.location.assign(url);
  }
}
```

Then delete `PlanUpgradeRequest`, `PlanUpgradeResponse` and `upgradePlan` from `registration.service.ts`. The upgrade component that used them is replaced in Task 11.

- [ ] **Step 4: Run the spec and confirm it passes**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include src/app/core/services/billing.service.spec.ts`
Expected: 4 specs pass.

- [ ] **Step 5: Commit**

```bash
git add ShiftWork.Angular/src/app/core
git commit -m "feat(billing-web): BillingService with summary stream, checkout and portal"
```

---

### Task 11: Plan & Billing page, route, nav, and upgrade redirect

**Files:**
- Create: `ShiftWork.Angular/src/app/features/dashboard/billing/billing.component.{ts,html,css,spec.ts}`
- Modify:
  - `ShiftWork.Angular/src/app/features/dashboard/dashboard.module.ts` (add the route `{ path: 'billing', loadComponent: () => import('./billing/billing.component').then(m => m.BillingComponent) }`)
  - `ShiftWork.Angular/src/app/features/dashboard/dashboard.component.html` (nav link in More Options, before Settings)
  - `ShiftWork.Angular/src/app/features/upgrade/upgrade-routing.module.ts` (redirect)
- Delete: `ShiftWork.Angular/src/app/features/upgrade/upgrade.component.{ts,html}` (and remove the component from `upgrade.module.ts`)

**Interfaces:**
- Consumes: `BillingService`, `BillingSummary`, `PaidTier` (Task 10); `Store` + `selectActiveCompany` (existing).
- Produces: the route `/dashboard/billing`, which handles the `?checkout=success|cancel` query params.

- [ ] **Step 1: Write the failing spec**

```ts
import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, BehaviorSubject } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { BillingComponent } from './billing.component';
import { BillingService } from 'src/app/core/services/billing.service';
import { BillingSummary } from 'src/app/core/models/billing.model';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';

const trial: BillingSummary = {
  tier: 'Pro', isTrial: true, trialDaysRemaining: 9, trialEndsAt: null, subscriptionStatus: null,
  hasSubscription: false, currentPeriodEnd: null, employeeCount: 3, employeeCap: 100, canManageBilling: true
};

describe('BillingComponent', () => {
  let fixture: ComponentFixture<BillingComponent>;
  let billing: jasmine.SpyObj<BillingService>;
  let query: BehaviorSubject<any>;

  function setup(summary: BillingSummary, params: Record<string, string> = {}) {
    query = new BehaviorSubject(convertToParamMap(params));
    billing = jasmine.createSpyObj('BillingService', ['getSummary', 'refresh', 'startCheckout', 'openPortal', 'redirect']);
    billing.getSummary.and.returnValue(of(summary));
    billing.startCheckout.and.returnValue(of('https://checkout.stripe.com/x'));
    billing.openPortal.and.returnValue(of('https://billing.stripe.com/p'));
    TestBed.configureTestingModule({
      imports: [BillingComponent],
      providers: [
        { provide: BillingService, useValue: billing },
        { provide: ActivatedRoute, useValue: { queryParamMap: query } },
        { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['success', 'info', 'error']) },
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'co-1' } }] })
      ]
    });
    fixture = TestBed.createComponent(BillingComponent);
    fixture.detectChanges();
  }

  it('shows trial countdown and usage', () => {
    setup(trial);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('9');
    expect(text).toContain('3 / 100');
  });

  it('Choose plan starts Checkout and redirects', () => {
    setup(trial);
    fixture.componentInstance.choose('Starter');
    expect(billing.startCheckout).toHaveBeenCalledWith('co-1', 'Starter');
    expect(billing.redirect).toHaveBeenCalledWith('https://checkout.stripe.com/x');
  });

  it('subscribed company sees Manage billing instead of tier buttons', () => {
    setup({ ...trial, tier: 'Starter', isTrial: false, hasSubscription: true, subscriptionStatus: 'active' });
    expect(fixture.nativeElement.querySelector('[data-test=manage-billing]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-test=choose-Starter]')).toBeNull();
    fixture.componentInstance.manage();
    expect(billing.redirect).toHaveBeenCalledWith('https://billing.stripe.com/p');
  });

  it('hides billing actions without permission', () => {
    setup({ ...trial, canManageBilling: false });
    expect(fixture.nativeElement.querySelector('[data-test=choose-Pro]')).toBeNull();
  });

  it('polls after checkout=success until the subscription is active', fakeAsync(() => {
    setup(trial, { checkout: 'success' });
    billing.getSummary.and.returnValue(of({ ...trial, tier: 'Pro', isTrial: false, hasSubscription: true, subscriptionStatus: 'active' }));
    tick(2000);
    expect(fixture.componentInstance.summary?.subscriptionStatus).toBe('active');
    expect(fixture.componentInstance.awaitingPayment).toBeFalse();
    discardPeriodicTasks();
  }));
});
```

- [ ] **Step 2: Run the spec and confirm it fails**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include src/app/features/dashboard/billing/billing.component.spec.ts`
Expected: compile error, because the component does not exist.

- [ ] **Step 3: Implement** `billing.component.ts`

```ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subscription, filter, interval, switchMap, take, takeWhile } from 'rxjs';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { BillingService } from 'src/app/core/services/billing.service';
import { BillingSummary, PaidTier } from 'src/app/core/models/billing.model';

interface TierCard { tier: PaidTier; cap: string; blurb: string; }

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule],
  templateUrl: './billing.component.html',
  styleUrls: ['./billing.component.css']
})
export class BillingComponent implements OnInit, OnDestroy {
  summary: BillingSummary | null = null;
  companyId = '';
  busy = false;
  awaitingPayment = false;
  readonly tiers: TierCard[] = [
    { tier: 'Starter', cap: '25', blurb: $localize`:@@billing.tier_starter_blurb:Small crews getting organized` },
    { tier: 'Pro', cap: '100', blurb: $localize`:@@billing.tier_pro_blurb:Analytics, multi-location and exports` },
    { tier: 'Business', cap: '∞', blurb: $localize`:@@billing.tier_business_blurb:Unlimited employees` }
  ];
  private subs = new Subscription();

  constructor(
    private billing: BillingService,
    private route: ActivatedRoute,
    private store: Store<AppState>,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.subs.add(this.store.select(selectActiveCompany).pipe(filter((c: any) => !!c?.companyId), take(1)).subscribe((c: any) => {
      this.companyId = c.companyId;
      this.load();
      this.subs.add(this.route.queryParamMap.pipe(take(1)).subscribe(p => {
        if (p.get('checkout') === 'success') this.waitForActivation();
        if (p.get('checkout') === 'cancel') this.toastr.info($localize`:@@billing.checkout_canceled:Checkout canceled. No charge was made.`);
      }));
    }));
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  get usagePercent(): number {
    const s = this.summary;
    return s?.employeeCap ? Math.min(100, (s.employeeCount / s.employeeCap) * 100) : 0;
  }

  choose(tier: PaidTier): void {
    this.busy = true;
    this.billing.startCheckout(this.companyId, tier).subscribe({
      next: url => this.billing.redirect(url),
      error: err => this.fail(err)
    });
  }

  manage(): void {
    this.busy = true;
    this.billing.openPortal(this.companyId).subscribe({
      next: url => this.billing.redirect(url),
      error: err => this.fail(err)
    });
  }

  private load(): void {
    this.billing.getSummary(this.companyId).subscribe({
      next: s => { this.summary = s; this.billing.refresh(this.companyId); },
      error: err => this.fail(err)
    });
  }

  // Stripe confirms payment via webhook a moment after redirecting back, so poll briefly instead of showing a stale plan.
  private waitForActivation(): void {
    this.awaitingPayment = true;
    this.toastr.success($localize`:@@billing.payment_received:Payment received. Activating your plan…`);
    this.subs.add(interval(2000).pipe(
      take(10),
      switchMap(() => this.billing.getSummary(this.companyId)),
      takeWhile(s => s.subscriptionStatus !== 'active', true)
    ).subscribe({
      next: s => { this.summary = s; if (s.subscriptionStatus === 'active') { this.awaitingPayment = false; this.billing.refresh(this.companyId); } },
      complete: () => (this.awaitingPayment = false)
    }));
  }

  private fail(err: any): void {
    this.busy = false;
    this.toastr.error(err?.error?.message ?? $localize`:@@billing.error_generic:Billing is unavailable right now. Please try again.`);
  }
}
```

`billing.component.html`:

```html
<section class="billing" *ngIf="summary as s">
  <h1 i18n="@@billing.title">Plan &amp; Billing</h1>

  <mat-card class="current">
    <mat-card-content>
      <div class="current-plan">
        <mat-icon>workspace_premium</mat-icon>
        <div>
          <div class="tier">{{ s.tier }}<span *ngIf="s.isTrial" class="trial-tag" i18n="@@billing.trial_tag"> trial</span></div>
          <div class="sub" *ngIf="s.isTrial" i18n="@@billing.trial_days_left">{{ s.trialDaysRemaining }} days left in your free trial</div>
          <div class="sub" *ngIf="s.hasSubscription && s.currentPeriodEnd" i18n="@@billing.renews_on">Renews on {{ s.currentPeriodEnd | date:'mediumDate' }}</div>
          <div class="sub warn" *ngIf="s.subscriptionStatus === 'past_due'" i18n="@@billing.past_due">Payment failed. Update your card to keep your plan.</div>
          <div class="sub" *ngIf="awaitingPayment" i18n="@@billing.activating">Activating your plan…</div>
        </div>
      </div>
      <div class="usage">
        <span i18n="@@billing.employees_label">Active employees</span>
        <strong>{{ s.employeeCount }} / {{ s.employeeCap ?? '∞' }}</strong>
        <mat-progress-bar *ngIf="s.employeeCap" mode="determinate" [value]="usagePercent"></mat-progress-bar>
      </div>
    </mat-card-content>
  </mat-card>

  <ng-container *ngIf="s.canManageBilling">
    <button *ngIf="s.hasSubscription" data-test="manage-billing" mat-flat-button color="primary" class="cta"
            [disabled]="busy" (click)="manage()" i18n="@@billing.manage">Manage billing</button>

    <div class="tiers" *ngIf="!s.hasSubscription">
      <mat-card *ngFor="let t of tiers" class="tier-card" [class.recommended]="t.tier === 'Pro'">
        <mat-card-title>{{ t.tier }}</mat-card-title>
        <mat-card-content>
          <p class="cap"><span i18n="@@billing.up_to">Up to</span> {{ t.cap }} <span i18n="@@billing.employees">employees</span></p>
          <p>{{ t.blurb }}</p>
        </mat-card-content>
        <mat-card-actions>
          <button mat-flat-button color="primary" [attr.data-test]="'choose-' + t.tier" [disabled]="busy"
                  (click)="choose(t.tier)" i18n="@@billing.choose_plan">Choose plan</button>
        </mat-card-actions>
      </mat-card>
    </div>
  </ng-container>
</section>
```

`billing.component.css`:

```css
.billing { max-width: 960px; margin: 0 auto; padding: 16px; }
.current-plan { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
.tier { font-size: 1.5rem; font-weight: 600; }
.trial-tag { font-size: 0.9rem; font-weight: 400; margin-left: 4px; }
.sub { color: rgba(0, 0, 0, 0.6); }
.warn { color: #b3261e; }
.usage { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }
.usage mat-progress-bar { grid-column: 1 / -1; }
.tiers { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 16px; }
.tier-card.recommended { outline: 2px solid currentColor; }
.cta, .tier-card button { min-height: 48px; min-width: 48px; }
.cta { margin-top: 16px; }
```

In `dashboard.module.ts`, add the `billing` route next to `company-settings`. In `dashboard.component.html`, inside the More Options `expansion-content`, before the Settings link, add:

```html
            <a mat-list-item routerLink="/dashboard/billing" routerLinkActive="active-link" class="nav-item sub-item">
              <div class="nav-item-content">
                <mat-icon matListItemIcon>credit_card</mat-icon>
                <span matListItemTitle i18n="@@nav.web_billing">Plan &amp; Billing</span>
              </div>
            </a>
```

Change `upgrade-routing.module.ts` to `const routes: Routes = [{ path: '', redirectTo: '/dashboard/billing', pathMatch: 'full' }];`. Then delete `upgrade.component.ts` and `upgrade.component.html`, and remove `UpgradeComponent` from `upgrade.module.ts`.

- [ ] **Step 4: Run the spec and confirm it passes**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include src/app/features/dashboard/billing/billing.component.spec.ts`
Expected: 5 specs pass.

- [ ] **Step 5: Commit**

```bash
git add -A ShiftWork.Angular/src/app/features
git commit -m "feat(billing-web): Plan & Billing page with Checkout, Portal and post-checkout polling"
```

---

### Task 12: Dashboard banner and plan-limit prompt on people

**Files:**
- Create: `ShiftWork.Angular/src/app/core/errors/plan-limit.error.ts`
- Modify:
  - `ShiftWork.Angular/src/app/core/services/people.service.ts` (keep the 409 details)
  - `ShiftWork.Angular/src/app/features/dashboard/people/people.component.ts` (error handlers)
  - `ShiftWork.Angular/src/app/features/dashboard/dashboard.component.{ts,html,css}` (banner)
- Test:
  - `ShiftWork.Angular/src/app/core/services/people.service.spec.ts` (create, or extend if it exists)
  - `ShiftWork.Angular/src/app/core/errors/plan-limit.error.spec.ts`

**Interfaces:**
- Consumes: `BillingService.summary$` / `refresh` (Task 10).
- Produces:
  - `class PlanLimitError extends Error { tier: string; cap: number; count: number }`
  - `PlanLimitError.from(err: HttpErrorResponse): PlanLimitError | null`
  - `DashboardComponent.billingBanner$: Observable<'trial' | 'limit' | null>`

- [ ] **Step 1: Write the failing specs.** `core/errors/plan-limit.error.spec.ts`:

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { PlanLimitError } from './plan-limit.error';

describe('PlanLimitError', () => {
  it('recognizes a 409 plan_limit_exceeded body', () => {
    const e = PlanLimitError.from(new HttpErrorResponse({ status: 409,
      error: { code: 'plan_limit_exceeded', tier: 'Free', cap: 5, count: 5, message: 'Your Free plan allows 5 active employees.' } }));
    expect(e).toBeTruthy();
    expect(e!.cap).toBe(5);
    expect(e!.message).toContain('5 active employees');
  });

  it('ignores other conflicts', () => {
    expect(PlanLimitError.from(new HttpErrorResponse({ status: 409, error: { code: 'subscription_exists' } }))).toBeNull();
    expect(PlanLimitError.from(new HttpErrorResponse({ status: 500 }))).toBeNull();
  });
});
```

In `people.service.spec.ts`, add (if the file doesn't exist, create it with the same TestBed setup as `credential.service.spec.ts`):

```ts
  it('createPerson surfaces PlanLimitError on 409 plan_limit_exceeded', () => {
    let caught: any;
    service.createPerson('co-1', { name: 'x' } as any).subscribe({ error: e => (caught = e) });
    http.expectOne(`${environment.apiUrl}/companies/co-1/People`).flush(
      { code: 'plan_limit_exceeded', tier: 'Free', cap: 5, count: 5, message: 'limit' },
      { status: 409, statusText: 'Conflict' });
    expect(caught instanceof PlanLimitError).toBeTrue();
  });
```

- [ ] **Step 2: Run the specs and confirm they fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include src/app/core/errors/plan-limit.error.spec.ts --include src/app/core/services/people.service.spec.ts`
Expected: compile error, because `PlanLimitError` does not exist.

- [ ] **Step 3: Implement.** `core/errors/plan-limit.error.ts`:

```ts
import { HttpErrorResponse } from '@angular/common/http';

export class PlanLimitError extends Error {
  constructor(message: string, public tier: string, public cap: number, public count: number) {
    super(message);
    this.name = 'PlanLimitError';
  }

  static from(err: HttpErrorResponse): PlanLimitError | null {
    const b = err?.error;
    if (err?.status !== 409 || b?.code !== 'plan_limit_exceeded') return null;
    return new PlanLimitError(b.message, b.tier, b.cap, b.count);
  }
}
```

In `people.service.ts`, make `handleError` an arrow property and add the check at the top:

```ts
  private handleError = (error: HttpErrorResponse) => {
    const planLimit = PlanLimitError.from(error);
    if (planLimit) return throwError(() => planLimit);
    // ...existing body unchanged...
  };
```

In `people.component.ts`, inject `Router` (and add its import if missing). In `savePerson()`, give the `createPerson` subscription an error handler, and route both error handlers through one helper:

```ts
      this.peopleService.createPerson(newPerson.companyId, newPerson).subscribe({
        next: person => {
          this.people.push(person);
          this.cancelEdit();
          this.toastr.success('Person created successfully');
        },
        error: err => this.showSaveError(err, 'Failed to create person.')
      });
```

Replace the update handler `() => this.toastr.error('Failed to update person.')` with `err => this.showSaveError(err, 'Failed to update person.')`. Then add the helper:

```ts
  private showSaveError(err: unknown, fallback: string): void {
    if (err instanceof PlanLimitError) {
      this.toastr.warning(err.message, $localize`:@@billing.limit_title:Employee limit reached`, { timeOut: 8000, tapToDismiss: true })
        .onTap.subscribe(() => this.router.navigate(['/dashboard/billing']));
      return;
    }
    this.toastr.error(fallback);
  }
```

In `dashboard.component.ts`, inject `private billingService: BillingService` (add it as the last constructor parameter). Declare the field `billingBanner$: Observable<'trial' | 'limit' | null>;`, and in the constructor add:

```ts
    this.subscriptions.add(this.activeCompany$.pipe(filter((c: any) => !!c?.companyId))
      .subscribe((c: any) => this.billingService.refresh(c.companyId)));
    this.billingBanner$ = this.billingService.summary$.pipe(map(s => {
      if (!s) return null;
      if (s.employeeCap !== null && s.employeeCount >= s.employeeCap) return 'limit';
      if (s.isTrial && s.trialDaysRemaining <= 3) return 'trial';
      return null;
    }));
```

If `DashboardComponent` has no `subscriptions` bag, add `private subscriptions = new Subscription();` and call `this.subscriptions.unsubscribe()` in `ngOnDestroy`. In `dashboard.component.html`, directly above the main `<router-outlet>`, add:

```html
      <div class="billing-banner" *ngIf="billingBanner$ | async as banner" role="status">
        <mat-icon>{{ banner === 'limit' ? 'group_off' : 'schedule' }}</mat-icon>
        <span *ngIf="banner === 'trial'" i18n="@@billing.banner_trial">Your free trial ends soon. Choose a plan to keep Pro features.</span>
        <span *ngIf="banner === 'limit'" i18n="@@billing.banner_limit">You've reached your plan's employee limit.</span>
        <a mat-flat-button color="primary" routerLink="/dashboard/billing" i18n="@@billing.banner_cta">See plans</a>
      </div>
```

In `dashboard.component.css`, add:

```css
.billing-banner { display: flex; align-items: center; gap: 12px; padding: 8px 16px; margin: 8px 16px; border-radius: 8px; background: #fff4e5; }
.billing-banner a { margin-left: auto; min-height: 48px; }
```

- [ ] **Step 4: Run the full Angular suite and a prod build**

Run: `npx ng test --watch=false --browsers=ChromeHeadless; npx ng build --configuration production`
Expected: all specs pass (the existing 125 plus the new ones), and the prod build succeeds. If the dashboard spec fails with a missing provider, add `{ provide: BillingService, useValue: { summary$: of(null), refresh: () => {} } }` to its providers.

- [ ] **Step 5: Commit**

```bash
git add -A ShiftWork.Angular/src
git commit -m "feat(billing-web): trial/limit banner and upgrade prompt on plan-limit 409"
```

---

### Task 13: Runbook, full verification and branch review

**Files:**
- Create: `Docs/STRIPE_BILLING_RUNBOOK.md`
- Modify: `Docs/superpowers/specs/2026-09-28-stripe-billing-design.md` (note that the migration resets sample data and that the payment-failed email goes to `Company.Email`)

- [ ] **Step 1: Write the runbook.** Sections:
  1. **Stripe dashboard setup:**
     - Products Starter/Pro/Business with monthly prices → copy them into `STRIPE_PRICE_*`.
     - Customer Portal: allow switching between the 3 prices, cancel at period end, update payment method.
     - Webhook endpoint `https://<api>/api/stripe/webhook` with the events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` and `invoice.payment_failed`.
     - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
  2. **Env vars table** (the 6 variables).
  3. **Local test with the Stripe CLI:**
     - `stripe listen --forward-to http://localhost:5182/api/stripe/webhook`
     - Subscribe with card `4242 4242 4242 4242`.
     - Change the tier in the Portal.
     - Cancel.
     - `stripe events resend <old evt id>`, then confirm the plan does not change.
  4. **Resync a company manually:** trigger `stripe subscriptions update <sub_id> --metadata[resync]=<timestamp>`, which emits `customer.subscription.updated` and makes the webhook re-read the subscription.
  5. **Rollback:**
     - Revert the merge commit.
     - `dotnet ef database update AddCredentials`. This drops the new columns and table; the data is sample data only.

- [ ] **Step 2: Full verification**

Run:

```
dotnet test ShiftWork.Api.Tests
cd ShiftWork.Angular; npx ng test --watch=false --browsers=ChromeHeadless; npx ng build --configuration production
cd ../ShiftWork.Mobile; npm test -- --ci
cd ../ShiftWork.Kiosk; npm test -- --ci
```

Expected: every suite passes (API ≥ 138 + new, Angular ≥ 125 + new, Mobile 66, Kiosk 12) and the prod build succeeds.

- [ ] **Step 3: Commit**

```bash
git add Docs
git commit -m "docs(billing): Stripe billing runbook and spec notes"
```

- [ ] **Step 4: Whole-branch review.** Dispatch a fresh code reviewer (superpowers:requesting-code-review) on `git diff develop...feature/stripe-billing-v2`. Fix any Critical or Important findings, re-run Step 2, then use superpowers:finishing-a-development-branch.
