using System;

namespace ShiftWork.Api.DTOs
{
    public class ReplacementRequestDto
    {
        public int RequestId { get; set; }
        public int ShiftId { get; set; }
        public string? CompanyId { get; set; }
        public int? InitiatedBy { get; set; }
        public string Status { get; set; } = "Open";
        public DateTime CreatedAt { get; set; }
        public int? AcceptedBy { get; set; }
        public DateTime? AcceptedAt { get; set; }
        public string? Notes { get; set; }
    }

    public class CreateReplacementRequestDto
    {
        public int ShiftId { get; set; }
        public string? Notes { get; set; }
    }

    public class NotifyReplacementDto
    {
        public int[] PersonIds { get; set; } = Array.Empty<int>();
        public string? Channel { get; set; } = "push"; // push, sms, email
    }

    public class AcceptReplacementDto
    {
        public int PersonId { get; set; }
    }
}
