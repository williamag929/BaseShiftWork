using System;

namespace ShiftWork.Api.DTOs
{
    public class CompanyUserProfileDto
    {
        public int ProfileId { get; set; }
        public string CompanyUserId { get; set; }
        public string CompanyId { get; set; }
        public int RoleId { get; set; }
        public int? PersonId { get; set; }
        public bool IsActive { get; set; }
        public DateTime AssignedAt { get; set; }
        public string? AssignedBy { get; set; }
        
        // Navigation properties (for read operations)
        public RoleDto? Role { get; set; }
        public PersonDto? Person { get; set; }
    }

    public class AssignRoleRequest
    {
        public string CompanyUserId { get; set; }
        public int RoleId { get; set; }
        public int? PersonId { get; set; }
    }

    public class AssignRoleToPersonRequest
    {
        public int PersonId { get; set; }
        public int RoleId { get; set; }
    }
}
