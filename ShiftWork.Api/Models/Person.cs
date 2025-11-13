using System.Collections.Generic;
using ShiftWork.Api.Data;
using AuditInterceptor = ShiftWork.Api.Data.AuditInterceptor;

namespace ShiftWork.Api.Models
{
    public class Person : BaseEntity
    {
        public int PersonId { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public string CompanyId { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Address { get; set; }
        public string? Pin { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? Region { get; set; }
        public string? Street { get; set; }
        public string? Building { get; set; }
        public string? Floor { get; set; }   
        public string Status { get; set; } = "Active"; // Default status
        // Real-time shift status (e.g., OnShift, OffShift). Updated via ShiftEvents/PeopleService.
        public string? StatusShiftWork { get; set; }
        public string? PhotoUrl { get; set; }
        public string? ExternalCode { get; set; }
        public DateTime? LastUpdatedAt { get; set; } = DateTime.UtcNow; // Default to current time
        public string? LastUpdatedBy { get; set; } = "User";// Default to 'User' or any other default value you prefer
        public int? RoleId { get; set; } // Optional, if this person has a specific role
        public Company Company { get; set; }
        public ICollection<PersonCrew> PersonCrews { get; set; }

        // PTO configuration (MVP): optional per-person accrual and starting balance
        public decimal? PtoAccrualRatePerMonth { get; set; } // hours per month
        public decimal? PtoStartingBalance { get; set; } // initial hours
        public DateTime? PtoStartDate { get; set; } // accrual start date
        public DateTime? PtoLastAccruedAt { get; set; } // last time accrual entries were generated
    }
}