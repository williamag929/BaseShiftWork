using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShiftWork.Api.Models
{
    public class ReportMedia
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid MediaId { get; set; }

        public Guid ReportId { get; set; }
        public int PersonId { get; set; }
        public Guid? ShiftEventId { get; set; }     // optional link to the clock event that produced this photo

        public string MediaType { get; set; } = "Photo"; // Photo | Note | Video
        public string MediaUrl { get; set; }         // S3 key
        public string? Caption { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        public LocationDailyReport Report { get; set; }
        public Person Person { get; set; }
    }
}
