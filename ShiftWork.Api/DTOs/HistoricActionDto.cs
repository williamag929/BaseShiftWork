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
}
