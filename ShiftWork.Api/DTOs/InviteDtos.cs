namespace ShiftWork.Api.DTOs
{
    /// <summary>
    /// Request to send app invite to an employee
    /// </summary>
    public class SendInviteRequest
    {
        public List<int> RoleIds { get; set; } = new List<int>();
        public string? InviteUrl { get; set; } // Optional custom URL for invite acceptance page
    }

    /// <summary>
    /// Request to complete invite after Firebase account creation
    /// </summary>
    public class CompleteInviteRequest
    {
        public string InviteToken { get; set; }
        public int PersonId { get; set; }
    }

    /// <summary>
    /// Response for invite status
    /// </summary>
    public class InviteStatusResponse
    {
        public bool HasAppAccess { get; set; }
        public string Status { get; set; } // "None", "Pending", "Active"
        public CompanyUserDto? CompanyUser { get; set; }
        public List<CompanyUserProfileDto> Profiles { get; set; } = new List<CompanyUserProfileDto>();
    }

    /// <summary>
    /// Response after sending invite
    /// </summary>
    public class SendInviteResponse
    {
        public string InviteToken { get; set; }
        public string InviteUrl { get; set; }
        public DateTime ExpiresAt { get; set; }
        public CompanyUserDto PendingUser { get; set; }
    }
}
