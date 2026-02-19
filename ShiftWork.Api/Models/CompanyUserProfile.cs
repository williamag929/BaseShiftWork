using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using ShiftWork.Api.Data;

namespace ShiftWork.Api.Models
{
    /// <summary>
    /// Represents the roles and permissions for a user within a specific company.
    /// A user can have multiple profiles (roles) per company.
    /// </summary>
    public class CompanyUserProfile : BaseEntity
    {
        [Key]
        public int ProfileId { get; set; }

        [Required]
        public string CompanyUserId { get; set; }

        [Required]
        public string CompanyId { get; set; }

        [Required]
        public int RoleId { get; set; }

        /// <summary>
        /// Optional: Link to Person if this profile is associated with an employee
        /// </summary>
        public int? PersonId { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

        public string? AssignedBy { get; set; }

        // Navigation properties
        [ForeignKey("CompanyUserId")]
        public CompanyUser CompanyUser { get; set; }

        [ForeignKey("CompanyId")]
        public Company Company { get; set; }

        [ForeignKey("RoleId")]
        public Role Role { get; set; }

        [ForeignKey("PersonId")]
        public Person? Person { get; set; }
    }
}
