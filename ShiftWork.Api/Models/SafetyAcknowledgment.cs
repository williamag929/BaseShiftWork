using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShiftWork.Api.Models
{
    public class SafetyAcknowledgment
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid AcknowledgmentId { get; set; }

        public Guid SafetyContentId { get; set; }
        public int PersonId { get; set; }
        public DateTime AcknowledgedAt { get; set; } = DateTime.UtcNow;
        public string? Notes { get; set; }

        public SafetyContent SafetyContent { get; set; }
        public Person Person { get; set; }
    }
}
