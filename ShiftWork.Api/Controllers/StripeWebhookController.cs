using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Services;
using Stripe;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/stripe/webhook")]
    public class StripeWebhookController : ControllerBase
    {
        private readonly IStripeWebhookService _webhooks;
        private readonly StripeSettings _settings;
        private readonly ILogger<StripeWebhookController> _logger;

        public StripeWebhookController(IStripeWebhookService webhooks, StripeSettings settings, ILogger<StripeWebhookController> logger)
        {
            _webhooks = webhooks;
            _settings = settings;
            _logger = logger;
        }

        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> Receive()
        {
            if (string.IsNullOrWhiteSpace(_settings.WebhookSecret))
            {
                _logger.LogError("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured.");
                return StatusCode(500, "Webhook is not configured.");
            }

            var payload = await new StreamReader(Request.Body).ReadToEndAsync();
            Event stripeEvent;
            try
            {
                // Version mismatch must not reject events: the dashboard endpoint version and Stripe.net's pin drift independently.
                stripeEvent = EventUtility.ConstructEvent(payload, Request.Headers["Stripe-Signature"].ToString(),
                    _settings.WebhookSecret, throwOnApiVersionMismatch: false);
            }
            catch (StripeException ex)
            {
                _logger.LogWarning(ex, "Stripe webhook signature verification failed.");
                return BadRequest("Invalid Stripe webhook signature.");
            }

            await _webhooks.ProcessAsync(stripeEvent);
            return Ok();
        }
    }
}
