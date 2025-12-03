using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShiftWork.Api.Models
{
    public class ShiftSummaryApproval
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string CompanyId { get; set; } = string.Empty;

        [Required]
        public int PersonId { get; set; }

        [Required]
        [Column(TypeName = "date")]
        public DateTime Day { get; set; }

        // Values: not_shifted, shifted, approved, avoid
        [Required]
        [MaxLength(32)]
        public string Status { get; set; } = "shifted";

        public int? ApprovedBy { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? Notes { get; set; }
    }
}
