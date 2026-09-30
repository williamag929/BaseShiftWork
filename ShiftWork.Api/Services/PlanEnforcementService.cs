using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Helpers;

namespace ShiftWork.Api.Services
{
    public interface IPlanEnforcementService
    {
        Task EnsureCanActivateEmployeeAsync(string companyId);
    }

    public class PlanEnforcementService : IPlanEnforcementService
    {
        private readonly ShiftWorkContext _context;
        private readonly IPlanService _plans;

        public PlanEnforcementService(ShiftWorkContext context, IPlanService plans)
        {
            _context = context;
            _plans = plans;
        }

        public static bool IsActiveStatus(string? status) =>
            status == null || status.Equals("Active", StringComparison.OrdinalIgnoreCase);

        public async Task EnsureCanActivateEmployeeAsync(string companyId)
        {
            var plan = await _plans.GetEffectivePlanAsync(companyId);
            if (plan.EmployeeCap is not int cap) return;

            var count = await _context.Persons.CountAsync(p =>
                p.CompanyId == companyId && !p.IsSandbox && (p.Status == null || p.Status.ToLower() == "active"));

            if (count >= cap) throw new PlanLimitExceededException(plan.Tier, cap, count);
        }
    }
}
