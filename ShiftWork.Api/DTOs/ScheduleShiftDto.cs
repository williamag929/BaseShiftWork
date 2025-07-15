namespace ShiftWork.Api.DTOs
{
    public class ScheduleShiftDto
    {
        public int ScheduleShiftId { get; set; }
        public int ScheduleId { get; set; }
        public string CompanyId { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
    }
}