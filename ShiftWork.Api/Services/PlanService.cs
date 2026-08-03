using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Helpers;
using Stripe;

namespace ShiftWork.Api.Services
{
    /// <inheritdoc />
    public class PlanService : IPlanService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<PlanService> _logger;
        private readonly IStripeGateway _stripeGateway;

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

        public PlanService(ShiftWorkContext context, ILogger<PlanService> logger, IStripeGateway stripeGateway)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _stripeGateway = stripeGateway ?? throw new ArgumentNullException(nameof(stripeGateway));
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

            var priceId = StripePlanMapping.GetPriceIdForPlan(targetPlan);
            if (string.IsNullOrWhiteSpace(priceId))
            {
                _logger.LogWarning("UpgradePlan: no Stripe price is configured for plan {TargetPlan}.", targetPlan);
                throw new InvalidOperationException($"No Stripe price is configured for plan '{targetPlan}'.");
            }

            _logger.LogInformation("{EventName} {CompanyId} {TargetPlan}",
                FunnelEventNames.PlanUpgradeStarted, companyId, targetPlan);

            try
            {
                var result = await _stripeGateway.CreateSubscriptionAsync(
                    company.StripeCustomerId,
                    company.Email,
                    company.Name,
                    stripePaymentMethodId,
                    priceId);

                company.StripeCustomerId = result.CustomerId;
                company.StripeSubscriptionId = result.SubscriptionId;

                // Only flip the plan if Stripe confirms the subscription is actually active/trialing.
                // If the first payment failed (status "incomplete"), the plan stays as-is; the
                // subscription lifecycle webhook will finalize the state once Stripe resolves it.
                var isActive = result.Status is "active" or "trialing";
                if (isActive)
                {
                    company.Plan = targetPlan;
                    if (result.CurrentPeriodEnd.HasValue)
                    {
                        company.PlanExpiresAt = result.CurrentPeriodEnd;
                    }
                }

                await _context.SaveChangesAsync();

                _logger.LogInformation("{EventName} {CompanyId} {TargetPlan} stripeStatus={StripeStatus}",
                    isActive ? FunnelEventNames.PlanUpgradeSuccess : FunnelEventNames.PlanUpgradeFailure,
                    companyId, targetPlan, result.Status);
                return isActive;
            }
            catch (StripeException ex)
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
