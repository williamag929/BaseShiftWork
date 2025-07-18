namespace ShiftWork.Api.DTOs
{
    public class TaskShiftDto
    {
        public int TaskShiftId { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public string CompanyId { get; set; }  
        public int? LocationId { get; set; }
        public int? AreaId { get; set; }
        public string CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public string UpdatedBy { get; set; }
        public DateTime UpdatedAt { get; set; }
        // Depending on needs, you might include related Location or Area names or IDs for convenience
        // But generally, avoid including full related entity objects in DTOs.
        // public int? LocationId { get; set; } 
        // public int? AreaId { get; set; }
    }
}