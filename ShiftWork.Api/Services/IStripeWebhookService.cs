using Stripe;

namespace ShiftWork.Api.Services
{
    /// <summary>
    /// Applies Stripe subscription lifecycle events to Company billing state.
    /// The controller only verifies the webhook signature and dispatches by event type;
    /// all business logic (which company, what plan, what to persist) lives here.
    /// </summary>
    public interface IStripeWebhookService
    {
        Task HandleSubscriptionUpsertedAsync(Subscription subscription);
        Task HandleSubscriptionDeletedAsync(Subscription subscription);
        Task HandleInvoicePaymentSucceededAsync(Invoice invoice);
        Task HandleInvoicePaymentFailedAsync(Invoice invoice);
    }
}
