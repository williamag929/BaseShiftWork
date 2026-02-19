using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace ShiftWork.Api.Services
{
    /// <summary>
    /// Defines the contract for the company user profile service.
    /// </summary>
    public interface ICompanyUserProfileService
    {
        Task<IEnumerable<CompanyUserProfile>> GetProfiles(string companyId, string companyUserId);
        Task<IEnumerable<CompanyUserProfile>> GetProfilesByRole(string companyId, int roleId);
        Task<IEnumerable<CompanyUserProfile>> GetProfilesByPerson(string companyId, int personId);
        Task<CompanyUserProfile> GetProfile(int profileId);
        Task<CompanyUserProfile> AssignRoleToUser(string companyId, string companyUserId, int roleId, int? personId, string assignedBy);
        Task<bool> RemoveRoleFromUser(int profileId);
        Task<bool> RemoveAllRolesFromUser(string companyId, string companyUserId);
    }

    /// <summary>
    /// Service for managing company user profiles (role assignments).
    /// </summary>
    public class CompanyUserProfileService : ICompanyUserProfileService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<CompanyUserProfileService> _logger;

        public CompanyUserProfileService(ShiftWorkContext context, ILogger<CompanyUserProfileService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IEnumerable<CompanyUserProfile>> GetProfiles(string companyId, string companyUserId)
        {
            return await _context.CompanyUserProfiles
                .Where(p => p.CompanyId == companyId && p.CompanyUserId == companyUserId && p.IsActive)
                .Include(p => p.Role)
                .Include(p => p.Person)
                .ToListAsync();
        }

        public async Task<IEnumerable<CompanyUserProfile>> GetProfilesByRole(string companyId, int roleId)
        {
            return await _context.CompanyUserProfiles
                .Where(p => p.CompanyId == companyId && p.RoleId == roleId && p.IsActive)
                .Include(p => p.CompanyUser)
                .Include(p => p.Person)
                .ToListAsync();
        }

        public async Task<IEnumerable<CompanyUserProfile>> GetProfilesByPerson(string companyId, int personId)
        {
            return await _context.CompanyUserProfiles
                .Where(p => p.CompanyId == companyId && p.PersonId == personId && p.IsActive)
                .Include(p => p.Role)
                .Include(p => p.CompanyUser)
                .ToListAsync();
        }

        public async Task<CompanyUserProfile> GetProfile(int profileId)
        {
            return await _context.CompanyUserProfiles
                .Include(p => p.Role)
                .Include(p => p.CompanyUser)
                .Include(p => p.Person)
                .FirstOrDefaultAsync(p => p.ProfileId == profileId);
        }

        public async Task<CompanyUserProfile> AssignRoleToUser(string companyId, string companyUserId, int roleId, int? personId, string assignedBy)
        {
            // Check if assignment already exists
            var existing = await _context.CompanyUserProfiles
                .FirstOrDefaultAsync(p => p.CompanyId == companyId && p.CompanyUserId == companyUserId && p.RoleId == roleId);

            if (existing != null)
            {
                if (!existing.IsActive)
                {
                    // Reactivate existing profile
                    existing.IsActive = true;
                    existing.AssignedAt = DateTime.UtcNow;
                    existing.AssignedBy = assignedBy;
                    existing.PersonId = personId;
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("Reactivated CompanyUserProfile {ProfileId} for user {CompanyUserId} in company {CompanyId}", existing.ProfileId, companyUserId, companyId);
                    return existing;
                }
                
                // Already active
                return existing;
            }

            // Create new profile
            var profile = new CompanyUserProfile
            {
                CompanyId = companyId,
                CompanyUserId = companyUserId,
                RoleId = roleId,
                PersonId = personId,
                IsActive = true,
                AssignedAt = DateTime.UtcNow,
                AssignedBy = assignedBy
            };

            _context.CompanyUserProfiles.Add(profile);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Created CompanyUserProfile {ProfileId} for user {CompanyUserId} in company {CompanyId}", profile.ProfileId, companyUserId, companyId);
            return profile;
        }

        public async Task<bool> RemoveRoleFromUser(int profileId)
        {
            var profile = await _context.CompanyUserProfiles.FindAsync(profileId);
            if (profile == null)
            {
                return false;
            }

            profile.IsActive = false;
            await _context.SaveChangesAsync();
            _logger.LogInformation("Deactivated CompanyUserProfile {ProfileId}", profileId);
            return true;
        }

        public async Task<bool> RemoveAllRolesFromUser(string companyId, string companyUserId)
        {
            var profiles = await _context.CompanyUserProfiles
                .Where(p => p.CompanyId == companyId && p.CompanyUserId == companyUserId && p.IsActive)
                .ToListAsync();

            foreach (var profile in profiles)
            {
                profile.IsActive = false;
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Deactivated all profiles for user {CompanyUserId} in company {CompanyId}", companyUserId, companyId);
            return true;
        }
    }
}
