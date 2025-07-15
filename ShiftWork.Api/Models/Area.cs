namespace ShiftWork.Api.Models
{
    public class Area
    {
        public int AreaId { get; set; }
        public string Name { get; set; }
        public string CompanyId { get; set; }
        public int LocationId { get; set; }
        public Location Location { get; set; }      
    }
}