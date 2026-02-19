using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public interface IAuditLogService
    {
        Task LogUserRoleAssignmentAsync(string companyId, string userId, string? userName, string uid, List<string> oldRoleNames, List<string> newRoleNames);
        Task LogRolePermissionUpdateAsync(string companyId, string userId, string? userName, int roleId, string roleName, List<string> oldPermissionKeys, List<string> newPermissionKeys);
    }

    public class AuditLogService : IAuditLogService
    {
        private readonly ShiftWorkContext _context;

        public AuditLogService(ShiftWorkContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        /// <summary>
        /// Log user role assignment changes
        /// </summary>
        public async Task LogUserRoleAssignmentAsync(string companyId, string userId, string? userName, string uid, List<string> oldRoleNames, List<string> newRoleNames)
        {
            var now = DateTime.UtcNow;
            
            // Added roles
            var addedRoles = newRoleNames.Except(oldRoleNames).ToList();
            foreach (var roleName in addedRoles)
            {
                var auditEntry = new AuditHistory
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    EntityName = "UserRole",
                    EntityId = uid,
                    ActionType = "Created",
                    ActionDate = now,
                    UserId = userId,
                    UserName = userName,
                    FieldName = "Role",
                    NewValue = roleName,
                    ChangeDescription = $"Role '{roleName}' assigned to user {uid}",
                    Metadata = null
                };

                _context.AuditHistories.Add(auditEntry);
            }

            // Removed roles
            var removedRoles = oldRoleNames.Except(newRoleNames).ToList();
            foreach (var roleName in removedRoles)
            {
                var auditEntry = new AuditHistory
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    EntityName = "UserRole",
                    EntityId = uid,
                    ActionType = "Deleted",
                    ActionDate = now,
                    UserId = userId,
                    UserName = userName,
                    FieldName = "Role",
                    OldValue = roleName,
                    ChangeDescription = $"Role '{roleName}' removed from user {uid}",
                    Metadata = null
                };

                _context.AuditHistories.Add(auditEntry);
            }

            if (addedRoles.Count > 0 || removedRoles.Count > 0)
            {
                await _context.SaveChangesAsync();
            }
        }

        /// <summary>
        /// Log role permission updates
        /// </summary>
        public async Task LogRolePermissionUpdateAsync(string companyId, string userId, string? userName, int roleId, string roleName, List<string> oldPermissionKeys, List<string> newPermissionKeys)
        {
            var now = DateTime.UtcNow;

            // Added permissions
            var addedPermissions = newPermissionKeys.Except(oldPermissionKeys).ToList();
            foreach (var permissionKey in addedPermissions)
            {
                var auditEntry = new AuditHistory
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    EntityName = "RolePermission",
                    EntityId = roleId.ToString(),
                    ActionType = "Created",
                    ActionDate = now,
                    UserId = userId,
                    UserName = userName,
                    FieldName = "Permission",
                    NewValue = permissionKey,
                    ChangeDescription = $"Permission '{permissionKey}' granted to role '{roleName}'",
                    Metadata = null
                };

                _context.AuditHistories.Add(auditEntry);
            }

            // Removed permissions
            var removedPermissions = oldPermissionKeys.Except(newPermissionKeys).ToList();
            foreach (var permissionKey in removedPermissions)
            {
                var auditEntry = new AuditHistory
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    EntityName = "RolePermission",
                    EntityId = roleId.ToString(),
                    ActionType = "Deleted",
                    ActionDate = now,
                    UserId = userId,
                    UserName = userName,
                    FieldName = "Permission",
                    OldValue = permissionKey,
                    ChangeDescription = $"Permission '{permissionKey}' revoked from role '{roleName}'",
                    Metadata = null
                };

                _context.AuditHistories.Add(auditEntry);
            }

            if (addedPermissions.Count > 0 || removedPermissions.Count > 0)
            {
                await _context.SaveChangesAsync();
            }
        }
    }
}
