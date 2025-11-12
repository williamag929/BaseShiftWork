using System;

namespace ShiftWork.Api.DTOs
{
    public class TimeOffRequestDto
    {
        public int TimeOffRequestId { get; set; }
        public string? CompanyId { get; set; }
        public int PersonId { get; set; }
        public string? PersonName { get; set; }
        public string Type { get; set; } = "Vacation";
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public bool IsPartialDay { get; set; }
        public TimeSpan? PartialStartTime { get; set; }
        public TimeSpan? PartialEndTime { get; set; }
        public string? Reason { get; set; }
        public string Status { get; set; } = "Pending";
        public DateTime CreatedAt { get; set; }
        public int? ApprovedBy { get; set; }
        public string? ApproverName { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? ApprovalNotes { get; set; }
        public decimal? HoursRequested { get; set; }
        public decimal? PtoBalanceBefore { get; set; }
        public decimal? PtoBalanceAfter { get; set; }
    }

    public class CreateTimeOffRequestDto
    {
        public int PersonId { get; set; }
        public string Type { get; set; } = "Vacation";
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public bool IsPartialDay { get; set; }
        public TimeSpan? PartialStartTime { get; set; }
        public TimeSpan? PartialEndTime { get; set; }
        public string? Reason { get; set; }
    }

    public class ApproveTimeOffRequestDto
    {
        public bool Approved { get; set; }
        public string? Notes { get; set; }
    }
}
