using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Moq;
using ShiftWork.Api.Data;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Stripe;
using Xunit;
using Company = ShiftWork.Api.Models.Company;
using Person = ShiftWork.Api.Models.Person;
using PlanService = ShiftWork.Api.Services.PlanService;

namespace ShiftWork.Api.Tests.Billing;

/// <summary>Regression tests for the findings of the final whole-branch review (I1-I5).</summary>
public class FinalReviewFixesTests
{
    private static DbContextOptions<ShiftWorkContext> NewDb() =>
        new DbContextOptionsBuilder<ShiftWorkContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;

    private static Company Seed(ShiftWorkContext ctx, string plan = "Pro")
    {
        var c = new Company
        {
            CompanyId = "c1", Name = "Acme", Email = "o@acme.com", Address = "", PhoneNumber = "", TimeZone = "UTC",
            Plan = plan, StripeCustomerId = "cus_1", StripeSubscriptionId = "sub_1", SubscriptionStatus = "active",
            CurrentPeriodEnd = new DateTime(2026, 10, 28, 0, 0, 0, DateTimeKind.Utc)
        };
        ctx.Companies.Add(c);
        ctx.SaveChanges();
        return c;
    }

    // I1: PATCH loads a tracked Person, mutates it, then calls Update - reactivation must still hit the cap.
    [Fact]
    public async Task TrackedPerson_ReactivatedThenUpdated_IsStillGuarded()
    {
        var opts = NewDb();
        using var ctx = new ShiftWorkContext(opts);
        ctx.Companies.Add(new Company { CompanyId = "c1", Name = "C", Email = "c@t.com", Address = "", PhoneNumber = "", TimeZone = "UTC", Plan = "Free" });
        for (var i = 0; i < 5; i++)
            ctx.Persons.Add(new Person { Name = $"p{i}", Email = $"{Guid.NewGuid()}@t.com", CompanyId = "c1", Status = "Active" });
        ctx.Persons.Add(new Person { Name = "gone", Email = "gone@t.com", CompanyId = "c1", Status = "Inactive" });
        ctx.SaveChanges();
        var plans = new PlanService(ctx, NullLogger<PlanService>.Instance, new FakeTimeProvider(new DateTimeOffset(2026, 9, 28, 0, 0, 0, TimeSpan.Zero)));
        var people = new PeopleService(ctx, NullLogger<PeopleService>.Instance, new PlanEnforcementService(ctx, plans));

        var id = ctx.Persons.Single(p => p.Email == "gone@t.com").PersonId;
        var tracked = await people.Get("c1", id);
        tracked!.Status = "Active"; // what PatchPerson does via reflection

        await Assert.ThrowsAsync<PlanLimitExceededException>(() => people.Update(tracked));
    }

    // I2 + I4: the live create path starts the trial and ignores client-supplied billing state.
    [Fact]
    public async Task CreateCompany_StartsTrial_AndIgnoresBillingFieldsFromClient()
    {
        var opts = NewDb();
        using var ctx = new ShiftWorkContext(opts);
        var sut = new CompanyService(ctx, NullLogger<CompanyService>.Instance);
        var before = DateTime.UtcNow;

        await sut.CreateCompanyAsync(new Company
        {
            CompanyId = "c9", Name = "New", Email = "n@n.com", Address = "", PhoneNumber = "", TimeZone = "UTC",
            Plan = "Business", SubscriptionStatus = "active", StripeCustomerId = "cus_evil", StripeSubscriptionId = "sub_evil",
            CurrentPeriodEnd = DateTime.UtcNow.AddYears(5)
        });

        using var check = new ShiftWorkContext(opts);
        var c = check.Companies.Single(x => x.CompanyId == "c9");
        Assert.Equal("Free", c.Plan);
        Assert.Null(c.SubscriptionStatus);
        Assert.Null(c.StripeCustomerId);
        Assert.Null(c.StripeSubscriptionId);
        Assert.Null(c.CurrentPeriodEnd);
        Assert.NotNull(c.TrialEndsAt);
        Assert.InRange(c.TrialEndsAt!.Value, before.AddDays(14).AddMinutes(-1), DateTime.UtcNow.AddDays(14).AddMinutes(1));
    }

