using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Plan;

/// <summary>
/// Groups tests that mutate the process-global STRIPE_SECRET_KEY / STRIPE_PRICE_PRO env vars
/// so xUnit never runs them concurrently against each other (xUnit parallelizes across
/// collections by default, and these vars aren't thread-local).
/// </summary>
[CollectionDefinition("StripeEnvVars", DisableParallelization = true)]
public class StripeEnvVarsCollection { }

/// <summary>
/// Unit tests for PlanService.
/// Focuses on feature-gate logic and plan upgrade/query operations.
/// </summary>
[Collection("StripeEnvVars")]
public class PlanServiceTests : IDisposable
{
    private readonly ShiftWorkContext _context;
    private readonly Mock<IStripeGateway> _stripeGatewayMock;
    private readonly PlanService _svc;

    public PlanServiceTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ShiftWorkContext(options);
        _stripeGatewayMock = new Mock<IStripeGateway>();
        _svc = new PlanService(_context, NullLogger<PlanService>.Instance, _stripeGatewayMock.Object);

        // Tests are responsible for setting/clearing these; start from a known-clean slate
        // since these env vars are process-global and PlanService reads them directly.
        Environment.SetEnvironmentVariable("STRIPE_SECRET_KEY", null);
        Environment.SetEnvironmentVariable("STRIPE_PRICE_PRO", null);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<string> CreateCompanyWithPlanAsync(string plan)
    {
        var companyId = Guid.NewGuid().ToString();
        _context.Companies.Add(new Company
        {
            CompanyId = companyId,
            Name = $"{plan} Corp",
            Email = $"{companyId}@test.com",
            PhoneNumber = string.Empty,
            Address = string.Empty,
            TimeZone = "UTC",
            Plan = plan,
            OnboardingStatus = "Pending"
        });
        await _context.SaveChangesAsync();
        return companyId;
    }

    // ── IsFeatureEnabledAsync — sandbox.delete ────────────────────────────────

    [Fact]
    public async Task IsFeatureEnabled_SandboxDelete_ReturnsFalseForFreePlan()
    {
        var companyId = await CreateCompanyWithPlanAsync("Free");
        var result = await _svc.IsFeatureEnabledAsync(companyId, "sandbox.delete");
        Assert.False(result);
    }

    [Fact]
    public async Task IsFeatureEnabled_SandboxDelete_ReturnsTrueForProPlan()
    {
        var companyId = await CreateCompanyWithPlanAsync("Pro");
        var result = await _svc.IsFeatureEnabledAsync(companyId, "sandbox.delete");
        Assert.True(result);
    }

    [Fact]
    public async Task IsFeatureEnabled_SandboxDelete_ReturnsTrueForTrialPlan()
    {
        var companyId = await CreateCompanyWithPlanAsync("Trial");
        var result = await _svc.IsFeatureEnabledAsync(companyId, "sandbox.delete");
        Assert.True(result);
    }

    // ── IsFeatureEnabledAsync — sandbox.hide ─────────────────────────────────

    [Theory]
    [InlineData("Free")]
    [InlineData("Trial")]
    [InlineData("Pro")]
    public async Task IsFeatureEnabled_SandboxHide_ReturnsTrueForAllPlans(string plan)
    {
        var companyId = await CreateCompanyWithPlanAsync(plan);
        var result = await _svc.IsFeatureEnabledAsync(companyId, "sandbox.hide");
        Assert.True(result);
    }

    // ── IsFeatureEnabledAsync — sandbox.reset ────────────────────────────────

    [Theory]
    [InlineData("Free")]
    [InlineData("Trial")]
    [InlineData("Pro")]
    public async Task IsFeatureEnabled_SandboxReset_ReturnsTrueForAllPlans(string plan)
    {
        var companyId = await CreateCompanyWithPlanAsync(plan);
        var result = await _svc.IsFeatureEnabledAsync(companyId, "sandbox.reset");
        Assert.True(result);
    }

    // ── IsFeatureEnabledAsync — unknown feature ───────────────────────────────

    [Theory]
    [InlineData("Free")]
    [InlineData("Pro")]
    public async Task IsFeatureEnabled_UnknownFeatureKey_ReturnsFalse(string plan)
    {
        var companyId = await CreateCompanyWithPlanAsync(plan);
        var result = await _svc.IsFeatureEnabledAsync(companyId, "nonexistent.feature");
        Assert.False(result);
    }

    // ── IsFeatureEnabledAsync — missing company ───────────────────────────────

    [Fact]
    public async Task IsFeatureEnabled_MissingCompany_ReturnsFalse()
    {
        // company doesn't exist → GetCurrentPlanAsync returns "Free" → "sandbox.delete" is false for Free
        var result = await _svc.IsFeatureEnabledAsync("non-existent-id", "sandbox.delete");
        Assert.False(result);
    }

    // ── GetCurrentPlanAsync ───────────────────────────────────────────────────

    [Theory]
    [InlineData("Free")]
    [InlineData("Trial")]
    [InlineData("Pro")]
    public async Task GetCurrentPlan_ReturnsExpectedPlan(string plan)
    {
        var companyId = await CreateCompanyWithPlanAsync(plan);
        var result = await _svc.GetCurrentPlanAsync(companyId);
        Assert.Equal(plan, result);
    }

