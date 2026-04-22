using System;
using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    /// <summary>
    /// Lightweight employee record returned to a kiosk device (no PII beyond name/photo).
    /// </summary>
    public class KioskEmployeeDto
    {
        public int PersonId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? PhotoUrl { get; set; }
        /// <summary>Current real-time shift status, e.g. "OnShift", "OffShift".</summary>
        public string? StatusShiftWork { get; set; }
    }

    /// <summary>
    /// Request body for the anonymous kiosk clock-in/out endpoint.
    /// </summary>
    public class KioskClockRequest
    {
        public int PersonId { get; set; }
        /// <summary>"ClockIn" or "ClockOut"</summary>
        public string EventType { get; set; } = string.Empty;
        public int? LocationId { get; set; }
        public string? PhotoUrl { get; set; }
        public string? GeoLocation { get; set; }
        public string? KioskDevice { get; set; }
        public List<KioskAnswerRequest>? Answers { get; set; }
    }

    /// <summary>
    /// A single kiosk question answer embedded in a KioskClockRequest.
    /// </summary>
    public class KioskAnswerRequest
    {
        public int KioskQuestionId { get; set; }
        public string AnswerText { get; set; } = string.Empty;
    }

    /// <summary>
    /// Response after a successful kiosk clock action.
    /// </summary>
    public class KioskClockResponse
    {
        public Guid EventLogId { get; set; }
        public string EventType { get; set; } = string.Empty;
        public DateTime EventDate { get; set; }
        public string PersonName { get; set; } = string.Empty;
    }

    /// <summary>
    /// Payload returned to the kiosk after a clock-out, containing any
    /// urgent bulletins and pending safety items the employee should see.
    /// Capped at 3 items each to keep the interstitial flow short.
    /// </summary>
    public class PostClockoutDto
    {
        public List<KioskBulletinDto> UrgentBulletins { get; set; } = new();
        public List<KioskSafetyDto> PendingSafety { get; set; } = new();
    }

    public class KioskBulletinDto
    {
        public Guid BulletinId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
    }

    public class KioskSafetyDto
    {
        public Guid SafetyContentId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? TextContent { get; set; }
        public string Type { get; set; } = string.Empty;
        public bool IsAcknowledgmentRequired { get; set; }
    }
}
