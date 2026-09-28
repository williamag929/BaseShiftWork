using System;
using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    /// <summary>Live "who's on site" roster for a single job site, used by the Active Sites dashboard.</summary>
    public class ActiveSiteStatusDto
    {
        public int LocationId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public int OnShiftCount { get; set; }
        public List<ActiveSiteRosterEntryDto> Roster { get; set; } = new();
    }

    public class ActiveSiteRosterEntryDto
    {
        public int PersonId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? PhotoUrl { get; set; }
        public string? RoleName { get; set; }
        public DateTime ClockInTime { get; set; }
        /// <summary>"Late" | "Early" | "OnTime" | "NoSchedule", parsed from Person.StatusShiftWork.</summary>
        public string TimingStatus { get; set; } = string.Empty;
        /// <summary>"Inside" | "Outside" | "Unknown".</summary>
        public string GeofenceStatus { get; set; } = string.Empty;
        public double? GeofenceDistanceMeters { get; set; }
        public bool GeofenceReviewed { get; set; }
        public Guid ShiftEventId { get; set; }
    }
}
