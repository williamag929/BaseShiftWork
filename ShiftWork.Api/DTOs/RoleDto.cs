using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    public class RoleDto
    {
        public int RoleId { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public ICollection<string>? Permissions { get; set; }
        public string Status { get; set; } = "Active"; // Default status    
        public string CompanyId { get; set; }
    }
}