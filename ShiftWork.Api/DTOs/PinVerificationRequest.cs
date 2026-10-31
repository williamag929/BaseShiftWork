namespace ShiftWork.Api.DTOs
{
    /// <summary>Body of the deprecated POST /api/auth/verify-pin.</summary>
    public class PinVerificationRequest
    {
        public int PersonId { get; set; }
        public string Pin { get; set; }

        /// <summary>Optional: when sent, the person must belong to this company.</summary>
        public string? CompanyId { get; set; }
    }

    /// <summary>Body of POST /api/companies/{companyId}/people/{personId}/verify-pin.</summary>
    public class CompanyPinVerificationRequest
    {
        public string Pin { get; set; } = string.Empty;
    }

    public class PinVerificationResponse
    {
        public bool Verified { get; set; }
    }
}
