using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public interface IUserRoleService
    {
        Task<List<Role>?> GetUserRolesAsync(string companyId, string uid);
        Task<List<string>?> GetUserPermissionsAsync(string companyId, string uid);
        Task<List<Role>?> UpdateUserRolesAsync(string companyId, string uid, IEnumerable<int> roleIds);
        Task<List<Role>?> BootstrapAdminAsync(string companyId, string uid);
    }

    public class UserRoleService : IUserRoleService
    {
        private readonly ShiftWorkContext _context;

        public UserRoleService(ShiftWorkContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        public async Task<List<Role>?> GetUserRolesAsync(string companyId, string uid)
        {
            var user = await _context.CompanyUsers.FirstOrDefaultAsync(u => u.Uid == uid && u.CompanyId == companyId);
            if (user == null)
            {
                return null;
            }

            return await _context.UserRoles
                .Where(ur => ur.CompanyUserId == user.CompanyUserId && ur.CompanyId == companyId)
                .Select(ur => ur.Role)
                .OrderBy(r => r.Name)
                .ToListAsync();
        }

        public async Task<List<string>?> GetUserPermissionsAsync(string companyId, string uid)
        {
            var user = await _context.CompanyUsers.FirstOrDefaultAsync(u => u.Uid == uid && u.CompanyId == companyId);
            if (user == null)
            {
                return null;
            }

            var roleIds = await _context.UserRoles
                .Where(ur => ur.CompanyUserId == user.CompanyUserId && ur.CompanyId == companyId)
                .Select(ur => ur.RoleId)
                .ToListAsync();

            if (roleIds.Count == 0)
            {
                return new List<string>();
            }

            return await _context.RolePermissions
                .Where(rp => roleIds.Contains(rp.RoleId))
                .Select(rp => rp.Permission.Key)
                .Distinct()
                .OrderBy(key => key)
                .ToListAsync();
        }

        public async Task<List<Role>?> UpdateUserRolesAsync(string companyId, string uid, IEnumerable<int> roleIds)
        {
            var user = await _context.CompanyUsers.FirstOrDefaultAsync(u => u.Uid == uid && u.CompanyId == companyId);
            if (user == null)
            {
                return null;
            }

            var roleIdList = roleIds?.Distinct().ToList() ?? new List<int>();
            var roles = await _context.Roles.Where(r => r.CompanyId == companyId && roleIdList.Contains(r.RoleId)).ToListAsync();

            if (roleIdList.Count != roles.Count)
            {
                var missing = roleIdList.Except(roles.Select(r => r.RoleId)).ToList();
                if (missing.Count > 0)
                {
                    throw new InvalidOperationException($"Unknown roles: {string.Join(", ", missing)}");
                }
            }

            var existing = await _context.UserRoles
                .Where(ur => ur.CompanyUserId == user.CompanyUserId && ur.CompanyId == companyId)
                .ToListAsync();

            if (existing.Count > 0)
            {
                _context.UserRoles.RemoveRange(existing);
            }

            var newLinks = roles.Select(r => new UserRole
            {
                CompanyUserId = user.CompanyUserId,
                RoleId = r.RoleId,
                CompanyId = companyId
            });

            _context.UserRoles.AddRange(newLinks);
            await _context.SaveChangesAsync();

            return roles.OrderBy(r => r.Name).ToList();
        }

        public async Task<List<Role>?> BootstrapAdminAsync(string companyId, string uid)
        {
            var user = await _context.CompanyUsers.FirstOrDefaultAsync(u => u.Uid == uid && u.CompanyId == companyId);
            if (user == null)
            {
                return null;
            }

            var hasAnyRoles = await _context.UserRoles.AnyAsync(ur => ur.CompanyId == companyId);
            if (hasAnyRoles)
            {
                throw new InvalidOperationException("Roles already exist for this company.");
            }

            var adminRole = await _context.Roles.FirstOrDefaultAsync(r => r.CompanyId == companyId && r.Name == "Admin");
            if (adminRole == null)
            {
                throw new InvalidOperationException("Admin role not found for this company.");
            }

            _context.UserRoles.Add(new UserRole
            {
                CompanyUserId = user.CompanyUserId,
                RoleId = adminRole.RoleId,
                CompanyId = companyId
            });

            await _context.SaveChangesAsync();
            return new List<Role> { adminRole };
        }
    }
}
