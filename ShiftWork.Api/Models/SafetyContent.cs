using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShiftWork.Api.Models
{
    public class SafetyContent
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid SafetyContentId { get; set; }

        public string CompanyId { get; set; }
        public int? LocationId { get; set; }         // null = company-wide

        public string Title { get; set; }
        public string Description { get; set; }

        // ToolboxTalk | SafetyDataSheet | Orientation | InstructionalVideo | Training
        public string Type { get; set; } = "ToolboxTalk";

        public string? ContentUrl { get; set; }      // S3 key for PDF or video
        public string? TextContent { get; set; }     // inline text for toolbox talks
        public string? ThumbnailUrl { get; set; }    // S3 key
        public int? DurationMinutes { get; set; }    // for videos

        public bool IsAcknowledgmentRequired { get; set; } = true;

        public DateTime? ScheduledFor { get; set; }  // triggers push notification at this time
        public bool NotificationSent { get; set; } = false; // tracked by IHostedService scheduler

        public string? Tags { get; set; }            // JSON string[]

        public int CreatedByPersonId { get; set; }

        public string Status { get; set; } = "Draft"; // Draft | Published | Archived

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public Person CreatedBy { get; set; }
        public Location? Location { get; set; }
        public ICollection<SafetyAcknowledgment> Acknowledgments { get; set; } = new List<SafetyAcknowledgment>();
    }
}
