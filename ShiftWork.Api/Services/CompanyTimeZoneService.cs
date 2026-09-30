using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;

namespace ShiftWork.Api.Services
{
    public interface ICompanyTimeZoneService
    {
        Task<TimeZoneInfo> GetAsync(string companyId);
    }

    public class CompanyTimeZoneService : ICompanyTimeZoneService
    {
        private readonly ShiftWorkContext _context;
        public CompanyTimeZoneService(ShiftWorkContext context) => _context = context;

        public async Task<TimeZoneInfo> GetAsync(string companyId)
        {
            var companyZone = await _context.Companies
                .Where(c => c.CompanyId == companyId)
                .Select(c => c.TimeZone)
                .FirstOrDefaultAsync();
            if (!string.IsNullOrWhiteSpace(companyZone)) return LineupTime.Resolve(companyZone);

            var settingsZone = await _context.CompanySettings
                .Where(s => s.CompanyId == companyId)
                .Select(s => s.DefaultTimeZone)
                .FirstOrDefaultAsync();
            return LineupTime.Resolve(settingsZone);
        }
    }
}
