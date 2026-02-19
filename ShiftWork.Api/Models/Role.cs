namespace ShiftWork.Api.Models
{
    public class Role
    {
        public int RoleId { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        
        /// <summary>
        /// DEPRECATED: Use RolePermission table instead. This field is maintained for backward compatibility only.
        /// </summary>
        [System.Obsolete("Use RolePermission table instead. String-based permissions are deprecated.", false)]
        public string? Permissions { get; set; } // JSON or comma-separated permissions
        public string Status { get; set; } = "Active"; // Default status
        public string CompanyId { get; set; }
        public Company Company { get; set; }
        public ICollection<Person> People { get; set; }
    }
}