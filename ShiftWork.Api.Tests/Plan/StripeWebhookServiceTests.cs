using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Stripe;
using Xunit;

namespace ShiftWork.Api.Tests.Plan;

/// <summary>
/// Unit tests for StripeWebhookService. Constructs Stripe model objects directly rather than
/// raw webhook JSON/signatures, since signature verification and JSON parsing are Stripe.net's
/// responsibility (EventUtility) — these tests focus on our own event -> Company mapping logic.
/// </summary>
[Collection("StripeEnvVars")]
public class StripeWebhookServiceTests : IDisposable
{
    private readonly ShiftWorkContext _context;
    private readonly Mock<INotificationService> _notificationServiceMock;
    private readonly StripeWebhookService _svc;

    private const string ProPriceId = "price_pro_mock";

    public StripeWebhookServiceTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ShiftWorkContext(options);
        _notificationServiceMock = new Mock<INotificationService>();
        _svc = new StripeWebhookService(_context, NullLogger<StripeWebhookService>.Instance, _notificationServiceMock.Object);

        Environment.SetEnvironmentVariable("STRIPE_PRICE_PRO", ProPriceId);
    }

    private async Task<Company> CreateCompanyAsync(string plan, string? stripeCustomerId, string? stripeSubscriptionId = null)
    {
        var company = new Company
        {
            CompanyId = Guid.NewGuid().ToString(),
            Name = "Test Co",
            Email = "billing@test.com",
            PhoneNumber = string.Empty,
            Address = string.Empty,
            TimeZone = "UTC",
            Plan = plan,
            StripeCustomerId = stripeCustomerId,
            StripeSubscriptionId = stripeSubscriptionId
        };
        _context.Companies.Add(company);
        await _context.SaveChangesAsync();
        return company;
    }

    private static Subscription BuildSubscription(string subscriptionId, string customerId, string status, string? priceId, DateTime? periodEnd)
    {
        var items = new StripeList<SubscriptionItem>
        {
            Data = new List<SubscriptionItem>()
        };

        if (priceId != null)
        {
            items.Data.Add(new SubscriptionItem
            {
                Price = new Price { Id = priceId },
                CurrentPeriodEnd = periodEnd ?? DateTime.UtcNow
            });
        }

        return new Subscription
        {
            Id = subscriptionId,
            CustomerId = customerId,
            Status = status,
            Items = items
        };
    }

    // ── HandleSubscriptionUpsertedAsync ───────────────────────────────────────

    [Fact]
    public async Task SubscriptionUpserted_ActiveWithKnownPrice_UpgradesPlanAndSetsExpiry()
    {
        var company = await CreateCompanyAsync("Free", "cus_1");
        var periodEnd = DateTime.UtcNow.AddMonths(1);
        var subscription = BuildSubscription("sub_1", "cus_1", "active", ProPriceId, periodEnd);

        await _svc.HandleSubscriptionUpsertedAsync(subscription);

        var updated = await _context.Companies.FindAsync(company.CompanyId);
        Assert.Equal("Pro", updated!.Plan);
        Assert.Equal("sub_1", updated.StripeSubscriptionId);
        Assert.Equal(periodEnd, updated.PlanExpiresAt);
    }

    [Fact]
    public async Task SubscriptionUpserted_ActiveWithUnrecognizedPrice_LeavesPlanUnchanged()
    {
        var company = await CreateCompanyAsync("Free", "cus_2");
        var subscription = BuildSubscription("sub_2", "cus_2", "active", "price_unknown", DateTime.UtcNow.AddMonths(1));

        await _svc.HandleSubscriptionUpsertedAsync(subscription);

        var updated = await _context.Companies.FindAsync(company.CompanyId);
        Assert.Equal("Free", updated!.Plan);
        // Subscription id is still recorded even though the price tier is unrecognized.
        Assert.Equal("sub_2", updated.StripeSubscriptionId);
    }

    [Fact]
    public async Task SubscriptionUpserted_CanceledStatus_DowngradesToFree()
    {
        var company = await CreateCompanyAsync("Pro", "cus_3", "sub_old");
        var subscription = BuildSubscription("sub_old", "cus_3", "canceled", ProPriceId, null);

        await _svc.HandleSubscriptionUpsertedAsync(subscription);

        var updated = await _context.Companies.FindAsync(company.CompanyId);
        Assert.Equal("Free", updated!.Plan);
        Assert.Null(updated.StripeSubscriptionId);
    }

    [Fact]
    public async Task SubscriptionUpserted_UnknownCustomer_DoesNotThrow()
    {
        var subscription = BuildSubscription("sub_x", "cus_does_not_exist", "active", ProPriceId, DateTime.UtcNow);

        await _svc.HandleSubscriptionUpsertedAsync(subscription);
        // No assertion needed beyond "did not throw" — there's no company row to check.
    }

    // ── HandleSubscriptionDeletedAsync ────────────────────────────────────────

    [Fact]
    public async Task SubscriptionDeleted_DowngradesToFreeAndClearsBillingFields()
    {
        var company = await CreateCompanyAsync("Pro", "cus_4", "sub_4");
        company.PlanExpiresAt = DateTime.UtcNow.AddMonths(1);
        await _context.SaveChangesAsync();

        var subscription = BuildSubscription("sub_4", "cus_4", "canceled", ProPriceId, null);

        await _svc.HandleSubscriptionDeletedAsync(subscription);

        var updated = await _context.Companies.FindAsync(company.CompanyId);
        Assert.Equal("Free", updated!.Plan);
        Assert.Null(updated.StripeSubscriptionId);
        Assert.Null(updated.PlanExpiresAt);
    }

    // ── HandleInvoicePaymentSucceededAsync ────────────────────────────────────

    [Fact]
    public async Task InvoicePaymentSucceeded_ExtendsPlanExpiresAt()
    {
        var company = await CreateCompanyAsync("Pro", "cus_5", "sub_5");
        var periodEnd = DateTime.UtcNow.AddMonths(1);
        var invoice = new Invoice { CustomerId = "cus_5", PeriodEnd = periodEnd };

        await _svc.HandleInvoicePaymentSucceededAsync(invoice);

        var updated = await _context.Companies.FindAsync(company.CompanyId);
        Assert.Equal(periodEnd, updated!.PlanExpiresAt);
    }

    // ── HandleInvoicePaymentFailedAsync ───────────────────────────────────────

    [Fact]
    public async Task InvoicePaymentFailed_SendsNotificationToCompanyEmail()
    {
        var company = await CreateCompanyAsync("Pro", "cus_6", "sub_6");
        var invoice = new Invoice { CustomerId = "cus_6" };

        await _svc.HandleInvoicePaymentFailedAsync(invoice);

        _notificationServiceMock.Verify(
            n => n.SendEmailAsync(company.Email, It.IsAny<string>(), It.IsAny<string>()),
            Times.Once);
    }

    [Fact]
    public async Task InvoicePaymentFailed_UnknownCustomer_DoesNotSendNotification()
    {
        var invoice = new Invoice { CustomerId = "cus_does_not_exist" };

        await _svc.HandleInvoicePaymentFailedAsync(invoice);

        _notificationServiceMock.Verify(
            n => n.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()),
            Times.Never);
    }

    public void Dispose()
    {
        _context.Dispose();
        Environment.SetEnvironmentVariable("STRIPE_PRICE_PRO", null);
    }
}
