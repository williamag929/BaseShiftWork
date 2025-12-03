namespace ShiftWork.Api.DTOs
{
    public class AreaDto
    {
        public int AreaId { get; set; }
        public string Name { get; set; }
        public string CompanyId { get; set; }
        public int LocationId { get; set; }  // Assuming LocationId is always required. If not, change to int?
        public string Status { get; set; }
        // Add other Area properties as needed, e.g., Description, Settings, etc.
    }
}