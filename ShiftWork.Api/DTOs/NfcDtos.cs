using System;

namespace ShiftWork.Api.DTOs
{
    /// <summary>One site as listed on the Mobile "Write tag" screen.</summary>
    public class NfcTagLinkDto
    {
        public int LocationId { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool RequireNfc { get; set; }
        /// <summary>Null until the site has a tag key.</summary>
        public string? TagUrl { get; set; }
        public DateTime? NfcLastTappedAt { get; set; }
    }

    public class NfcPunchRequest
    {
        public string TagKey { get; set; } = string.Empty;
        /// <summary>Client-generated id; a retry with the same id returns the original punch.</summary>
        public Guid EventLogId { get; set; }
        /// <summary>Tap time (UTC). Within 7 days back / 5 minutes ahead; defaults to server time.</summary>
        public DateTime? EventDate { get; set; }
        /// <summary>"lat,lng"; missing means the punch is flagged GeofenceStatus = Unknown.</summary>
        public string? GeoLocation { get; set; }
        public string? Device { get; set; }
    }

    public class NfcPunchResponse
    {
        public Guid EventLogId { get; set; }
        public string EventType { get; set; } = string.Empty;
        public DateTime EventDate { get; set; }
        public int LocationId { get; set; }
        public string LocationName { get; set; } = string.Empty;
        public string GeofenceStatus { get; set; } = "Unknown";
        /// <summary>True when this tap repeated the person's punch from the last minute and recorded nothing.</summary>
        public bool Repeated { get; set; }
    }
}
