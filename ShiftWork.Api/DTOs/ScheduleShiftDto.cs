namespace ShiftWork.Api.DTOs
{
    public class ScheduleShiftDto
    {
        public int ScheduleShiftId { get; set; }
        public int ScheduleId { get; set; }
        public string CompanyId { get; set; }
        public int LocationId { get; set; }
        public int AreaId { get; set; }
        public int PersonId { get; set; }
        public int TaskShiftId { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string GeoLocation { get; set; }
        public string Notes { get; set; }
        public string Status { get; set; }
        public string CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public string UpdatedBy { get; set; }
        public DateTime UpdatedAt { get; set; }
        // It's usually unnecessary to include the full related entities in the DTO, as you'd likely fetch them separately if needed.
        // If you *do* need a few key properties, you might create smaller, nested DTOs (e.g., LocationSummaryDto with just ID and Name).
        // public Schedule Schedule { get; set; }  
        // public Person Person { get; set; }
        // public TaskShift TaskShift { get; set; }
        // public Location Location { get; set; }
        // public Area Area { get; set; }
        // public Company Company { get; set; }
    }
}