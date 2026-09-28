namespace ShiftWork.Api.Models
{
    public class StripeProcessedEvent
    {
        public string EventId { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public DateTime ProcessedAt { get; set; }
    }
}
