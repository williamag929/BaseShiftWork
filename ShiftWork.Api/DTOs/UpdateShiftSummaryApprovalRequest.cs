using System;

namespace ShiftWork.Api.DTOs
{
    public class UpdateShiftSummaryApprovalRequest
    {
        public int PersonId { get; set; }
        public DateTime Day { get; set; }
        // not_shifted | shifted | approved | avoid
        public string Status { get; set; } = "shifted";
        public int? ApprovedBy { get; set; }
        public string? Notes { get; set; }
    }
}
