using System;
using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    public class DailyReportDto
    {
        public Guid ReportId { get; set; }
        public string CompanyId { get; set; }
        public int LocationId { get; set; }
        public DateOnly ReportDate { get; set; }
        public object? WeatherData { get; set; }   // deserialized WeatherSnapshot
        public string? Notes { get; set; }
        public int TotalEmployees { get; set; }
        public decimal TotalHours { get; set; }
        public string Status { get; set; }
        public int? SubmittedByPersonId { get; set; }
        public List<ReportMediaDto> Media { get; set; } = new();
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class ReportMediaDto
    {
        public Guid MediaId { get; set; }
        public string MediaType { get; set; }
        public string MediaUrl { get; set; }
        public string? Caption { get; set; }
        public int PersonId { get; set; }
        public string? PersonName { get; set; }
        public DateTime UploadedAt { get; set; }
    }

    public class UpdateDailyReportDto
    {
        public string? Notes { get; set; }
        public string Status { get; set; } = "Draft";
    }
}
