namespace ShiftWork.Api.Models
{
    public class CompanyUserProfile
    {
        public string CompanyUserId { get; set; } = string.Empty;
        public CompanyUser CompanyUser { get; set; } = null!;

        public int PersonId { get; set; }
        public Person Person { get; set; } = null!;

        public string CompanyId { get; set; } = string.Empty;
    }
}
