using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public interface IRoleSeedService
    {
        Task SeedAsync();

        /// <summary>
        /// Ensures the company has its own "Admin" role holding every permission the company may use,
        /// and grants it to <paramref name="ownerCompanyUserId"/> (or, when null, to the company's first
        /// user if nobody in the company has a role yet). Returns the company's Admin role.
        /// </summary>
        Task<Role> EnsureCompanyAdminAsync(string companyId, string? ownerCompanyUserId = null);
    }

    public class RoleSeedService : IRoleSeedService
    {
        public const string AdminRoleName = "Admin";
        private const string AdminRoleDescription = "System administrator";

        private readonly ShiftWorkContext _context;

        public RoleSeedService(ShiftWorkContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        public async Task SeedAsync()
        {
            var companyIds = await _context.Companies
                .Select(c => c.CompanyId)
                .ToListAsync();

            foreach (var companyId in companyIds)
            {
                await EnsureCompanyAdminAsync(companyId);
            }
        }

        public async Task<Role> EnsureCompanyAdminAsync(string companyId, string? ownerCompanyUserId = null)
        {
            var adminRole = await _context.Roles
                .FirstOrDefaultAsync(r => r.CompanyId == companyId && r.Name == AdminRoleName);

            if (adminRole == null)
            {
                adminRole = new Role
                {
                    Name = AdminRoleName,
                    Description = AdminRoleDescription,
                    Status = "Active",
                    CompanyId = companyId,
                    Permissions = null
                };

                _context.Roles.Add(adminRole);
                await _context.SaveChangesAsync();
            }

            var allowedPermissions = await _context.Permissions
                .Where(p => p.CompanyId == null || p.CompanyId == companyId)
                .Select(p => p.PermissionId)
                .ToListAsync();

            var existingRolePermissions = await _context.RolePermissions
                .Where(rp => rp.RoleId == adminRole.RoleId)
                .ToListAsync();

            if (existingRolePermissions.Count > 0)
            {
                _context.RolePermissions.RemoveRange(existingRolePermissions);
            }

            var newRolePermissions = allowedPermissions
                .Distinct()
                .Select(permissionId => new RolePermission
                {
                    RoleId = adminRole.RoleId,
                    PermissionId = permissionId
                })
                .ToList();

            if (newRolePermissions.Count > 0)
            {
                _context.RolePermissions.AddRange(newRolePermissions);
            }

            await _context.SaveChangesAsync();

            var assigneeId = ownerCompanyUserId;
            if (assigneeId == null)
            {
                var hasAnyUserRoles = await _context.UserRoles
                    .AnyAsync(ur => ur.CompanyId == companyId);

                if (!hasAnyUserRoles)
                {
                    assigneeId = await _context.CompanyUsers
                        .Where(u => u.CompanyId == companyId)
                        .OrderBy(u => u.CreatedAt)
                        .Select(u => u.CompanyUserId)
                        .FirstOrDefaultAsync();
                }
            }

            if (assigneeId != null)
            {
                var alreadyAssigned = await _context.UserRoles
                    .AnyAsync(ur => ur.CompanyId == companyId
                                    && ur.CompanyUserId == assigneeId
                                    && ur.RoleId == adminRole.RoleId);

                if (!alreadyAssigned)
                {
                    _context.UserRoles.Add(new UserRole
                    {
                        CompanyUserId = assigneeId,
                        RoleId = adminRole.RoleId,
                        CompanyId = companyId
                    });

                    await _context.SaveChangesAsync();
                }
            }

            return adminRole;
        }
    }
}
