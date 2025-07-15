using System;
using ShiftWork.Api.Data;

namespace ShiftWork.Api.Models
{
    public class ScheduleShift : BaseEntity
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
        public Schedule Schedule { get; set; }
        public Person Person { get; set; }
        public TaskShift TaskShift { get; set; }
        public Location Location { get; set; }
        public Area Area { get; set; }
        public Company Company { get; set; }

    }
}