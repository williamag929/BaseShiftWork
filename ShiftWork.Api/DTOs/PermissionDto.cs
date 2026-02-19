namespace ShiftWork.Api.DTOs
{
    public class PermissionDto
    {
        public int PermissionId { get; set; }
        public string Key { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Status { get; set; } = "Active";
        public string? CompanyId { get; set; }
    }
}
