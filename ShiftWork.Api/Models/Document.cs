using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShiftWork.Api.Models
{
    public class Document
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid DocumentId { get; set; }

        public string CompanyId { get; set; }
        public int? LocationId { get; set; }        // null = company-wide

        public string Title { get; set; }
        public string? Description { get; set; }

        // Manual | Procedure | SafetyDataSheet | ProductInfo | FloorPlan | Policy | Other
        public string Type { get; set; } = "Other";

        public string FileUrl { get; set; }          // S3 key — never expose raw; generate presigned URLs
        public long FileSize { get; set; }           // bytes
        public string MimeType { get; set; }
        public string Version { get; set; } = "1.0";

        public string? Tags { get; set; }            // JSON string[]

        // Public | LocationOnly | Restricted
        public string AccessLevel { get; set; } = "Public";
        public string? AllowedRoleIds { get; set; } // JSON int[] — used only when AccessLevel = Restricted

        public int UploadedByPersonId { get; set; }

        public string Status { get; set; } = "Draft"; // Draft | Active | Archived

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public Person UploadedBy { get; set; }
        public Location? Location { get; set; }
        public ICollection<DocumentReadLog> ReadLogs { get; set; } = new List<DocumentReadLog>();
    }
}
