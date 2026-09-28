using ShiftWork.Api.Models;

namespace ShiftWork.Api.Helpers
{
    public sealed record EffectivePlan(string Tier, bool IsTrial, int TrialDaysRemaining, int? EmployeeCap, IReadOnlySet<string> Features);

    public static class PlanResolver
    {
        // past_due keeps access so Stripe's dunning retries don't lock out a paying customer mid-retry.
        private static readonly HashSet<string> PaidStatuses = new(StringComparer.OrdinalIgnoreCase) { "active", "trialing", "past_due" };

        public static bool GrantsPaidAccess(string? status) => status != null && PaidStatuses.Contains(status);

        public static EffectivePlan Resolve(Company company, DateTime utcNow)
        {
            var trialDays = company.TrialEndsAt is DateTime end && end > utcNow
                ? (int)Math.Ceiling((end - utcNow).TotalDays)
                : 0;

            string tier;
            var isTrial = false;
            if (GrantsPaidAccess(company.SubscriptionStatus) && PlanCatalog.IsPaidTier(company.Plan))
            {
                tier = PlanCatalog.Normalize(company.Plan!);
            }
            else if (trialDays > 0)
            {
                tier = PlanCatalog.Pro;
                isTrial = true;
            }
            else
            {
                tier = PlanCatalog.Free;
            }

            return new EffectivePlan(tier, isTrial, isTrial ? trialDays : 0, PlanCatalog.EmployeeCap(tier), PlanCatalog.Features(tier));
        }
    }
}
