using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShiftWork.Api.Models
{
    public class ShiftEvent
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid EventLogId { get; set; }
        public DateTime EventDate { get; set; }
        public string? EventType { get; set; } //shift, break, task, clockin, clockout
        public string? CompanyId { get; set; }
        public int PersonId { get; set; }
        public string? EventObject { get; set; }//json object of the event
        public string? Description { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? CreatedAt { get; set; }
        public string? KioskDevice { get; set; }
        public string? GeoLocation { get; set; }
        public string? PhotoUrl { get; set; }
        public Person? Person { get; set; }
        public Company? Company { get; set; }
    }
}
