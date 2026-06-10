using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    public class UnpublishedSchedulePersonDto
    {
        public int PersonId { get; set; }
        public string Name { get; set; }
        public string? Email { get; set; }
        public int UnpublishedScheduleCount { get; set; }
        public List<int> ScheduleIds { get; set; } = new List<int>();
    }
}
