namespace ShiftWork.Api.Helpers
{
    /// <summary>
    /// Single source of truth mapping ShiftWork plan names to Stripe Price IDs.
    /// Add one env var + one switch arm per paid plan tier.
    /// </summary>
    public static class StripePlanMapping
    {
        /// <summary>Returns the Stripe Price ID configured for a plan name, or null if the plan isn't Stripe-billed.</summary>
        public static string? GetPriceIdForPlan(string plan) => plan switch
        {
            "Pro" => Environment.GetEnvironmentVariable("STRIPE_PRICE_PRO"),
            _ => null
        };

        /// <summary>Reverse lookup: given a Stripe Price ID from a webhook event, returns the matching plan name, or null if unrecognized.</summary>
        public static string? GetPlanForPriceId(string? priceId)
        {
            if (string.IsNullOrWhiteSpace(priceId))
            {
                return null;
            }

            var proPriceId = Environment.GetEnvironmentVariable("STRIPE_PRICE_PRO");
            if (!string.IsNullOrWhiteSpace(proPriceId) && priceId == proPriceId)
            {
                return "Pro";
            }

            return null;
        }
    }
}
