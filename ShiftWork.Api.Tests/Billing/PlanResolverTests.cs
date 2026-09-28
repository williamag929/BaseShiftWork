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
