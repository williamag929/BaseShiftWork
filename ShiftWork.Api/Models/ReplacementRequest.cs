using System;
using System.ComponentModel.DataAnnotations;

namespace ShiftWork.Api.Models
{
    public class ReplacementRequest
    {
        [Key]
        public int RequestId { get; set; }
        public int ShiftId { get; set; }
        public string? CompanyId { get; set; }
        public int? InitiatedBy { get; set; }
        public string Status { get; set; } = "Open"; // Open, Accepted, Cancelled
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public int? AcceptedBy { get; set; }
        public DateTime? AcceptedAt { get; set; }
        public string? Notes { get; set; }
    }
}