    // I4: a settings-page save (possibly stale) must never write billing state.
    [Fact]
    public async Task UpdateCompany_NeverOverwritesBillingFields()
    {
        var opts = NewDb();
        using (var seed = new ShiftWorkContext(opts)) Seed(seed);
        using var ctx = new ShiftWorkContext(opts);
        var sut = new CompanyService(ctx, NullLogger<CompanyService>.Instance);

        var ok = await sut.UpdateCompanyAsync(new Company
        {
            CompanyId = "c1", Name = "Renamed", Email = "o@acme.com", Address = "", PhoneNumber = "", TimeZone = "UTC",
            Plan = "Business", SubscriptionStatus = null, StripeCustomerId = "cus_evil", StripeSubscriptionId = null, CurrentPeriodEnd = null
        });

        Assert.True(ok);
        using var check = new ShiftWorkContext(opts);
        var c = check.Companies.Single();
        Assert.Equal("Renamed", c.Name);
        Assert.Equal(("Pro", "active", "cus_1", "sub_1"), (c.Plan, c.SubscriptionStatus, c.StripeCustomerId, c.StripeSubscriptionId));
        Assert.Equal(new DateTime(2026, 10, 28, 0, 0, 0, DateTimeKind.Utc), c.CurrentPeriodEnd);
    }

    // I5: Stripe ids and subscription state are not serialized to API clients.
    [Fact]
    public void CompanyJson_DoesNotExposeStripeIdsOrSubscriptionState()
    {
        var json = JsonSerializer.Serialize(new Company
        {
            CompanyId = "c1", Name = "A", Plan = "Pro", StripeCustomerId = "cus_1", StripeSubscriptionId = "sub_1",
            SubscriptionStatus = "active", CurrentPeriodEnd = DateTime.UtcNow
        }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        Assert.DoesNotContain("cus_1", json);
        Assert.DoesNotContain("sub_1", json);
        Assert.DoesNotContain("subscriptionStatus", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("currentPeriodEnd", json, StringComparison.OrdinalIgnoreCase);
    }

    // I3: only a lost duplicate-delivery race may be swallowed; any other DB failure must surface so Stripe retries.
    private sealed class FailingSaveContext : ShiftWorkContext
    {
        public Action? BeforeThrow;
        public bool Fail;
        public FailingSaveContext(DbContextOptions<ShiftWorkContext> o) : base(o) { }
        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            if (!Fail) return base.SaveChangesAsync(cancellationToken);
            BeforeThrow?.Invoke();
            throw new DbUpdateException("simulated");
        }
    }

    private static (FailingSaveContext ctx, StripeWebhookService sut) Webhook(DbContextOptions<ShiftWorkContext> opts)
    {
        var ctx = new FailingSaveContext(opts);
        Seed(ctx, "Free");
        var gw = new FakeStripeGateway();
        gw.Subscriptions["sub_1"] = new StripeSubscriptionSnapshot("sub_1", "cus_1", "active", "price_p", new DateTime(2026, 10, 28, 0, 0, 0, DateTimeKind.Utc));
        var settings = new StripeSettings { SecretKey = "sk", PriceStarter = "price_s", PricePro = "price_p", PriceBusiness = "price_b" };
        return (ctx, new StripeWebhookService(ctx, gw, settings, new Mock<INotificationService>().Object, NullLogger<StripeWebhookService>.Instance));
    }

    private static Event SubEvent(string id) => new()
    {
        Id = id, Type = EventTypes.CustomerSubscriptionUpdated,
        Data = new EventData { Object = new Subscription { Id = "sub_1", CustomerId = "cus_1" } }
    };

    [Fact]
    public async Task Webhook_NonDuplicateDbFailure_IsRethrownSoStripeRetries()
    {
        var opts = NewDb();
        var (ctx, sut) = Webhook(opts);
        using var _ = ctx;
        ctx.Fail = true;
        await Assert.ThrowsAsync<DbUpdateException>(() => sut.ProcessAsync(SubEvent("evt_fail")));
    }

    [Fact]
    public async Task Webhook_LostDuplicateRace_IsSwallowed()
    {
        var opts = NewDb();
        var (ctx, sut) = Webhook(opts);
        using var _ = ctx;
        ctx.Fail = true;
        ctx.BeforeThrow = () =>
        {
            using var other = new ShiftWorkContext(opts);
            other.StripeProcessedEvents.Add(new StripeProcessedEvent { EventId = "evt_race", Type = EventTypes.CustomerSubscriptionUpdated, ProcessedAt = DateTime.UtcNow });
            other.SaveChanges();
        };
        await sut.ProcessAsync(SubEvent("evt_race")); // must not throw
    }
}
