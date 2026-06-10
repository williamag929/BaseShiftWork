namespace ShiftWork.Api.Services
{
    /// <summary>
    /// Manages company plan tiers (Free / Pro / Trial) and optional Stripe billing integration.
    /// When Stripe env vars are absent the service falls back to simulation mode (no charge).
    /// </summary>
    public interface IPlanService
    {
        /// <summary>
        /// Upgrades the company plan. Returns true on success.
        /// Simulates success when Stripe is not configured (graceful fallback).
        /// </summary>
        Task<bool> UpgradePlanAsync(string companyId, string stripePaymentMethodId, string targetPlan);

        /// <summary>Returns the current plan string ("Free", "Pro", "Trial") for a company.</summary>
        Task<string> GetCurrentPlanAsync(string companyId);

        /// <summary>
        /// Returns whether a named feature is enabled for the company's current plan.
        /// Feature keys: "sandbox.delete", "advanced_scheduling", "analytics", etc.
        /// </summary>
        Task<bool> IsFeatureEnabledAsync(string companyId, string featureKey);
    }
}
