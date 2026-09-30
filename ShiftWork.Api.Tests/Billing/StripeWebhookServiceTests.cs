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
