using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class DeprecateLegacyFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // DEPRECATION NOTICE:
            // Person.RoleId and Role.Permissions are deprecated as of this migration.
            // 
            // Legacy fields retained for backward compatibility:
            // - Person.RoleId: Replaced by UserRole join table for multi-role support
            // - Role.Permissions: Replaced by RolePermission join table with Permission registry
            //
            // Migration Strategy:
            // 1. Old code paths reading Person.RoleId or Role.Permissions are no longer maintained
            // 2. New code uses UserRole and RolePermission tables exclusively
            // 3. Database columns retained to allow graceful migration of existing data
            // 4. Applications should migrate to new RBAC model:
            //    - Use UserRole table for user role assignments (replaces Person.RoleId)
            //    - Use RolePermission + Permission tables for permissions (replaces Role.Permissions)
            //    - Use RolesController endpoints: GET /roles/{id}/permissions, PUT /roles/{id}/permissions
            //
            // No schema changes in this migration; deprecation is code-level only.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
