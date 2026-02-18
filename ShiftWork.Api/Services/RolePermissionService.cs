using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public interface IRolePermissionService
    {
        Task<List<Permission>?> GetRolePermissionsAsync(string companyId, int roleId);
        Task<List<Permission>?> UpdateRolePermissionsAsync(string companyId, int roleId, IEnumerable<string> permissionKeys);
    }

    public class RolePermissionService : IRolePermissionService
    {
        private readonly ShiftWorkContext _context;
        private readonly IPermissionService _permissionService;

        public RolePermissionService(ShiftWorkContext context, IPermissionService permissionService)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _permissionService = permissionService ?? throw new ArgumentNullException(nameof(permissionService));
        }

        public async Task<List<Permission>?> GetRolePermissionsAsync(string companyId, int roleId)
        {
            var role = await _context.Roles.FirstOrDefaultAsync(r => r.RoleId == roleId && r.CompanyId == companyId);
            if (role == null)
            {
                return null;
            }

            var permissions = await _context.RolePermissions
                .Where(rp => rp.RoleId == roleId)
                .Select(rp => rp.Permission)
                .OrderBy(p => p.Key)
                .ToListAsync();

            return permissions;
        }

        public async Task<List<Permission>?> UpdateRolePermissionsAsync(string companyId, int roleId, IEnumerable<string> permissionKeys)
        {
            var role = await _context.Roles.FirstOrDefaultAsync(r => r.RoleId == roleId && r.CompanyId == companyId);
            if (role == null)
            {
                return null;
            }

            var permissions = await _permissionService.GetByKeysAsync(companyId, permissionKeys);
            var requestedKeys = permissionKeys?.Where(k => !string.IsNullOrWhiteSpace(k)).Select(k => k.Trim()).ToList() ?? new List<string>();

            if (requestedKeys.Count != permissions.Count)
            {
                var missing = requestedKeys.Except(permissions.Select(p => p.Key), StringComparer.OrdinalIgnoreCase).ToList();
                if (missing.Count > 0)
                {
                    throw new InvalidOperationException($"Unknown permissions: {string.Join(", ", missing)}");
                }
            }

            var existing = await _context.RolePermissions.Where(rp => rp.RoleId == roleId).ToListAsync();
            if (existing.Count > 0)
            {
                _context.RolePermissions.RemoveRange(existing);
            }

            var newLinks = permissions.Select(p => new RolePermission
            {
                RoleId = roleId,
                PermissionId = p.PermissionId
            });

            _context.RolePermissions.AddRange(newLinks);
            await _context.SaveChangesAsync();

            return permissions.OrderBy(p => p.Key).ToList();
        }
    }
}
