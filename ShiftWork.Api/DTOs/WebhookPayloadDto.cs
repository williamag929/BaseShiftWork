using System;

namespace ShiftWork.Api.DTOs
{
    /// <summary>
    /// Represents the standardized payload structure for outgoing webhooks.
    /// Compatible with external systems like Zapier, n8n, Make (Integromat), and Procore.
    /// </summary>
    public class WebhookPayloadDto
    {
        /// <summary>
        /// The type of event that triggered the webhook (e.g., "employee.created").
        /// </summary>
        public string EventType { get; set; }

        /// <summary>
        /// The UTC timestamp when the event occurred.
        /// </summary>
        public DateTime Timestamp { get; set; }

        /// <summary>
        /// The full data object related to the event (Person or Location).
        /// </summary>
        public object Data { get; set; }
    }
}
