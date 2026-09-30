using ShiftWork.Api.Helpers;

namespace ShiftWork.Api.Services
{
    /// <summary>Effective plan and feature gates for a company; paid state is written only by Stripe webhooks.</summary>
    public interface IPlanService
    {
        Task<EffectivePlan> GetEffectivePlanAsync(string companyId);
        Task<string> GetCurrentPlanAsync(string companyId);
        Task<bool> IsFeatureEnabledAsync(string companyId, string featureKey);
    }
}
