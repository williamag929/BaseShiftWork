namespace ShiftWork.Api.Models
{
    // No FKs on purpose: matches how CompanyUser/Location are linked elsewhere and keeps deletes cheap.
    public class UserLocationScope
    {
        public int UserLocationScopeId { get; set; }
        public string CompanyId { get; set; } = string.Empty;
        public string CompanyUserId { get; set; } = string.Empty; // CompanyUser.CompanyUserId is a string
        public int LocationId { get; set; }
    }
}
