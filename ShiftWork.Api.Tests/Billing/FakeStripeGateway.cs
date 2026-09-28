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
