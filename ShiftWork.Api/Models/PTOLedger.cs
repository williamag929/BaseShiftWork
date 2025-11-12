using System;

namespace ShiftWork.Api.Models
{
    public class PTOLedger
    {
        public int PTOLedgerId { get; set; }
        public string CompanyId { get; set; } = string.Empty;
        public int PersonId { get; set; }
        public DateTime EntryDate { get; set; } = DateTime.UtcNow;
        public decimal HoursChange { get; set; } // +accrual, -usage
        public string Reason { get; set; } = string.Empty; // e.g., Accrual 2025-11, TimeOff:123, Adjustment
        public decimal BalanceAfter { get; set; }

        public Person? Person { get; set; }
    }
}
