using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    public class UserRolesUpdateDto
    {
        public List<int> RoleIds { get; set; } = new();
    }
}
