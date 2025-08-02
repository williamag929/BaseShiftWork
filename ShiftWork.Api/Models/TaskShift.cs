using ShiftWork.Api.Data;
using AuditInterceptor = ShiftWork.Api.Data.AuditInterceptor;

namespace ShiftWork.Api.Models
{
    public class TaskShift : BaseEntity
    {
        public int TaskShiftId { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public string CompanyId { get; set; }
        public string Status { get; set; }
        public int? LocationId { get; set; }
        public int? AreaId { get; set; }
        public string? CreatedBy { get; set; }
        public int? PersonId { get; set; }
        public DateTime? CreatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public Company Company { get; set; }
        public String? LastUpdatedBy { get; set; } // Track who last updated the task shift
        public DateTime? LastUpdatedAt { get; set; } // Track when the task shift was last updated
    
    }
}