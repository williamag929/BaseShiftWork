using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShiftWork.Api.Models
{
    public class LocationDailyReport
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid ReportId { get; set; }

        public string CompanyId { get; set; }
        public int LocationId { get; set; }
        public DateOnly ReportDate { get; set; }

        public string? WeatherDataJson { get; set; }  // serialized WeatherSnapshot
        public string? Notes { get; set; }

        // Snapshotted on Submit; computed live while Status = Draft
        public int TotalEmployees { get; set; }
        public decimal TotalHours { get; set; }

        public string Status { get; set; } = "Draft"; // Draft | Submitted | Approved

        public int? SubmittedByPersonId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public Location Location { get; set; }
        public ICollection<ReportMedia> Media { get; set; } = new List<ReportMedia>();
    }
}
