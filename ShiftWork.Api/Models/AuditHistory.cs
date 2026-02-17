using System;

namespace ShiftWork.Api.Models
{
    public class AuditHistory
    {
        public Guid Id { get; set; }
        public string CompanyId { get; set; }
        public string EntityName { get; set; }
        public string EntityId { get; set; }
        public string ActionType { get; set; } // "Created", "Updated", "Deleted"
        public DateTime ActionDate { get; set; }
        public string UserId { get; set; }
        public string? UserName { get; set; }
        public string? FieldName { get; set; }
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
        public string? ChangeDescription { get; set; }
        public string? Metadata { get; set; }
    }
}
