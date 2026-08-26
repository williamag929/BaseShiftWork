using System;

namespace ShiftWork.Api.DTOs
{
    public class ShiftEventDto
    {
        public Guid EventLogId { get; set; }
        public DateTime EventDate { get; set; }
        public string? EventType { get; set; }
        public string? CompanyId { get; set; }
        public int PersonId { get; set; }
        public string? EventObject { get; set; }
        public string? Description { get; set; }
        public string? KioskDevice { get; set; }
        public string? GeoLocation { get; set; }
        public string? PhotoUrl { get; set; }

        /// <summary>Job site to geofence-check this event against. Optional on input (resolved
        /// server-side from the person's schedule when omitted, e.g. by mobile clients); always
        /// populated on output once resolved.</summary>
        public int? LocationId { get; set; }
        /// <summary>Output only: "Inside" | "Outside" | "Unknown".</summary>
        public string? GeofenceStatus { get; set; }
        public double? GeofenceDistanceMeters { get; set; }
        public DateTime? GeofenceReviewedAt { get; set; }
        public int? GeofenceReviewedByPersonId { get; set; }
    }
}
