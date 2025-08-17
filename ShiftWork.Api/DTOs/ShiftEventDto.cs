using System;

namespace ShiftWork.Api.DTOs
{
    public class ShiftEventDto
    {
        public Guid EventLogId { get; set; }
        public DateTime EventDate { get; set; }
        public string? EventType { get; set; }
        public string? CompanyId { get; set; }
        public int PersonId { get; set; }
        public string? EventObject { get; set; }
        public string? Description { get; set; }
        public string? KioskDevice { get; set; }
        public string? GeoLocation { get; set; }
        public string? PhotoUrl { get; set; }
    }
}
