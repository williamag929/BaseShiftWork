using System;

namespace ShiftWork.Api.DTOs
{
    public class HistoricActionDto
    {
        public Guid Id { get; set; }
        public DateTime ActionDate { get; set; }
        public string ActionType { get; set; }
        public string Description { get; set; }
        public string? Metadata { get; set; }
    }

    public class HistoricActionsPageDto
    {
        public int TotalCount { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
        public List<HistoricActionDto> Actions { get; set; } = new();
    }

    public class AuditHistoryDto : HistoricActionDto
    {
        public string EntityName { get; set; }
        public string EntityId { get; set; }
        public string UserId { get; set; }
        public string? UserName { get; set; }
        public string? FieldName { get; set; }
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
    }

    public class AuditSummaryDto
    {
        public string EntityName { get; set; }
        public int TotalChanges { get; set; }
        public DateTime LastModified { get; set; }
        public string LastModifiedBy { get; set; }
    }
}
