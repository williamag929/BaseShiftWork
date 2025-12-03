namespace ShiftWork.Api.DTOs
{
    public class CompanyUserDto
    {
        public string CompanyUserId { get; set; }
        public string Uid { get; set; }
        public string Email { get; set; }
        public string DisplayName { get; set; }
        public string PhotoURL { get; set; }
        public bool EmailVerified { get; set; }
        public string CompanyId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
