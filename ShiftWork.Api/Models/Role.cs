namespace ShiftWork.Api.Models
{
    public class Role
    {
        public int RoleId { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public string? Permissions { get; set; } // JSON or comma-separated permissions
        public string Status { get; set; } = "Active"; // Default status
        public string CompanyId { get; set; }
        public Company Company { get; set; }
    }
}