    [Fact]
    public async Task GetCurrentPlan_MissingCompany_ReturnsFree()
    {
        var result = await _svc.GetCurrentPlanAsync("non-existent-id");
        Assert.Equal("Free", result);
    }

    // ── UpgradePlanAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task UpgradePlan_WithoutStripeKey_UpdatesPlanDirectlyWithoutCallingStripe()
    {
        // When STRIPE_SECRET_KEY is absent the service should fall back to
        // updating the Plan column directly without calling Stripe.
        var companyId = await CreateCompanyWithPlanAsync("Free");

        var result = await _svc.UpgradePlanAsync(companyId, "pm_test_mock", "Pro");

        Assert.True(result);
        var company = await _context.Companies.FindAsync(companyId);
        Assert.Equal("Pro", company!.Plan);
        _stripeGatewayMock.Verify(
            g => g.CreateSubscriptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()),
            Times.Never);
    }

    [Fact]
    public async Task UpgradePlan_MissingCompany_ReturnsFalse()
    {
        var result = await _svc.UpgradePlanAsync("non-existent-id", "pm_test_mock", "Pro");
        Assert.False(result);
    }

    [Fact]
    public async Task UpgradePlan_WithStripeConfigured_ActiveSubscription_UpgradesPlanAndStoresStripeIds()
    {
        Environment.SetEnvironmentVariable("STRIPE_SECRET_KEY", "sk_test_mock");
        Environment.SetEnvironmentVariable("STRIPE_PRICE_PRO", "price_pro_mock");

        var companyId = await CreateCompanyWithPlanAsync("Free");
        var periodEnd = DateTime.UtcNow.AddMonths(1);
        _stripeGatewayMock
            .Setup(g => g.CreateSubscriptionAsync(null, It.IsAny<string>(), It.IsAny<string>(), "pm_test_mock", "price_pro_mock"))
            .ReturnsAsync(new StripeSubscriptionResult("cus_mock", "sub_mock", "active", periodEnd));

        var result = await _svc.UpgradePlanAsync(companyId, "pm_test_mock", "Pro");

        Assert.True(result);
        var company = await _context.Companies.FindAsync(companyId);
        Assert.Equal("Pro", company!.Plan);
        Assert.Equal("cus_mock", company.StripeCustomerId);
        Assert.Equal("sub_mock", company.StripeSubscriptionId);
        Assert.Equal(periodEnd, company.PlanExpiresAt);
    }

    [Fact]
    public async Task UpgradePlan_WithStripeConfigured_IncompleteSubscription_DoesNotUpgradePlanYet()
    {
        // A subscription can be created but stuck in "incomplete" when the first payment
        // fails (e.g. 3DS required or a declined card). The plan must not flip to Pro until
        // the webhook confirms the subscription actually became active.
        Environment.SetEnvironmentVariable("STRIPE_SECRET_KEY", "sk_test_mock");
        Environment.SetEnvironmentVariable("STRIPE_PRICE_PRO", "price_pro_mock");

        var companyId = await CreateCompanyWithPlanAsync("Free");
        _stripeGatewayMock
            .Setup(g => g.CreateSubscriptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(new StripeSubscriptionResult("cus_mock", "sub_mock", "incomplete", null));

        var result = await _svc.UpgradePlanAsync(companyId, "pm_test_mock", "Pro");

        Assert.False(result);
        var company = await _context.Companies.FindAsync(companyId);
        Assert.Equal("Free", company!.Plan);
        // Customer/subscription IDs are still captured so the webhook can finish the job later.
        Assert.Equal("cus_mock", company.StripeCustomerId);
        Assert.Equal("sub_mock", company.StripeSubscriptionId);
    }

    [Fact]
    public async Task UpgradePlan_WithStripeConfigured_NoPriceMappedForPlan_ThrowsInvalidOperationException()
    {
        Environment.SetEnvironmentVariable("STRIPE_SECRET_KEY", "sk_test_mock");
        // STRIPE_PRICE_PRO intentionally left unset.

        var companyId = await CreateCompanyWithPlanAsync("Free");

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => _svc.UpgradePlanAsync(companyId, "pm_test_mock", "Pro"));

        _stripeGatewayMock.Verify(
            g => g.CreateSubscriptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()),
            Times.Never);
    }

    // ── Feature key case-insensitivity ────────────────────────────────────────

    [Fact]
    public async Task IsFeatureEnabled_KeyIsCaseInsensitive()
    {
        var companyId = await CreateCompanyWithPlanAsync("Pro");

        var lower = await _svc.IsFeatureEnabledAsync(companyId, "sandbox.delete");
        var upper = await _svc.IsFeatureEnabledAsync(companyId, "SANDBOX.DELETE");
        var mixed = await _svc.IsFeatureEnabledAsync(companyId, "Sandbox.Delete");

        Assert.True(lower);
        Assert.True(upper);
        Assert.True(mixed);
    }

    public void Dispose()
    {
        _context.Dispose();
        // These are process-global; leaving them set would leak into other test classes.
        Environment.SetEnvironmentVariable("STRIPE_SECRET_KEY", null);
        Environment.SetEnvironmentVariable("STRIPE_PRICE_PRO", null);
    }
}
