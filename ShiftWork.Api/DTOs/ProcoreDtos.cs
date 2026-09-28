using System;

namespace ShiftWork.Api.DTOs
{
    /// <summary>
    /// Safe read view of a Procore connection. Secrets are never returned — only whether they are set.
    /// </summary>
    public class ProcoreConnectionDto
    {
        public string CompanyId { get; set; }
        public string? ProcoreCompanyId { get; set; }
        public string? ClientId { get; set; }
        public bool HasClientSecret { get; set; }
        public string BaseUrl { get; set; }
        public string TokenUrl { get; set; }
        public bool Enabled { get; set; }
        public bool AutoPushOnSubmit { get; set; }
        public bool TimesheetSyncEnabled { get; set; }
        public DateTime? LastSyncAt { get; set; }
        public string? LastSyncStatus { get; set; }
    }

    /// <summary>
    /// Write model for creating/updating a connection. Leave ClientSecret null to keep the existing one.
    /// </summary>
    public class ProcoreConnectionInputDto
    {
        public string? ProcoreCompanyId { get; set; }
        public string? ClientId { get; set; }
        public string? ClientSecret { get; set; }
        public string? BaseUrl { get; set; }
        public string? TokenUrl { get; set; }
        public bool Enabled { get; set; }
        public bool AutoPushOnSubmit { get; set; } = true;
        public bool TimesheetSyncEnabled { get; set; } = false;
    }

    public class ProcoreSyncResultDto
    {
        public bool Success { get; set; }
        /// <summary>Pushed | Skipped | Failed</summary>
        public string Status { get; set; }
        public string? Message { get; set; }
        public string? ProcoreProjectId { get; set; }
        public int? Workers { get; set; }
        public decimal? Hours { get; set; }
    }
}
