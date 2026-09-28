using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShiftWork.Api.Models
{
    /// <summary>
    /// A worker credential/certification/license, tracked for expiry compliance
    /// (e.g. "OSHA 30", "Forklift License", "First Aid/CPR").
    /// </summary>
    public class Credential
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid CredentialId { get; set; }

        public string CompanyId { get; set; }
        public int PersonId { get; set; }

        public string Name { get; set; }
        /// <summary>Free text, e.g. "License" | "Certification" | "Training" — no enum, matches codebase convention.</summary>
        public string? Type { get; set; }
        public string? IssuingAuthority { get; set; }
        public string? CredentialNumber { get; set; }

        public DateTime? IssueDate { get; set; }
        public DateTime ExpiryDate { get; set; }

        /// <summary>S3 key — never expose raw; generate presigned URLs. Optional (document is not required).</summary>
        public string? DocumentUrl { get; set; }

        /// <summary>Active | Archived — no hard deletes, matches project convention.</summary>
        public string Status { get; set; } = "Active";

        public int? CreatedByPersonId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        public Person? Person { get; set; }
    }
}
