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
}
