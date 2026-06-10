using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShiftWork.Api.Models
{
    public class Bulletin
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid BulletinId { get; set; }

        public string CompanyId { get; set; }
        public int? LocationId { get; set; }        // null = company-wide

        public string Title { get; set; }           // max 100 chars
        public string Content { get; set; }

        public string Type { get; set; } = "General";     // General | Alert | Policy | Safety
        public string Priority { get; set; } = "Normal";  // Normal | High | Urgent

        public string? AttachmentUrls { get; set; }       // JSON string[]

        public DateTime PublishedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ExpiresAt { get; set; }

        public int CreatedByPersonId { get; set; }

        public string Status { get; set; } = "Draft";     // Draft | Published | Archived

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public Location? Location { get; set; }
        public Person CreatedBy { get; set; }
        public ICollection<BulletinRead> Reads { get; set; } = new List<BulletinRead>();
    }
}
