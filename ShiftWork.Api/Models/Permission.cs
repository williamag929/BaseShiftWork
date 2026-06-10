using System.Collections.Generic;

namespace ShiftWork.Api.Models
{
    public class Permission
    {
        public int PermissionId { get; set; }
        public string Key { get; set; }
        public string Name { get; set; }
        public string? Description { get; set; }
        public string Status { get; set; } = "Active";
        public string? CompanyId { get; set; }

        public ICollection<RolePermission> RolePermissions { get; set; }
    }
}
