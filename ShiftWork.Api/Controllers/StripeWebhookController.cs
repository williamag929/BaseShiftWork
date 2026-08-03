using System.IO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShiftWork.Api.Services;
using Stripe;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// Receives Stripe subscription lifecycle events so Company.Plan stays in sync with the
    /// customer's actual billing state (payment failures, cancellations, tier changes) even
    /// when those happen outside the app (e.g. directly in the Stripe customer portal).
    /// See Docs/WEBHOOK_INTEGRATION.md "Stripe Subscription Lifecycle Webhooks" for the spec.
    /// Thin by design: signature verification + dispatch only. Business logic lives in
    /// <see cref="IStripeWebhookService"/>.
    /// </summary>
    [ApiController]
    [Route("api/webhooks/stripe")]
    public class StripeWebhookController : ControllerBase
    {
        private readonly IStripeWebhookService _webhookService;
        private readonly ILogger<StripeWebhookController> _logger;

        public StripeWebhookController(IStripeWebhookService webhookService, ILogger<StripeWebhookController> logger)
        {
            _webhookService = webhookService;
            _logger = logger;
        }

        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> HandleStripeEvent()
        {
            var webhookSecret = Environment.GetEnvironmentVariable("STRIPE_WEBHOOK_SECRET");
            if (string.IsNullOrWhiteSpace(webhookSecret))
            {
                _logger.LogError("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured.");
                return StatusCode(500, "Webhook is not configured.");
            }

            var payload = await new StreamReader(Request.Body).ReadToEndAsync();
            var signature = Request.Headers["Stripe-Signature"].ToString();

            Event stripeEvent;
            try
            {
                // Signature MUST be verified before trusting any payload data.
                stripeEvent = EventUtility.ConstructEvent(payload, signature, webhookSecret);
            }
            catch (StripeException ex)
            {
                _logger.LogWarning(ex, "Stripe webhook signature verification failed.");
                return BadRequest("Invalid Stripe webhook signature.");
            }

            switch (stripeEvent.Type)
            {
                case EventTypes.CustomerSubscriptionCreated:
                case EventTypes.CustomerSubscriptionUpdated:
                    if (stripeEvent.Data.Object is Subscription upsertedSubscription)
                    {
                        await _webhookService.HandleSubscriptionUpsertedAsync(upsertedSubscription);
                    }
                    break;

                case EventTypes.CustomerSubscriptionDeleted:
                    if (stripeEvent.Data.Object is Subscription deletedSubscription)
                    {
                        await _webhookService.HandleSubscriptionDeletedAsync(deletedSubscription);
                    }
                    break;

                case EventTypes.InvoicePaymentSucceeded:
                    if (stripeEvent.Data.Object is Invoice paidInvoice)
                    {
                        await _webhookService.HandleInvoicePaymentSucceededAsync(paidInvoice);
                    }
                    break;

                case EventTypes.InvoicePaymentFailed:
                    if (stripeEvent.Data.Object is Invoice failedInvoice)
                    {
                        await _webhookService.HandleInvoicePaymentFailedAsync(failedInvoice);
                    }
                    break;

                default:
                    _logger.LogInformation("Unhandled Stripe event type: {EventType}", stripeEvent.Type);
                    break;
            }

            return Ok();
        }
    }
}
