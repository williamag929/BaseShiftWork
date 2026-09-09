using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using ShiftWork.Api.Data;
using ShiftWork.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace ShiftWork.Api.Services;

public class PushNotificationService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ShiftWorkContext _context;
    private readonly ILogger<PushNotificationService> _logger;
    private readonly INotificationService _notificationService;
    private readonly NotificationLocalizer _localizer;
    private const string ExpoApiUrl = "https://exp.host/--/api/v2/push/send";
    private static readonly Regex ExpoTokenRegex = new(@"^(Expo|Exponent)PushToken\[.+\]$", RegexOptions.Compiled);
    private const int ExpoChunkSize = 100;

    public PushNotificationService(
        IHttpClientFactory httpClientFactory,
        ShiftWorkContext context,
        ILogger<PushNotificationService> logger,
        INotificationService notificationService,
        NotificationLocalizer localizer)
    {
        _httpClientFactory = httpClientFactory;
        _context = context;
        _logger = logger;
        _notificationService = notificationService;
        _localizer = localizer;
    }

    /// <summary>
    /// Send a localized push notification, resolving each recipient's language as
    /// Person.PreferredLanguage ?? CompanySettings.DefaultLanguage ?? "en" and sending
    /// one batch per language group. varsByLang supplies template variables per language
    /// (so dates can be formatted with the right culture).
    /// </summary>
    public async Task<bool> SendLocalizedNotificationAsync(
        string companyId,
        List<int> personIds,
        string templateKey,
        Func<string, Dictionary<string, string>>? varsByLang = null,
        Dictionary<string, object>? data = null)
    {
        var companyDefault = NotificationLocalizer.Normalize(
            await _context.CompanySettings
                .Where(cs => cs.CompanyId == companyId)
                .Select(cs => cs.DefaultLanguage)
                .FirstOrDefaultAsync());

        var recipients = await _context.DeviceTokens
            .Where(dt => dt.CompanyId == companyId && personIds.Contains(dt.PersonId))
            .Join(_context.Persons,
                dt => dt.PersonId,
                p => p.PersonId,
                (dt, p) => new { dt.Token, p.PreferredLanguage })
            .ToListAsync();

        if (!recipients.Any())
        {
            _logger.LogWarning("No device tokens found for PersonIds {PersonIds}", string.Join(", ", personIds));
            return false;
        }

        var anySuccess = false;
        foreach (var group in recipients.GroupBy(r =>
            string.IsNullOrWhiteSpace(r.PreferredLanguage)
                ? companyDefault
                : NotificationLocalizer.Normalize(r.PreferredLanguage)))
        {
            var (title, body) = _localizer.Get(group.Key, templateKey, varsByLang?.Invoke(group.Key));
            anySuccess |= await SendNotificationsAsync(group.Select(r => r.Token).ToList(), title, body, data);
        }

        return anySuccess;
    }

    /// <summary>
    /// Localized send to every active employee in a company.
    /// </summary>
    public async Task<bool> SendLocalizedNotificationToCompanyAsync(
        string companyId,
        string templateKey,
        Func<string, Dictionary<string, string>>? varsByLang = null,
        Dictionary<string, object>? data = null)
    {
        var personIds = await _context.DeviceTokens
            .Where(dt => dt.CompanyId == companyId)
            .Select(dt => dt.PersonId)
            .Distinct()
            .ToListAsync();

        if (!personIds.Any())
        {
            _logger.LogWarning("No device tokens found for CompanyId {CompanyId}", companyId);
            return false;
        }

        return await SendLocalizedNotificationAsync(companyId, personIds, templateKey, varsByLang, data);
    }

    private static CultureInfo CultureFor(string lang) =>
        lang == "es" ? CultureInfo.GetCultureInfo("es") : CultureInfo.GetCultureInfo("en");

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
                    AppMetrics.PushNotificationFailures.Add(1);
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
            AppMetrics.PushNotificationFailures.Add(1);
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
    /// Notify when a schedule is published — sends push notification and email to all assigned employees.
    /// </summary>
    public async Task NotifySchedulePublishedAsync(string companyId, int scheduleId, DateTime startDate, DateTime endDate)
    {
        var personIds = await _context.ScheduleShifts
            .Where(ss => ss.ScheduleId == scheduleId)
            .Select(ss => ss.PersonId)
            .Distinct()
            .ToListAsync();

        if (!personIds.Any()) return;

        var data = new Dictionary<string, object>
        {
            { "type", "schedule_published" },
            { "scheduleId", scheduleId },
            { "startDate", startDate.ToString("o") },
            { "endDate", endDate.ToString("o") }
        };

        await SendLocalizedNotificationAsync(
            companyId,
            personIds,
            "schedule_published",
            lang => new Dictionary<string, string>
            {
                { "start", startDate.ToString("MMM dd", CultureFor(lang)) },
                { "end", endDate.ToString("MMM dd", CultureFor(lang)) }
            },
            data);

        var persons = await _context.Persons
            .Where(p => p.CompanyId == companyId && personIds.Contains(p.PersonId))
            .Select(p => new { p.Email, p.Name })
            .ToListAsync();

        foreach (var person in persons)
        {
            var subject = "Your Schedule Has Been Published";
            var body = $"Hi {person.Name},<br/><br/>"
                + $"Your schedule from <strong>{startDate:MMMM dd, yyyy}</strong> to <strong>{endDate:MMMM dd, yyyy}</strong> "
                + $"is now published and available for viewing.<br/><br/>"
                + "Please log in to the ShiftWork app to view your shifts.";
            await _notificationService.SendEmailAsync(person.Email, subject, body);
        }
    }

    /// <summary>
    /// Notify when a shift is assigned to a person — sends push notification and email.
    /// </summary>
    public async Task NotifyShiftAssignedAsync(string companyId, int personId, int shiftId, DateTime startDate)
    {
        var data = new Dictionary<string, object>
        {
            { "type", "shift_assigned" },
            { "shiftId", shiftId },
            { "startDate", startDate.ToString("o") }
        };

        await SendLocalizedNotificationAsync(
            companyId,
            new List<int> { personId },
            "shift_assigned",
            lang => new Dictionary<string, string>
            {
                { "date", startDate.ToString("MMM dd, h:mm tt", CultureFor(lang)) }
            },
            data);

        var person = await _context.Persons
            .Where(p => p.CompanyId == companyId && p.PersonId == personId)
            .Select(p => new { p.Email, p.Name })
            .FirstOrDefaultAsync();

        if (person != null)
        {
            var subject = "New Shift Assigned";
            var body = $"Hi {person.Name},<br/><br/>"
                + $"You have been assigned a new shift on <strong>{startDate:MMMM dd, yyyy 'at' h:mm tt}</strong>.<br/><br/>"
                + "Please log in to the ShiftWork app to view your schedule.";
            await _notificationService.SendEmailAsync(person.Email, subject, body);
        }
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

        await SendLocalizedNotificationAsync(
            companyId,
            new List<int> { personId },
            "time_off_approved",
            lang => new Dictionary<string, string>
            {
                { "type", type },
                { "start", startDate.ToString("MMM dd", CultureFor(lang)) },
                { "end", endDate.ToString("MMM dd", CultureFor(lang)) }
            },
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

        await SendLocalizedNotificationAsync(
            companyId,
            new List<int> { personId },
            "time_off_denied",
            lang => new Dictionary<string, string>
            {
                { "type", type },
                { "start", startDate.ToString("MMM dd", CultureFor(lang)) },
                { "end", endDate.ToString("MMM dd", CultureFor(lang)) }
            },
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

        await SendLocalizedNotificationAsync(
            companyId,
            new List<int> { personId },
            "shift_changed",
            lang => new Dictionary<string, string>
            {
                { "date", startDate.ToString("MMM dd", CultureFor(lang)) },
                { "change", changeDescription }
            },
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
