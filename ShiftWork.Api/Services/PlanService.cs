using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Helpers;

namespace ShiftWork.Api.Services
{
    /// <inheritdoc />
    public class PlanService : IPlanService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<PlanService> _logger;

        // Feature gates per plan. Add more keys as needed.
        private static readonly Dictionary<string, HashSet<string>> PlanFeatures = new()
        {
            ["Free"] = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "sandbox.hide",
                "sandbox.reset",
                "kiosk.clockin",
                "schedules.basic",
            },
            ["Trial"] = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "sandbox.hide",
                "sandbox.reset",
                "sandbox.delete",
                "kiosk.clockin",
                "schedules.basic",
                "analytics",
                "advanced_scheduling",
            },
            ["Pro"] = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "sandbox.hide",
                "sandbox.reset",
                "sandbox.delete",
                "kiosk.clockin",
                "schedules.basic",
                "analytics",
                "advanced_scheduling",
                "multi_location",
                "export",
            },
        };

        private static bool IsStripeConfigured =>
            !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("STRIPE_SECRET_KEY"));

        public PlanService(ShiftWorkContext context, ILogger<PlanService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <inheritdoc />
        public async Task<bool> UpgradePlanAsync(string companyId, string stripePaymentMethodId, string targetPlan)
        {
            var company = await _context.Companies.FindAsync(companyId);
            if (company == null)
            {
                _logger.LogWarning("UpgradePlan: company {CompanyId} not found.", companyId);
                return false;
            }

            if (!IsStripeConfigured)
            {
                // Graceful fallback: simulate upgrade (same pattern as NotificationService)
                _logger.LogInformation("{EventName} {CompanyId} {TargetPlan} stripe=simulated",
                    FunnelEventNames.PlanUpgradeSimulated, companyId, targetPlan);
                company.Plan = targetPlan;
                await _context.SaveChangesAsync();
                return true;
            }

            // TODO: integrate real Stripe SDK when STRIPE_SECRET_KEY is set.
            // 1. Create/retrieve Stripe customer for company.StripeCustomerId.
            // 2. Attach stripePaymentMethodId to the customer.
            // 3. Create a subscription for the Pro price ID.
            // 4. Store subscription.Id in company.StripeSubscriptionId.
            _logger.LogInformation("{EventName} {CompanyId} {TargetPlan}",
                FunnelEventNames.PlanUpgradeStarted, companyId, targetPlan);

            try
            {
                company.Plan = targetPlan;
                // company.StripeCustomerId and StripeSubscriptionId to be set after Stripe calls.
                await _context.SaveChangesAsync();

                _logger.LogInformation("{EventName} {CompanyId} {TargetPlan}",
                    FunnelEventNames.PlanUpgradeSuccess, companyId, targetPlan);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "{EventName} {CompanyId} {TargetPlan}",
                    FunnelEventNames.PlanUpgradeFailure, companyId, targetPlan);
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<string> GetCurrentPlanAsync(string companyId)
        {
            var company = await _context.Companies
                .AsNoTracking()
                .Where(c => c.CompanyId == companyId)
                .Select(c => new { c.Plan })
                .FirstOrDefaultAsync();

            return company?.Plan ?? "Free";
        }

        /// <inheritdoc />
        public async Task<bool> IsFeatureEnabledAsync(string companyId, string featureKey)
        {
            var plan = await GetCurrentPlanAsync(companyId);
            if (PlanFeatures.TryGetValue(plan, out var features))
                return features.Contains(featureKey);
            return false;
        }
    }
}
