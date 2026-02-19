using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Mail;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ShiftWork.Api.Services
{
    public interface INotificationService
    {
        Task<NotificationBatchResult> NotifyReplacementCandidates(
            string companyId,
            IEnumerable<(int personId, string? email, string? phone)> targets,
            string channel,
            string subject,
            string message,
            string? actionUrl = null);
        
        Task SendEmailAsync(string? toEmail, string subject, string htmlBody);
    }

    public class NotificationBatchResult
    {
        public int Attempted { get; set; }
        public int Succeeded { get; set; }
        public int Failed => Attempted - Succeeded;
        public List<string> Errors { get; set; } = new();
    }

    /// <summary>
    /// Sends notifications via configured providers. Falls back to logging if provider is not configured.
    /// Supported channels: email, sms, push
    /// </summary>
    public class NotificationService : INotificationService
    {
        private readonly IConfiguration _config;
        private readonly ILogger<NotificationService> _logger;
        private readonly IHttpClientFactory? _httpClientFactory;

        public NotificationService(IConfiguration config, ILogger<NotificationService> logger, IHttpClientFactory? httpClientFactory = null)
        {
            _config = config;
            _logger = logger;
            _httpClientFactory = httpClientFactory;
        }

        public async Task<NotificationBatchResult> NotifyReplacementCandidates(
            string companyId,
            IEnumerable<(int personId, string? email, string? phone)> targets,
            string channel,
            string subject,
            string message,
            string? actionUrl = null)
        {
            var normalizedChannel = (channel ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(normalizedChannel)) normalizedChannel = "push";

            var result = new NotificationBatchResult
            {
                Attempted = targets.Count()
            };

            foreach (var t in targets)
            {
                try
                {
                    switch (normalizedChannel)
                    {
                        case "email":
                            await SendEmailAsync(t.email, subject, BuildEmailBody(message, actionUrl));
                            break;
                        case "sms":
                            await SendSmsAsync(t.phone, BuildSmsBody(message, actionUrl));
                            break;
                        case "push":
                        default:
                            await SendPushAsync(t.personId, subject, message, actionUrl);
                            break;
                    }
                    result.Succeeded++;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send {Channel} notification to person {PersonId}", normalizedChannel, t.personId);
                    result.Errors.Add($"{t.personId}:{ex.Message}");
                }
            }

            return result;
        }

        private string BuildEmailBody(string message, string? actionUrl)
        {
            if (string.IsNullOrEmpty(actionUrl)) return message;
            return $"{message}<br/><br/><a href=\"{WebUtility.HtmlEncode(actionUrl)}\">View details</a>";
        }

        private string BuildSmsBody(string message, string? actionUrl)
        {
            if (string.IsNullOrEmpty(actionUrl)) return message;
            return $"{message}\n{actionUrl}";
        }

        public async Task SendEmailAsync(string? toEmail, string subject, string htmlBody)
        {
            var from = _config["Smtp:From"] ?? _config["Email:From"];
            var host = _config["Smtp:Host"];
            var portStr = _config["Smtp:Port"];
            var user = _config["Smtp:Username"];
            var pass = _config["Smtp:Password"];

            if (string.IsNullOrWhiteSpace(toEmail))
            {
                _logger.LogWarning("Email not sent: missing recipient address");
                return; // skip but don't throw
            }

            if (!string.IsNullOrEmpty(host) && int.TryParse(portStr, out var port) && !string.IsNullOrEmpty(from))
            {
                using var client = new SmtpClient(host, port)
                {
                    EnableSsl = true
                };
                if (!string.IsNullOrEmpty(user))
                {
                    client.Credentials = new NetworkCredential(user, pass);
                }
                var mail = new MailMessage(from, toEmail)
                {
                    Subject = subject,
                    Body = htmlBody,
                    IsBodyHtml = true
                };
                await client.SendMailAsync(mail);
                _logger.LogInformation("Email sent to {Email}", toEmail);
            }
            else
            {
                _logger.LogInformation("[SIMULATED EMAIL] To={To} Subject={Subject} Body={Body}", toEmail, subject, htmlBody);
                await Task.CompletedTask;
            }
        }

        private async Task SendSmsAsync(string? toPhone, string body)
        {
            if (string.IsNullOrWhiteSpace(toPhone))
            {
                _logger.LogWarning("SMS not sent: missing phone number");
                return; // skip but don't throw
            }

            var sid = _config["Twilio:AccountSid"];
            var token = _config["Twilio:AuthToken"];
            var from = _config["Twilio:From"];

            if (!string.IsNullOrEmpty(sid) && !string.IsNullOrEmpty(token) && !string.IsNullOrEmpty(from))
            {
                var client = _httpClientFactory?.CreateClient("twilio") ?? new HttpClient();
                var url = new Uri($"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json");
                var content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["To"] = toPhone,
                    ["From"] = from,
                    ["Body"] = body
                });
                var authToken = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{sid}:{token}"));
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", authToken);
                var resp = await client.PostAsync(url, content);
                resp.EnsureSuccessStatusCode();
                _logger.LogInformation("SMS sent to {Phone}", toPhone);
            }
            else
            {
                _logger.LogInformation("[SIMULATED SMS] To={To} Body={Body}", toPhone, body);
                await Task.CompletedTask;
            }
        }

        private async Task SendPushAsync(int personId, string title, string body, string? actionUrl)
        {
            // Placeholder push implementation. Integrate FCM or other provider when credentials are available.
            _logger.LogInformation("[SIMULATED PUSH] ToPersonId={PersonId} Title={Title} Body={Body} Url={Url}", personId, title, body, actionUrl);
            await Task.CompletedTask;
        }
    }
}
