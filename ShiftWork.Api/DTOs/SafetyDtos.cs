using System;
using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    public class SafetyContentDto
    {
        public Guid SafetyContentId { get; set; }
        public string CompanyId { get; set; }
        public int? LocationId { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public string Type { get; set; }
        public string? ContentUrl { get; set; }
        public string? TextContent { get; set; }
        public string? ThumbnailUrl { get; set; }
        public int? DurationMinutes { get; set; }
        public bool IsAcknowledgmentRequired { get; set; }
        public DateTime? ScheduledFor { get; set; }
        public List<string>? Tags { get; set; }
        public string Status { get; set; }
        public string CreatedByName { get; set; }
        public bool IsAcknowledgedByCurrentUser { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class AcknowledgmentStatusDto
    {
        public int TotalAssigned { get; set; }
        public int TotalCompleted { get; set; }
        public double CompletionRate { get; set; }
        public List<PersonAckDto> Completed { get; set; } = new();
        public List<PersonAckDto> Pending { get; set; } = new();
    }

    public class PersonAckDto
    {
        public int PersonId { get; set; }
        public string Name { get; set; }
        public DateTime? AcknowledgedAt { get; set; }
    }

    public class CreateSafetyContentDto
    {
        public string Title { get; set; }
        public string Description { get; set; }
        public string Type { get; set; } = "ToolboxTalk";
        public int? LocationId { get; set; }
        public string? ContentUrl { get; set; }
        public string? TextContent { get; set; }
        public string? ThumbnailUrl { get; set; }
        public int? DurationMinutes { get; set; }
        public bool IsAcknowledgmentRequired { get; set; } = true;
        public DateTime? ScheduledFor { get; set; }
        public List<string>? Tags { get; set; }
        public string Status { get; set; } = "Draft";
    }

    public class UpdateSafetyContentDto : CreateSafetyContentDto { }

    public class AcknowledgeDto
    {
        public string? Notes { get; set; }
    }
}
