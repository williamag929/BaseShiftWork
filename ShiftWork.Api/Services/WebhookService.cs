using System;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    /// <summary>
    /// Interface for webhook service operations.
    /// </summary>
    public interface IWebhookService
    {
        /// <summary>
        /// Sends a webhook notification to the configured endpoint.
        /// </summary>
        /// <param name="eventType">The type of event that occurred.</param>
        /// <param name="data">The data object to send (Person or Location).</param>
        /// <returns>True if webhook was sent successfully, false otherwise.</returns>
        Task<bool> SendWebhookAsync(WebhookEventType eventType, object data);
    }

    /// <summary>
    /// Service for sending outgoing webhook notifications with HMAC SHA256 security.
    /// Implements retry logic and integrates with Zapier/Procore workflows.
    /// </summary>
    public class WebhookService : IWebhookService
    {
        private readonly IConfiguration _config;
        private readonly ILogger<WebhookService> _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private const int MaxRetries = 3;
        private const int RetryDelayMs = 1000;

        public WebhookService(
            IConfiguration config, 
            ILogger<WebhookService> logger, 
            IHttpClientFactory httpClientFactory)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
        }

        /// <summary>
        /// Sends a webhook notification to the configured endpoint with retry logic.
        /// </summary>
        public async Task<bool> SendWebhookAsync(WebhookEventType eventType, object data)
        {
            var webhookUrl = _config["ZAPIER_WEBHOOK_URL"] ?? Environment.GetEnvironmentVariable("ZAPIER_WEBHOOK_URL");
            
            if (string.IsNullOrWhiteSpace(webhookUrl))
            {
                _logger.LogWarning("ZAPIER_WEBHOOK_URL not configured. Webhook not sent for event {EventType}.", eventType);
                return false;
            }

            var payload = new WebhookPayloadDto
            {
                EventType = ConvertEventTypeToString(eventType),
                Timestamp = DateTime.UtcNow,
                Data = data
            };

            var jsonPayload = JsonSerializer.Serialize(payload, new JsonSerializerOptions 
            { 
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase 
            });

            for (int attempt = 1; attempt <= MaxRetries; attempt++)
            {
                try
                {
                    var client = _httpClientFactory.CreateClient();
                    var request = new HttpRequestMessage(HttpMethod.Post, webhookUrl)
                    {
                        Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json")
                    };

                    // Add HMAC SHA256 signature for security
                    var signature = GenerateHmacSignature(jsonPayload);
                    request.Headers.Add("X-ShiftWork-Signature", signature);

                    var response = await client.SendAsync(request);

                    if (response.IsSuccessStatusCode)
                    {
                        _logger.LogInformation(
                            "Webhook sent successfully for event {EventType} on attempt {Attempt}.", 
                            eventType, 
                            attempt);
                        return true;
                    }
                    else
                    {
                        _logger.LogWarning(
                            "Webhook failed for event {EventType} with status {StatusCode} on attempt {Attempt}. Response: {Response}", 
                            eventType, 
                            (int)response.StatusCode, 
                            attempt,
                            await response.Content.ReadAsStringAsync());

                        if (attempt < MaxRetries)
                        {
                            await Task.Delay(RetryDelayMs * attempt); // Exponential backoff
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex, 
                        "Exception sending webhook for event {EventType} on attempt {Attempt}.", 
                        eventType, 
                        attempt);

                    if (attempt < MaxRetries)
                    {
                        await Task.Delay(RetryDelayMs * attempt); // Exponential backoff
                    }
                }
            }

            _logger.LogError(
                "Webhook failed for event {EventType} after {MaxRetries} attempts.", 
                eventType, 
                MaxRetries);
            return false;
        }

        /// <summary>
        /// Generates HMAC SHA256 signature for webhook payload security.
        /// </summary>
        private string GenerateHmacSignature(string payload)
        {
            var secretKey = _config["WEBHOOK_SECRET_KEY"] ?? Environment.GetEnvironmentVariable("WEBHOOK_SECRET_KEY") ?? "default-secret-key";
            
            using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secretKey)))
            {
                var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
                return Convert.ToBase64String(hash);
            }
        }

        /// <summary>
        /// Converts WebhookEventType enum to string format expected by Zapier/Procore.
        /// </summary>
        private string ConvertEventTypeToString(WebhookEventType eventType)
        {
            return eventType switch
            {
                WebhookEventType.EmployeeCreated => "employee.created",
                WebhookEventType.EmployeeUpdated => "employee.updated",
                WebhookEventType.LocationCreated => "location.created",
                WebhookEventType.LocationUpdated => "location.updated",
                _ => throw new ArgumentException($"Unknown event type: {eventType}")
            };
        }
    }
}
