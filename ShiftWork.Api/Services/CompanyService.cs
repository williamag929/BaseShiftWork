using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace ShiftWork.Api.Services
{
    /// <summary>
    /// Defines the contract for the company service.
    /// </summary>
    public interface ICompanyService
    {
        Task<IEnumerable<Company>> GetAllCompanies();
        Task<IEnumerable<Company>> GetCompaniesByUidAsync(string uid, string? email = null);
        Task<Company> GetCompanyByIdAsync(string id);
        Task CreateCompanyAsync(Company company);
        Task<bool> UpdateCompanyAsync(Company company);
        Task<bool> DeleteCompanyAsync(string id);
        Task<int> GetTrialDaysRemainingAsync(string companyId);
        Task<bool> IsTrialExpiredAsync(string companyId);
        Task<int> GetEmployeeCountAsync(string companyId);
        Task<bool> AutoDowngradePlanIfTrialExpiredAsync(string companyId);
    }

    /// <summary>
    /// Service for managing companies.
    /// </summary>
    public class CompanyService : ICompanyService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<CompanyService> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="CompanyService"/> class.
        /// </summary>
        public CompanyService(ShiftWorkContext context, ILogger<CompanyService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IEnumerable<Company>> GetAllCompanies()
        {
            return await _context.Companies.ToListAsync();
        }

        public async Task<IEnumerable<Company>> GetCompaniesByUidAsync(string uid, string? email = null)
        {
            // Match by Uid (Firebase UID or api_{guid})
            var byUid = await _context.CompanyUsers
                .Where(cu => cu.Uid == uid && cu.IsActive)
                .Select(cu => cu.Company)
                .Distinct()
                .ToListAsync();

            // Also match by email so users who belong to multiple companies
            // (e.g. self-registered + invited) see all of them regardless of UID type.
            if (!string.IsNullOrWhiteSpace(email))
            {
                var byEmail = await _context.CompanyUsers
                    .Where(cu => cu.Email.ToLower() == email.ToLower() && cu.IsActive)
                    .Select(cu => cu.Company)
                    .Distinct()
                    .ToListAsync();

                // Merge both sets, deduplicate by CompanyId
                var existingIds = new HashSet<string>(byUid.Select(c => c.CompanyId));
                foreach (var company in byEmail)
                {
                    if (existingIds.Add(company.CompanyId))
                        byUid.Add(company);
                }
            }

            return byUid;
        }

        public async Task<Company> GetCompanyByIdAsync(string id)
        {
            return await _context.Companies.FindAsync(id);
        }

        public async Task CreateCompanyAsync(Company company)
        {
            _context.Companies.Add(company);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Company with ID {CompanyId} created.", company.CompanyId);
        }

        public async Task<bool> UpdateCompanyAsync(Company company)
        {
            _context.Entry(company).State = EntityState.Modified;
            try
            {
                await _context.SaveChangesAsync();
                _logger.LogInformation("Company with ID {CompanyId} updated.", company.CompanyId);
                return true;
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await CompanyExists(company.CompanyId))
                {
                    return false;
                }
                else
                {
                    throw;
                }
            }
        }

        public async Task<bool> DeleteCompanyAsync(string id)
        {
            var company = await _context.Companies.FindAsync(id);
            if (company == null)
            {
                return false;
            }

            _context.Companies.Remove(company);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Company with ID {CompanyId} deleted.", id);
            return true;
        }

        private async Task<bool> CompanyExists(string id)
        {
            return await _context.Companies.AnyAsync(e => e.CompanyId == id);
        }

        public async Task<int> GetTrialDaysRemainingAsync(string companyId)
        {
            var company = await _context.Companies.FindAsync(companyId);
            if (company?.PlanExpiresAt == null)
                return 0;

            var daysRemaining = (int)(company.PlanExpiresAt.Value - DateTime.UtcNow).TotalDays;
            return Math.Max(0, daysRemaining);
        }

        public async Task<bool> IsTrialExpiredAsync(string companyId)
        {
            var company = await _context.Companies.FindAsync(companyId);
            if (company?.PlanExpiresAt == null)
                return false;

            return DateTime.UtcNow > company.PlanExpiresAt;
        }

        public async Task<int> GetEmployeeCountAsync(string companyId)
        {
            return await _context.Persons.CountAsync(p => p.CompanyId == companyId && p.Status == "Active");
        }

        public async Task<bool> AutoDowngradePlanIfTrialExpiredAsync(string companyId)
        {
            var company = await _context.Companies.FindAsync(companyId);
            if (company == null)
                return false;

            if (company.Plan != "Free" && company.PlanExpiresAt != null && DateTime.UtcNow > company.PlanExpiresAt)
            {
                company.Plan = "Free";
                company.StripeSubscriptionId = null;
                await UpdateCompanyAsync(company);
                _logger.LogInformation("Company {CompanyId} auto-downgraded to Free plan after trial expiration.", companyId);
                return true;
            }

            return false;
        }
    }
}