using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;
using Stripe;

namespace ShiftWork.Api.Services
{
    /// <inheritdoc />
    public class StripeWebhookService : IStripeWebhookService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<StripeWebhookService> _logger;
        private readonly INotificationService _notificationService;

        public StripeWebhookService(
            ShiftWorkContext context,
            ILogger<StripeWebhookService> logger,
            INotificationService notificationService)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _notificationService = notificationService ?? throw new ArgumentNullException(nameof(notificationService));
        }

        /// <inheritdoc />
        public async Task HandleSubscriptionUpsertedAsync(Subscription subscription)
        {
            var company = await FindCompanyByCustomerIdAsync(subscription.CustomerId);
            if (company == null)
            {
                _logger.LogWarning("Stripe subscription event for unknown customer {CustomerId}.", subscription.CustomerId);
                return;
            }

            company.StripeSubscriptionId = subscription.Id;

            var item = subscription.Items?.Data?.FirstOrDefault();
            var plan = StripePlanMapping.GetPlanForPriceId(item?.Price?.Id);

            if (subscription.Status is "active" or "trialing")
            {
                if (plan != null)
                {
                    company.Plan = plan;
                }
                else
                {
                    _logger.LogWarning(
                        "Stripe subscription {SubscriptionId} has an unrecognized price {PriceId}; plan left unchanged.",
                        subscription.Id, item?.Price?.Id);
                }

                if (item != null)
                {
                    company.PlanExpiresAt = item.CurrentPeriodEnd;
                }
            }
            else if (subscription.Status is "canceled" or "unpaid" or "incomplete_expired")
            {
                company.Plan = "Free";
                company.StripeSubscriptionId = null;
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation(
                "Stripe subscription {SubscriptionId} upserted for company {CompanyId}: status={Status}",
                subscription.Id, company.CompanyId, subscription.Status);
        }

        /// <inheritdoc />
        public async Task HandleSubscriptionDeletedAsync(Subscription subscription)
        {
            var company = await FindCompanyByCustomerIdAsync(subscription.CustomerId);
            if (company == null)
            {
                _logger.LogWarning("Stripe subscription-deleted event for unknown customer {CustomerId}.", subscription.CustomerId);
                return;
            }

            company.Plan = "Free";
            company.StripeSubscriptionId = null;
            company.PlanExpiresAt = null;
            await _context.SaveChangesAsync();

            _logger.LogInformation("{EventName} {CompanyId}", FunnelEventNames.PlanDowngraded, company.CompanyId);
        }

        /// <inheritdoc />
        public async Task HandleInvoicePaymentSucceededAsync(Invoice invoice)
        {
            var company = await FindCompanyByCustomerIdAsync(invoice.CustomerId);
            if (company == null)
            {
                _logger.LogWarning("Stripe invoice.payment_succeeded for unknown customer {CustomerId}.", invoice.CustomerId);
                return;
            }

            company.PlanExpiresAt = invoice.PeriodEnd;
            await _context.SaveChangesAsync();

            _logger.LogInformation("{EventName} {CompanyId} {ExpiresAt}",
                FunnelEventNames.PlanPaymentSuccess, company.CompanyId, invoice.PeriodEnd);
        }

        /// <inheritdoc />
        public async Task HandleInvoicePaymentFailedAsync(Invoice invoice)
        {
            var company = await FindCompanyByCustomerIdAsync(invoice.CustomerId);
            if (company == null)
            {
                _logger.LogWarning("Stripe invoice.payment_failed for unknown customer {CustomerId}.", invoice.CustomerId);
                return;
            }

            _logger.LogWarning("{EventName} {CompanyId}", FunnelEventNames.PlanPaymentFailure, company.CompanyId);

            if (!string.IsNullOrWhiteSpace(company.Email))
            {
                try
                {
                    await _notificationService.SendEmailAsync(
                        company.Email,
                        "Payment failed for your ShiftWork subscription",
                        $"<p>We were unable to process your latest payment for {company.Name}. " +
                        "Please update your payment method to avoid losing access to Pro features.</p>");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send payment-failure notification for company {CompanyId}.", company.CompanyId);
                }
            }
        }

        private Task<Company?> FindCompanyByCustomerIdAsync(string? customerId)
        {
            if (string.IsNullOrWhiteSpace(customerId))
            {
                return Task.FromResult<Company?>(null);
            }

            return _context.Companies.FirstOrDefaultAsync(c => c.StripeCustomerId == customerId);
        }
    }
}
