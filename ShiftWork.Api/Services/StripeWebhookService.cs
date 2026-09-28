using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;
using Stripe;
using Company = ShiftWork.Api.Models.Company;

namespace ShiftWork.Api.Services
{
    public interface IStripeWebhookService
    {
        Task ProcessAsync(Event stripeEvent);
    }

    public class StripeWebhookService : IStripeWebhookService
    {
        private static readonly HashSet<string> EndedStatuses = new(StringComparer.OrdinalIgnoreCase) { "canceled", "incomplete_expired" };

        private readonly ShiftWorkContext _context;
        private readonly IStripeGateway _stripe;
        private readonly StripeSettings _settings;
        private readonly INotificationService _notifications;
        private readonly ILogger<StripeWebhookService> _logger;

        public StripeWebhookService(ShiftWorkContext context, IStripeGateway stripe, StripeSettings settings,
            INotificationService notifications, ILogger<StripeWebhookService> logger)
        {
            _context = context;
            _stripe = stripe;
            _settings = settings;
            _notifications = notifications;
            _logger = logger;
        }

        public async Task ProcessAsync(Event stripeEvent)
        {
            if (await _context.StripeProcessedEvents.AnyAsync(e => e.EventId == stripeEvent.Id))
            {
                _logger.LogInformation("Stripe event {EventId} already processed; skipping.", stripeEvent.Id);
                return;
            }

            _context.StripeProcessedEvents.Add(new StripeProcessedEvent
            {
                EventId = stripeEvent.Id,
                Type = stripeEvent.Type,
                ProcessedAt = DateTime.UtcNow
            });

            string? paymentFailedEmail = null;
            switch (stripeEvent.Data.Object)
            {
                case Stripe.Checkout.Session s when stripeEvent.Type == EventTypes.CheckoutSessionCompleted && s.Mode == "subscription":
                    await HandleCheckoutCompletedAsync(s);
                    break;
                case Subscription sub when stripeEvent.Type is EventTypes.CustomerSubscriptionCreated
                                                           or EventTypes.CustomerSubscriptionUpdated
                                                           or EventTypes.CustomerSubscriptionDeleted:
                    await HandleSubscriptionEventAsync(sub);
                    break;
                case Invoice inv when stripeEvent.Type == EventTypes.InvoicePaymentFailed:
                    paymentFailedEmail = (await FindByCustomerAsync(inv.CustomerId))?.Email;
                    break;
                default:
                    _logger.LogInformation("Stripe event {EventType} recorded without action.", stripeEvent.Type);
                    break;
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // A concurrent delivery of the same event won the insert race; its handler already applied the change.
                _logger.LogWarning(ex, "Stripe event {EventId} raced a duplicate delivery; ignoring.", stripeEvent.Id);
                return;
            }

            if (paymentFailedEmail != null)
            {
                await _notifications.SendEmailAsync(paymentFailedEmail, "Loqzen payment failed",
                    "<p>We couldn't process your latest Loqzen payment. Please update your card from <b>Plan &amp; Billing</b> to keep your plan.</p>");
            }
        }

        private async Task HandleCheckoutCompletedAsync(Stripe.Checkout.Session session)
        {
            var company = await _context.Companies.FirstOrDefaultAsync(c => c.CompanyId == session.ClientReferenceId);
            if (company == null || string.IsNullOrWhiteSpace(session.SubscriptionId))
            {
                _logger.LogWarning("Checkout session for unknown company {CompanyId}.", session.ClientReferenceId);
                return;
            }

            // client_reference_id comes from our own server, but the customer must still match so a session can't be replayed onto another tenant.
            if (company.StripeCustomerId != null && company.StripeCustomerId != session.CustomerId)
            {
                _logger.LogWarning("Checkout customer {CustomerId} does not match company {CompanyId}; ignoring.", session.CustomerId, company.CompanyId);
                return;
            }

            company.StripeCustomerId ??= session.CustomerId;
            if (!CanAdopt(company, session.SubscriptionId)) return;
            company.StripeSubscriptionId = session.SubscriptionId;
            await SyncAsync(company);
        }

        private async Task HandleSubscriptionEventAsync(Subscription sub)
        {
            var company = await FindByCustomerAsync(sub.CustomerId);
            if (company == null)
            {
                _logger.LogWarning("Subscription {SubscriptionId} for unknown customer {CustomerId}.", sub.Id, sub.CustomerId);
                return;
            }

            if (!CanAdopt(company, sub.Id)) return;
            company.StripeSubscriptionId = sub.Id;
            await SyncAsync(company);
        }

        private bool CanAdopt(Company company, string subscriptionId)
        {
            if (company.StripeSubscriptionId == null || company.StripeSubscriptionId == subscriptionId) return true;
            if (company.SubscriptionStatus == null || EndedStatuses.Contains(company.SubscriptionStatus)) return true;

            _logger.LogWarning("Ignoring subscription {SubscriptionId}: company {CompanyId} already has live {Current}.",
                subscriptionId, company.CompanyId, company.StripeSubscriptionId);
            return false;
        }

        // Always re-read from Stripe: event payloads can arrive late or out of order, the API is current.
        private async Task SyncAsync(Company company)
        {
            var snap = await _stripe.GetSubscriptionAsync(company.StripeSubscriptionId!);
            if (snap == null)
            {
                _logger.LogWarning("Subscription {SubscriptionId} not found in Stripe.", company.StripeSubscriptionId);
                return;
            }

            company.SubscriptionStatus = snap.Status;
            company.CurrentPeriodEnd = snap.CurrentPeriodEnd;

            if (EndedStatuses.Contains(snap.Status))
            {
                company.Plan = PlanCatalog.Free;
            }
            else if (_settings.TierForPriceId(snap.PriceId) is string tier)
            {
                company.Plan = tier;
            }
            else
            {
                _logger.LogError("Unknown Stripe price {PriceId} on subscription {SubscriptionId}; plan unchanged.", snap.PriceId, snap.Id);
            }
        }

        private Task<Company?> FindByCustomerAsync(string? customerId) =>
            string.IsNullOrWhiteSpace(customerId)
                ? Task.FromResult<Company?>(null)
                : _context.Companies.FirstOrDefaultAsync(c => c.StripeCustomerId == customerId);
    }
}
