using System.ComponentModel.DataAnnotations;

namespace ShiftWork.Api.DTOs
{
    /// <summary>
    /// Request body for POST /api/auth/register.
    /// The caller must include a valid Firebase ID token in Authorization: Bearer {token}.
    /// FirebaseUid must match the JWT sub claim (validated server-side).
    /// </summary>
    public class CompanyRegistrationRequest
    {
        // --- User fields ---
        /// <summary>Firebase UID — must match the JWT sub claim. Alphanumeric, 1–128 chars.</summary>
        [Required]
        [StringLength(128, MinimumLength = 1)]
        [RegularExpression(@"^[a-zA-Z0-9_-]+$",
            ErrorMessage = "FirebaseUid must be alphanumeric (may include _ and -).")]
        public string FirebaseUid { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string UserEmail { get; set; } = string.Empty;

        [Required]
        [StringLength(200, MinimumLength = 1)]
        public string UserDisplayName { get; set; } = string.Empty;

        // --- Company fields ---
        [Required]
        [StringLength(200, MinimumLength = 1)]
        public string CompanyName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string CompanyEmail { get; set; } = string.Empty;

        [Phone]
        public string? CompanyPhone { get; set; }

        [Required]
        [StringLength(100, MinimumLength = 1)]
        public string TimeZone { get; set; } = "UTC";
    }

    /// <summary>
    /// Response from POST /api/auth/register.
    /// </summary>
    public class CompanyRegistrationResponse
    {
        public string CompanyId { get; set; } = string.Empty;
        public string Plan { get; set; } = "Free";
        public string OnboardingStatus { get; set; } = "Pending";
        public CompanyUserDto AdminUser { get; set; } = null!;
    }

    /// <summary>
    /// Request body for POST /api/companies/{companyId}/sandbox/hide.
    /// EntityTypes: "Person", "Area", "Location", or "All".
    /// </summary>
    public class SandboxHideRequest
    {
        public List<string> EntityTypes { get; set; } = new() { "All" };
    }

    /// <summary>
    /// Response from GET /api/companies/{companyId}/sandbox/status.
    /// </summary>
    public class SandboxStatusResponse
    {
        public bool HasSandboxData { get; set; }
        public int SandboxPersonCount { get; set; }
        public int SandboxAreaCount { get; set; }
        public int SandboxLocationCount { get; set; }
    }

    /// <summary>
    /// Request body for POST /api/companies/{companyId}/plan/upgrade.
    /// </summary>
    public class PlanUpgradeRequest
    {
        public string StripePaymentMethodId { get; set; } = string.Empty;
        public string TargetPlan { get; set; } = "Pro";
    }

    /// <summary>
    /// Response from POST /api/companies/{companyId}/plan/upgrade.
    /// </summary>
    public class PlanUpgradeResponse
    {
        public bool Success { get; set; }
        public string Plan { get; set; } = string.Empty;
        public string? StripeSubscriptionId { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    /// <summary>
    /// Request body for PATCH /api/companies/{companyId}/onboarding-status.
    /// Valid values: "Pending", "Verified", "Complete".
    /// </summary>
    public class PatchOnboardingStatusRequest
    {
        [Required]
        [RegularExpression("^(Pending|Verified|Complete)$",
            ErrorMessage = "Status must be Pending, Verified, or Complete.")]
        public string Status { get; set; } = string.Empty;
    }
}
