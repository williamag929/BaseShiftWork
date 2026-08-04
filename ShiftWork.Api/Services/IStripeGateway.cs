namespace ShiftWork.Api.Services
{
    /// <summary>
    /// Thin wrapper around the Stripe.net SDK so PlanService's billing logic can be unit tested
    /// without making real network calls to Stripe.
    /// </summary>
    public interface IStripeGateway
    {
        /// <summary>
        /// Ensures a Stripe customer exists, attaches the given payment method as its default,
        /// and creates a subscription to the given price. Returns the resulting customer/subscription
        /// state so the caller can persist it and decide whether the plan is active yet.
        /// </summary>
        Task<StripeSubscriptionResult> CreateSubscriptionAsync(
            string? existingCustomerId,
            string customerEmail,
            string customerName,
            string paymentMethodId,
            string priceId);

        /// <summary>
        /// Creates a Stripe Billing Portal session URL for a customer to manage their subscription.
        /// Customer can view invoices, change payment method, cancel subscription, etc.
        /// </summary>
        Task<string> CreateBillingPortalSessionAsync(string customerId, string returnUrl);
    }

    /// <summary>Result of creating/attaching a Stripe subscription.</summary>
    public record StripeSubscriptionResult(
        string CustomerId,
        string SubscriptionId,
        string Status,
        DateTime? CurrentPeriodEnd);
}
