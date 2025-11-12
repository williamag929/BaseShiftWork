using System;
using System.ComponentModel.DataAnnotations;

namespace ShiftWork.Api.Models
{
    public class TimeOffRequest
    {
        [Key]
        public int TimeOffRequestId { get; set; }
        public string? CompanyId { get; set; }
        public int PersonId { get; set; }
        public string Type { get; set; } = "Vacation"; // Vacation, Sick, PTO, Unpaid, Personal
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public bool IsPartialDay { get; set; } = false;
        public TimeSpan? PartialStartTime { get; set; }
        public TimeSpan? PartialEndTime { get; set; }
        public string? Reason { get; set; }
        public string Status { get; set; } = "Pending"; // Pending, Approved, Denied, Cancelled
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public int? ApprovedBy { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? ApprovalNotes { get; set; }
        public decimal? HoursRequested { get; set; }
        public decimal? PtoBalanceBefore { get; set; }
        public decimal? PtoBalanceAfter { get; set; }
        
        // Navigation properties
        public Person? Person { get; set; }
        public Person? Approver { get; set; }
        public Company? Company { get; set; }
    }
}
