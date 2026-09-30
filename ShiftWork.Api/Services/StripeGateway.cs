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
