using Stripe;

namespace ShiftWork.Api.Services
{
    /// <inheritdoc />
    public class StripeGateway : IStripeGateway
    {
        private readonly ILogger<StripeGateway> _logger;

        public StripeGateway(ILogger<StripeGateway> logger)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <inheritdoc />
        public async Task<StripeSubscriptionResult> CreateSubscriptionAsync(
            string? existingCustomerId,
            string customerEmail,
            string customerName,
            string paymentMethodId,
            string priceId)
        {
            var customerService = new CustomerService();
            Customer customer;

            if (!string.IsNullOrWhiteSpace(existingCustomerId))
            {
                customer = await customerService.GetAsync(existingCustomerId);
            }
            else
            {
                customer = await customerService.CreateAsync(new CustomerCreateOptions
                {
                    Email = customerEmail,
                    Name = customerName
                });
            }

            var paymentMethodService = new PaymentMethodService();
            await paymentMethodService.AttachAsync(paymentMethodId, new PaymentMethodAttachOptions
            {
                Customer = customer.Id
            });

            await customerService.UpdateAsync(customer.Id, new CustomerUpdateOptions
            {
                InvoiceSettings = new CustomerInvoiceSettingsOptions
                {
                    DefaultPaymentMethod = paymentMethodId
                }
            });

            var subscriptionService = new SubscriptionService();
            var subscription = await subscriptionService.CreateAsync(new SubscriptionCreateOptions
            {
                Customer = customer.Id,
                Items = new List<SubscriptionItemOptions>
                {
                    new() { Price = priceId }
                },
                DefaultPaymentMethod = paymentMethodId,
                PaymentSettings = new SubscriptionPaymentSettingsOptions
                {
                    SaveDefaultPaymentMethod = "on_subscription"
                },
                Expand = new List<string> { "latest_invoice.payment_intent" }
            });

            var periodEnd = subscription.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;

            _logger.LogInformation(
                "Stripe subscription {SubscriptionId} for customer {CustomerId} created with status {Status}.",
                subscription.Id, customer.Id, subscription.Status);

            return new StripeSubscriptionResult(customer.Id, subscription.Id, subscription.Status, periodEnd);
        }
    }
}
