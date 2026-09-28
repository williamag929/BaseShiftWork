namespace ShiftWork.Api.DTOs
{
    public class BillingSummaryDto
    {
        public string Tier { get; set; } = "Free";
        public bool IsTrial { get; set; }
        public int TrialDaysRemaining { get; set; }
        public DateTime? TrialEndsAt { get; set; }
        public string? SubscriptionStatus { get; set; }
        public bool HasSubscription { get; set; }
        public DateTime? CurrentPeriodEnd { get; set; }
        public int EmployeeCount { get; set; }
        public int? EmployeeCap { get; set; }
        public bool CanManageBilling { get; set; }
    }

    public class CheckoutSessionRequestDto
    {
        public string Tier { get; set; } = string.Empty;
    }

    public class BillingRedirectDto
    {
        public string Url { get; set; } = string.Empty;
    }
}
