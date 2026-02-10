using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using ShiftWork.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ShiftWork.Api.Services;

public class PushNotificationService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ShiftWorkContext _context;
    private readonly ILogger<PushNotificationService> _logger;
    private const string ExpoApiUrl = "https://exp.host/--/api/v2/push/send";
    private static readonly Regex ExpoTokenRegex = new("^(Expo|Exponent)PushToken\[.+\]$", RegexOptions.Compiled);
    private const int ExpoChunkSize = 100;

    public PushNotificationService(
        IHttpClientFactory httpClientFactory,
        ShiftWorkContext context,
        ILogger<PushNotificationService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Send push notification to a specific person
    /// </summary>
    public async Task<bool> SendNotificationToPersonAsync(
        string companyId,
        int personId,
        string title,
        string body,
        Dictionary<string, object>? data = null)
    {
        var tokens = await _context.DeviceTokens
            .Where(dt => dt.CompanyId == companyId && dt.PersonId == personId)
            .Select(dt => dt.Token)
            .ToListAsync();

        if (!tokens.Any())
        {
            _logger.LogWarning("No device tokens found for PersonId {PersonId}", personId);
            return false;
        }

        return await SendNotificationsAsync(tokens, title, body, data);
    }

    /// <summary>
    /// Send push notification to multiple people
    /// </summary>
    public async Task<bool> SendNotificationToMultiplePeopleAsync(
        string companyId,
        List<int> personIds,
        string title,
        string body,
        Dictionary<string, object>? data = null)
    {
        var tokens = await _context.DeviceTokens
            .Where(dt => dt.CompanyId == companyId && personIds.Contains(dt.PersonId))
            .Select(dt => dt.Token)
            .ToListAsync();

        if (!tokens.Any())
        {
            _logger.LogWarning("No device tokens found for PersonIds {PersonIds}", string.Join(", ", personIds));
            return false;
        }

        return await SendNotificationsAsync(tokens, title, body, data);
    }

    /// <summary>
    /// Send push notification to all employees in a company
    /// </summary>
    public async Task<bool> SendNotificationToCompanyAsync(
        string companyId,
        string title,
        string body,
        Dictionary<string, object>? data = null)
    {
        var tokens = await _context.DeviceTokens
            .Where(dt => dt.CompanyId == companyId)
            .Select(dt => dt.Token)
            .ToListAsync();

        if (!tokens.Any())
        {
            _logger.LogWarning("No device tokens found for CompanyId {CompanyId}", companyId);
            return false;
        }

        return await SendNotificationsAsync(tokens, title, body, data);
    }

    /// <summary>
    /// Send notifications via Expo Push Notification Service
    /// </summary>
    private async Task<bool> SendNotificationsAsync(
        List<string> expoPushTokens,
        string title,
        string body,
        Dictionary<string, object>? data = null)
    {
        try
        {
            var httpClient = _httpClientFactory.CreateClient();
            var cleanedTokens = expoPushTokens
                .Where(t => !string.IsNullOrWhiteSpace(t) && ExpoTokenRegex.IsMatch(t))
                .Distinct()
                .ToList();

            if (!cleanedTokens.Any())
            {
                _logger.LogWarning("No valid Expo push tokens to send.");
                return false;
            }

            var anySuccess = false;
            var tokensToRemove = new HashSet<string>();

            foreach (var chunk in Chunk(cleanedTokens, ExpoChunkSize))
            {
                var messages = chunk.Select(token => new ExpoMessage
                {
                    To = token,
                    Title = title,
                    Body = body,
                    Data = data ?? new Dictionary<string, object>(),
                    Sound = "default",
                    Priority = "high",
                    ChannelId = "default"
                }).ToList();

                var response = await httpClient.PostAsJsonAsync(ExpoApiUrl, messages);

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to send push notifications. Status: {Status}, Error: {Error}",
                        response.StatusCode, error);
                    continue;
                }

                var resultJson = await response.Content.ReadAsStringAsync();
                _logger.LogInformation("Push notifications sent successfully: {Result}", resultJson);
                anySuccess = true;

                var result = JsonSerializer.Deserialize<ExpoPushResponse>(resultJson);
                if (result?.Data == null)
                {
                    continue;
                }

                for (var i = 0; i < result.Data.Count && i < chunk.Count; i++)
                {
                    var ticket = result.Data[i];
                    if (ticket?.Status?.Equals("error", StringComparison.OrdinalIgnoreCase) == true)
                    {
                        var errorCode = ticket.Details?.Error;
                        if (!string.IsNullOrWhiteSpace(errorCode) && errorCode.Equals("DeviceNotRegistered", StringComparison.OrdinalIgnoreCase))
                        {
                            tokensToRemove.Add(chunk[i]);
                        }
                        _logger.LogWarning("Expo push error for token {Token}: {Message} ({Error})", chunk[i], ticket.Message, errorCode);
                    }
                }
            }

            if (tokensToRemove.Any())
            {
                var expiredTokens = await _context.DeviceTokens
                    .Where(dt => tokensToRemove.Contains(dt.Token))
                    .ToListAsync();

                if (expiredTokens.Any())
                {
                    _context.DeviceTokens.RemoveRange(expiredTokens);
                    await _context.SaveChangesAsync();
                }
            }

            return anySuccess;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending push notifications");
            return false;
        }
    }

    private static IEnumerable<List<T>> Chunk<T>(List<T> source, int size)
    {
        for (var i = 0; i < source.Count; i += size)
        {
            yield return source.GetRange(i, Math.Min(size, source.Count - i));
        }
    }

    /// <summary>
    /// Notify when a schedule is published
    /// </summary>
    public async Task NotifySchedulePublishedAsync(string companyId, int scheduleId, DateTime startDate, DateTime endDate)
    {
        // Get all people assigned to shifts in this schedule
        var personIds = await _context.ScheduleShifts
            .Where(ss => ss.ScheduleId == scheduleId)
            .Select(ss => ss.PersonId)
            .Distinct()
            .ToListAsync();

        if (personIds.Any())
        {
            var data = new Dictionary<string, object>
            {
                { "type", "schedule_published" },
                { "scheduleId", scheduleId },
                { "startDate", startDate.ToString("o") },
                { "endDate", endDate.ToString("o") }
            };

            await SendNotificationToMultiplePeopleAsync(
                companyId,
                personIds,
                "Schedule Published",
                $"New schedule available for {startDate:MMM dd} - {endDate:MMM dd}",
                data
            );
        }
    }

    /// <summary>
    /// Notify when a shift is assigned to a person
    /// </summary>
    public async Task NotifyShiftAssignedAsync(string companyId, int personId, int shiftId, DateTime startDate)
    {
        var data = new Dictionary<string, object>
        {
            { "type", "shift_assigned" },
            { "shiftId", shiftId },
            { "startDate", startDate.ToString("o") }
        };

        await SendNotificationToPersonAsync(
            companyId,
            personId,
            "New Shift Assigned",
            $"You have a new shift on {startDate:MMM dd 'at' h:mm tt}",
            data
        );
    }

    /// <summary>
    /// Notify when time off request is approved
    /// </summary>
    public async Task NotifyTimeOffApprovedAsync(string companyId, int personId, DateTime startDate, DateTime endDate, string type)
    {
        var data = new Dictionary<string, object>
        {
            { "type", "time_off_approved" },
            { "startDate", startDate.ToString("o") },
            { "endDate", endDate.ToString("o") }
        };

        await SendNotificationToPersonAsync(
            companyId,
            personId,
            "Time Off Approved",
            $"Your {type} request for {startDate:MMM dd} - {endDate:MMM dd} has been approved",
            data
        );
    }

    /// <summary>
    /// Notify when time off request is denied
    /// </summary>
    public async Task NotifyTimeOffDeniedAsync(string companyId, int personId, DateTime startDate, DateTime endDate, string type)
    {
        var data = new Dictionary<string, object>
        {
            { "type", "time_off_denied" },
            { "startDate", startDate.ToString("o") },
            { "endDate", endDate.ToString("o") }
        };

        await SendNotificationToPersonAsync(
            companyId,
            personId,
            "Time Off Request Update",
            $"Your {type} request for {startDate:MMM dd} - {endDate:MMM dd} has been reviewed",
            data
        );
    }

    /// <summary>
    /// Notify when a shift is changed
    /// </summary>
    public async Task NotifyShiftChangedAsync(string companyId, int personId, int shiftId, DateTime startDate, string changeDescription)
    {
        var data = new Dictionary<string, object>
        {
            { "type", "shift_changed" },
            { "shiftId", shiftId },
            { "startDate", startDate.ToString("o") },
            { "change", changeDescription }
        };

        await SendNotificationToPersonAsync(
            companyId,
            personId,
            "Shift Updated",
            $"Your shift on {startDate:MMM dd} has been updated: {changeDescription}",
            data
        );
    }
}

/// <summary>
/// Expo push notification message format
/// </summary>
public class ExpoMessage
{
    [JsonPropertyName("to")]
    public string To { get; set; } = string.Empty;

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("body")]
    public string Body { get; set; } = string.Empty;

    [JsonPropertyName("data")]
    public Dictionary<string, object> Data { get; set; } = new();

    [JsonPropertyName("sound")]
    public string Sound { get; set; } = "default";

    [JsonPropertyName("priority")]
    public string Priority { get; set; } = "high";

    [JsonPropertyName("channelId")]
    public string? ChannelId { get; set; }

    [JsonPropertyName("badge")]
    public int? Badge { get; set; }
}

public class ExpoPushResponse
{
    [JsonPropertyName("data")]
    public List<ExpoPushTicket>? Data { get; set; }
}

public class ExpoPushTicket
{
    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("message")]
    public string? Message { get; set; }

    [JsonPropertyName("details")]
    public ExpoPushTicketDetails? Details { get; set; }
}

public class ExpoPushTicketDetails
{
    [JsonPropertyName("error")]
    public string? Error { get; set; }
}
