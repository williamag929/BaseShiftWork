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
    }

    public class RoleSeedService : IRoleSeedService
    {
        private const string AdminRoleName = "Admin";
        private const string AdminRoleDescription = "System administrator";

        private readonly ShiftWorkContext _context;

        public RoleSeedService(ShiftWorkContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        public async Task SeedAsync()
        {
            var companies = await _context.Companies
                .Select(c => new { c.CompanyId })
                .ToListAsync();

            if (companies.Count == 0)
            {
                return;
            }

            var allPermissions = await _context.Permissions
                .ToListAsync();

            foreach (var company in companies)
            {
                var adminRole = await _context.Roles
                    .FirstOrDefaultAsync(r => r.CompanyId == company.CompanyId && r.Name == AdminRoleName);

                if (adminRole == null)
                {
                    adminRole = new Role
                    {
                        Name = AdminRoleName,
                        Description = AdminRoleDescription,
                        Status = "Active",
                        CompanyId = company.CompanyId,
                        Permissions = null
                    };

                    _context.Roles.Add(adminRole);
                    await _context.SaveChangesAsync();
                }

                var allowedPermissions = allPermissions
                    .Where(p => p.CompanyId == null || p.CompanyId == company.CompanyId)
                    .Select(p => p.PermissionId)
                    .ToList();

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
                    await _context.SaveChangesAsync();
                }

                var hasAnyUserRoles = await _context.UserRoles
                    .AnyAsync(ur => ur.CompanyId == company.CompanyId);

                if (!hasAnyUserRoles)
                {
                    var firstUser = await _context.CompanyUsers
                        .Where(u => u.CompanyId == company.CompanyId)
                        .OrderBy(u => u.CreatedAt)
                        .FirstOrDefaultAsync();

                    if (firstUser != null)
                    {
                        _context.UserRoles.Add(new UserRole
                        {
                            CompanyUserId = firstUser.CompanyUserId,
                            RoleId = adminRole.RoleId,
                            CompanyId = company.CompanyId
                        });

                        await _context.SaveChangesAsync();
                    }
                }
            }
        }
    }
}
