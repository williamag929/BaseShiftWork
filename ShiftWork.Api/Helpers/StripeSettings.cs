namespace ShiftWork.Api.Helpers
{
    public sealed class StripeSettings
    {
        public string? SecretKey { get; init; }
        public string? WebhookSecret { get; init; }
        public string? PriceStarter { get; init; }
        public string? PricePro { get; init; }
        public string? PriceBusiness { get; init; }
        public string? AppBaseUrl { get; init; }

        public bool IsConfigured => !string.IsNullOrWhiteSpace(SecretKey);

        public static StripeSettings FromEnvironment() => new()
        {
            SecretKey = Environment.GetEnvironmentVariable("STRIPE_SECRET_KEY"),
            WebhookSecret = Environment.GetEnvironmentVariable("STRIPE_WEBHOOK_SECRET"),
            PriceStarter = Environment.GetEnvironmentVariable("STRIPE_PRICE_STARTER"),
            PricePro = Environment.GetEnvironmentVariable("STRIPE_PRICE_PRO"),
            PriceBusiness = Environment.GetEnvironmentVariable("STRIPE_PRICE_BUSINESS"),
            AppBaseUrl = Environment.GetEnvironmentVariable("APP_BASE_URL"),
        };

        private IEnumerable<(string Tier, string? Price)> Map() => new[]
        {
            (PlanCatalog.Starter, PriceStarter), (PlanCatalog.Pro, PricePro), (PlanCatalog.Business, PriceBusiness)
        };

        public string? PriceIdFor(string tier) =>
            Map().FirstOrDefault(m => m.Tier.Equals(tier, StringComparison.OrdinalIgnoreCase)).Price is { Length: > 0 } p ? p : null;

        public string? TierForPriceId(string? priceId) =>
            string.IsNullOrWhiteSpace(priceId) ? null : Map().FirstOrDefault(m => m.Price == priceId).Tier;

        public string AppUrl(string path) => $"{(AppBaseUrl ?? "http://localhost:4200").TrimEnd('/')}/{path.TrimStart('/')}";
    }
}
