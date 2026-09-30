using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    public record LineupAssignmentDto(int PersonId, int LocationId, int? AreaId, string? Start, string? End, bool AcceptWarnings);
    public record LineupCommitRequest(string Date, List<LineupAssignmentDto>? Assignments, List<int>? Removals);

    public class LineupCommitResultDto
    {
        public string Status { get; set; } = string.Empty;
        public int? PersonId { get; set; }
        public int? LocationId { get; set; }
        public int? ShiftId { get; set; }
        public List<string> Errors { get; set; } = new();
        public List<string> Warnings { get; set; } = new();
    }

    public record LineupCommitResponse(List<LineupCommitResultDto> Results);
}
