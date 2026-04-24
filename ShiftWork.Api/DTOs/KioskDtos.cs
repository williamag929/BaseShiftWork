using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ShiftWork.Api.DTOs
{
    /// <summary>
    /// Question record returned to both kiosk devices and the mobile app.
    /// </summary>
    public class KioskQuestionDto
    {
        public int QuestionId { get; set; }
        public int CompanyId { get; set; }
        public string QuestionText { get; set; } = string.Empty;
        /// <summary>"text" | "yes_no" | "multiple_choice"</summary>
        public string QuestionType { get; set; } = "yes_no";
        /// <summary>Parsed list of options; populated only for multiple_choice questions.</summary>
        public List<string>? Options { get; set; }
        public bool IsRequired { get; set; }
        public bool IsActive { get; set; }
        public int DisplayOrder { get; set; }
    }

    /// <summary>
    /// Input DTO for creating a new kiosk question (manager-facing).
    /// </summary>
    public class CreateKioskQuestionDto
    {
        [Required, MaxLength(500)]
        public string QuestionText { get; set; } = string.Empty;
        /// <summary>"text" | "yes_no" | "multiple_choice"</summary>
        [Required]
        public string QuestionType { get; set; } = "yes_no";
        /// <summary>Required when QuestionType is "multiple_choice".</summary>
        public List<string>? Options { get; set; }
        public bool IsRequired { get; set; } = false;
        public bool IsActive { get; set; } = true;
        public int DisplayOrder { get; set; } = 0;
    }

    /// <summary>
    /// Input DTO for updating an existing kiosk question (manager-facing).
    /// </summary>
    public class UpdateKioskQuestionDto
    {
        [Required, MaxLength(500)]
        public string QuestionText { get; set; } = string.Empty;
        [Required]
        public string QuestionType { get; set; } = "yes_no";
        public List<string>? Options { get; set; }
        public bool IsRequired { get; set; }
        public bool IsActive { get; set; }
        public int DisplayOrder { get; set; }
    }

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
    /// Lightweight location record used during kiosk setup.
    /// </summary>
    public class KioskLocationDto
    {
        public int LocationId { get; set; }
        public string CompanyId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Address { get; set; }
        public bool IsActive { get; set; }
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
