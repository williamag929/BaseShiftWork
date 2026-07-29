namespace ShiftWork.Api.DTOs
{
    public class CostCodeDto
    {
        public int CostCodeId { get; set; }
        public string CompanyId { get; set; }
        public string Code { get; set; }
        public string Name { get; set; }
        public string? Description { get; set; }
        public int? LocationId { get; set; }
        public string? ExternalCode { get; set; }
        public string Status { get; set; } = "Active";
    }
}
