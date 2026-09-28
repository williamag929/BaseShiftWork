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
