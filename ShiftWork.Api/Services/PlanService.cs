using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public class PlanService : IPlanService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<PlanService> _logger;
        private readonly TimeProvider _clock;

        public PlanService(ShiftWorkContext context, ILogger<PlanService> logger, TimeProvider? clock = null)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _clock = clock ?? TimeProvider.System;
        }

        public async Task<EffectivePlan> GetEffectivePlanAsync(string companyId)
        {
            var company = await _context.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.CompanyId == companyId)
                ?? new Company { CompanyId = companyId, Plan = PlanCatalog.Free };
            return PlanResolver.Resolve(company, _clock.GetUtcNow().UtcDateTime);
        }

        public async Task<string> GetCurrentPlanAsync(string companyId) => (await GetEffectivePlanAsync(companyId)).Tier;

        public async Task<bool> IsFeatureEnabledAsync(string companyId, string featureKey)
            => (await GetEffectivePlanAsync(companyId)).Features.Contains(featureKey);
    }
}
