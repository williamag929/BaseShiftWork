using System;

namespace ShiftWork.Api.Models
{
    public class UserRole
    {
        public string CompanyUserId { get; set; } = string.Empty;
        public CompanyUser CompanyUser { get; set; } = null!;

        public int RoleId { get; set; }
        public Role Role { get; set; } = null!;

        public string CompanyId { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
