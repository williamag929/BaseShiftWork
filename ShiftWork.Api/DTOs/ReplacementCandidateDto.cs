using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    public class ReplacementCandidateDto
    {
        public int PersonId { get; set; }
        public string Name { get; set; } = string.Empty;
        public List<string>? Reasons { get; set; }
        public double? Score { get; set; }
    }
}
