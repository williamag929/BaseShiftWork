using System;

namespace ShiftWork.Api.DTOs
{
    public class ScheduleShiftSummaryDto
    {
        public DateTime Day { get; set; }
        public int PersonId { get; set; }
        public string PersonName { get; set; }
        public int LocationId { get; set; }
        public string LocationName { get; set; }
        public int AreaId { get; set; }
        public string AreaName { get; set; }
        public DateTime MinStartTime { get; set; }
        public DateTime MaxEndTime { get; set; }
        public double BreakTime { get; set; }
        public double TotalHours { get; set; }
    }
}
