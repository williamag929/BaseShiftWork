using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShiftWork.Api.Models
{
    public class DocumentReadLog
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid LogId { get; set; }

        public Guid DocumentId { get; set; }
        public int PersonId { get; set; }
        public DateTime ReadAt { get; set; } = DateTime.UtcNow;

        public Document Document { get; set; }
        public Person Person { get; set; }
    }
}
