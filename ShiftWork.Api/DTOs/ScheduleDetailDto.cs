using System;

namespace ShiftWork.Api.DTOs
{
    public class ScheduleDetailDto
    {
        public int ScheduleId { get; set; }
        public string Name { get; set; }
        public string CompanyId { get; set; }
        public int PersonId { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string? Description { get; set; }
        public string Status { get; set; }
        public string? Settings { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? CreatedAt { get; set; }
        public string? ExternalCode { get; set; }
        public string? TimeZone { get; set; }
        public string? Color { get; set; }
        public string? Type { get; set; }

        public LocationDto Location { get; set; }
        public AreaDto Area { get; set; }
    }
}