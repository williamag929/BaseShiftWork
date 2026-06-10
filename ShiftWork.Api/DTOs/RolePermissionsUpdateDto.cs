using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    public class RolePermissionsUpdateDto
    {
        public int RoleId { get; set; }
        public List<string> PermissionKeys { get; set; } = new();
    }
}
