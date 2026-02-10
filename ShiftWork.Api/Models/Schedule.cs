using System.Collections.Generic;

namespace ShiftWork.Api.Models
{
    public class Schedule
    {
        public int ScheduleId { get; set; }
        public string Name { get; set; }
        public string? CompanyId { get; set; }  // Make CompanyId nullable
        public string PersonId { get; set; }
        public string? CrewId { get; set; }
        public string? TaskShiftId { get; set; }
        public int? LocationId { get; set; }  // Change to int?
        public int? AreaId { get; set; }
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
        public string? VoidedBy { get; set; }
        public DateTime? VoidedAt { get; set; }
        public Company Company { get; set; }
        public Location Location { get; set; }
        public Area Area { get; set; }
        public ICollection<ScheduleShift> ScheduleShifts { get; set; }
    }
}