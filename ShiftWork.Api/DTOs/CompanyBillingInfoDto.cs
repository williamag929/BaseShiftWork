namespace ShiftWork.Api.DTOs
{
    public class CompanyBillingInfoDto
    {
        public string CompanyId { get; set; }
        public string Name { get; set; }
        public string Plan { get; set; }
        public int TrialDaysRemaining { get; set; }
        public DateTime? PlanExpiresAt { get; set; }
        public int EmployeeCount { get; set; }
        public int EmployeeLimit { get; set; }
        public bool IsTrialExpired { get; set; }
    }
}
