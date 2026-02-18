using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public interface IPermissionSeedService
    {
        Task SeedAsync();
    }

    public class PermissionSeedService : IPermissionSeedService
    {
        private readonly ShiftWorkContext _context;

        public PermissionSeedService(ShiftWorkContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        public async Task SeedAsync()
        {
            var permissions = GetDefaultPermissions();

            var existingKeys = await _context.Permissions
                .Select(p => p.Key)
                .ToListAsync();

            var existingKeySet = new HashSet<string>(existingKeys, StringComparer.OrdinalIgnoreCase);

            var toAdd = permissions
                .Where(p => !existingKeySet.Contains(p.Key))
                .ToList();

            if (toAdd.Count == 0)
            {
                return;
            }

            _context.Permissions.AddRange(toAdd);
            await _context.SaveChangesAsync();
        }

        private static List<Permission> GetDefaultPermissions()
        {
            return new List<Permission>
            {
                // People
                Create("people.read", "People - Read", "View people records"),
                Create("people.create", "People - Create", "Create people records"),
                Create("people.update", "People - Update", "Update people records"),
                Create("people.delete", "People - Delete", "Delete people records"),

                // Locations
                Create("locations.read", "Locations - Read", "View locations"),
                Create("locations.create", "Locations - Create", "Create locations"),
                Create("locations.update", "Locations - Update", "Update locations"),
                Create("locations.delete", "Locations - Delete", "Delete locations"),

                // Areas
                Create("areas.read", "Areas - Read", "View areas"),
                Create("areas.create", "Areas - Create", "Create areas"),
                Create("areas.update", "Areas - Update", "Update areas"),
                Create("areas.delete", "Areas - Delete", "Delete areas"),

                // Tasks
                Create("tasks.read", "Tasks - Read", "View task shifts"),
                Create("tasks.create", "Tasks - Create", "Create task shifts"),
                Create("tasks.update", "Tasks - Update", "Update task shifts"),
                Create("tasks.delete", "Tasks - Delete", "Delete task shifts"),

                // Roles and permissions
                Create("roles.read", "Roles - Read", "View roles"),
                Create("roles.create", "Roles - Create", "Create roles"),
                Create("roles.update", "Roles - Update", "Update roles"),
                Create("roles.delete", "Roles - Delete", "Delete roles"),
                Create("permissions.read", "Permissions - Read", "View permissions"),
                Create("roles.permissions.update", "Roles - Permissions Update", "Update role permissions"),

                // Company users
                Create("company-users.read", "Company Users - Read", "View company users"),
                Create("company-users.update", "Company Users - Update", "Update company users"),
                Create("company-users.roles.update", "Company Users - Roles Update", "Update user roles"),
                Create("company-users.profile.update", "Company Users - Profile Update", "Link users to profiles"),

                // Audit history
                Create("audit-history.read", "Audit History - Read", "View audit history"),

                // Schedules
                Create("schedules.read", "Schedules - Read", "View schedules"),
                Create("schedules.create", "Schedules - Create", "Create schedules"),
                Create("schedules.update", "Schedules - Update", "Update schedules"),
                Create("schedules.delete", "Schedules - Delete", "Delete schedules"),

                // Schedule shifts
                Create("schedule-shifts.read", "Schedule Shifts - Read", "View schedule shifts"),
                Create("schedule-shifts.create", "Schedule Shifts - Create", "Create schedule shifts"),
                Create("schedule-shifts.update", "Schedule Shifts - Update", "Update schedule shifts"),
                Create("schedule-shifts.delete", "Schedule Shifts - Delete", "Delete schedule shifts"),

                // Schedule summaries and approvals
                Create("schedule-shift-summaries.read", "Schedule Shift Summaries - Read", "View schedule shift summaries"),
                Create("shift-summary-approvals.update", "Shift Summary Approvals - Update", "Approve shift summaries"),

                // Shift events
                Create("shift-events.read", "Shift Events - Read", "View shift events"),
                Create("shift-events.create", "Shift Events - Create", "Create shift events"),
                Create("shift-events.update", "Shift Events - Update", "Update shift events"),
                Create("shift-events.delete", "Shift Events - Delete", "Delete shift events"),

                // Time off requests
                Create("timeoff-requests.read", "Time Off - Read", "View time off requests"),
                Create("timeoff-requests.create", "Time Off - Create", "Create time off requests"),
                Create("timeoff-requests.approve", "Time Off - Approve", "Approve or deny time off requests"),
                Create("timeoff-requests.delete", "Time Off - Delete", "Cancel time off requests"),

                // PTO
                Create("pto.read", "PTO - Read", "View PTO balances"),
                Create("pto.update", "PTO - Update", "Configure PTO settings"),

                // Crews and membership
                Create("crews.read", "Crews - Read", "View crews"),
                Create("crews.create", "Crews - Create", "Create crews"),
                Create("crews.update", "Crews - Update", "Update crews"),
                Create("crews.delete", "Crews - Delete", "Delete crews"),
                Create("crews.assign", "Crews - Assign", "Assign people to crews"),
                Create("person-crews.read", "Person Crews - Read", "View person crew assignments"),
                Create("person-crews.update", "Person Crews - Update", "Update person crew assignments"),

                // Company settings
                Create("company-settings.read", "Company Settings - Read", "View company settings"),
                Create("company-settings.update", "Company Settings - Update", "Update company settings"),

                // Device tokens
                Create("device-tokens.read", "Device Tokens - Read", "View device tokens"),
                Create("device-tokens.create", "Device Tokens - Create", "Register device tokens"),
                Create("device-tokens.delete", "Device Tokens - Delete", "Delete device tokens"),

                // Replacement requests
                Create("replacement-requests.read", "Replacement Requests - Read", "View replacement requests"),
                Create("replacement-requests.create", "Replacement Requests - Create", "Create replacement requests"),
                Create("replacement-requests.update", "Replacement Requests - Update", "Update replacement requests"),
                Create("replacement-requests.delete", "Replacement Requests - Delete", "Cancel replacement requests"),

                // Companies
                Create("companies.read", "Companies - Read", "View companies"),
                Create("companies.create", "Companies - Create", "Create companies"),
                Create("companies.update", "Companies - Update", "Update companies"),
                Create("companies.delete", "Companies - Delete", "Delete companies"),

                // S3
                Create("s3.read", "S3 - Read", "Read objects from S3"),
                Create("s3.write", "S3 - Write", "Upload objects to S3"),
                Create("s3.delete", "S3 - Delete", "Delete buckets or objects"),
                Create("s3.manage", "S3 - Manage", "Create buckets and manage S3"),

                // Kiosk
                Create("kiosk.admin", "Kiosk - Admin", "Access kiosk admin-only endpoints")
            };
        }

        private static Permission Create(string key, string name, string description)
        {
            return new Permission
            {
                Key = key,
                Name = name,
                Description = description,
                Status = "Active",
                CompanyId = null
            };
        }
    }
}
