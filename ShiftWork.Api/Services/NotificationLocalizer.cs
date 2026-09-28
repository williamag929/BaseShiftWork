using System.Text.Json;
using Microsoft.Extensions.Hosting;

namespace ShiftWork.Api.Services;

/// <summary>
/// Resolves localized push-notification templates from Resources/notifications.{lang}.json.
/// Template syntax matches the frontend catalog convention: {{variable}}.
/// Falls back to English, then to the raw key.
/// </summary>
public class NotificationLocalizer
{
    public const string DefaultLanguage = "en";
    private static readonly string[] SupportedLanguages = { "en", "es" };

    private readonly ILogger<NotificationLocalizer> _logger;
    private readonly Dictionary<string, Dictionary<string, NotificationTemplate>> _catalogs = new();

    public NotificationLocalizer(IHostEnvironment env, ILogger<NotificationLocalizer> logger)
    {
        _logger = logger;

        // Prefer the content root; fall back to the app base directory (where Resources
        // are copied on publish / in test runs) so the catalog loads outside the web host too.
        var searchRoots = new[] { env.ContentRootPath, AppContext.BaseDirectory };

        foreach (var lang in SupportedLanguages)
        {
            var path = searchRoots
                .Select(root => Path.Combine(root, "Resources", $"notifications.{lang}.json"))
                .FirstOrDefault(File.Exists);

            if (path == null)
            {
                _logger.LogWarning("Notification catalog not found for language {Lang}", lang);
                continue;
            }

            try
            {
                var json = File.ReadAllText(path);
                var catalog = JsonSerializer.Deserialize<Dictionary<string, NotificationTemplate>>(
                    json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (catalog != null) _catalogs[lang] = catalog;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load notification catalog {Path}", path);
            }
        }
    }

    /// <summary>
    /// Normalizes a language tag to a supported one ("es-MX" → "es"); anything unknown → "en".
    /// </summary>
    public static string Normalize(string? language)
    {
        if (string.IsNullOrWhiteSpace(language)) return DefaultLanguage;
        var tag = language.Split('-')[0].Trim().ToLowerInvariant();
        return SupportedLanguages.Contains(tag) ? tag : DefaultLanguage;
    }

    public (string Title, string Body) Get(string language, string key, IReadOnlyDictionary<string, string>? vars = null)
    {
        var lang = Normalize(language);
        var template =
            (_catalogs.TryGetValue(lang, out var catalog) && catalog.TryGetValue(key, out var t) ? t : null)
            ?? (_catalogs.TryGetValue(DefaultLanguage, out var en) && en.TryGetValue(key, out var fallback) ? fallback : null);

        if (template == null)
        {
            _logger.LogWarning("Notification template not found for key {Key}", key);
            return (key, key);
        }

        return (Interpolate(template.Title, vars), Interpolate(template.Body, vars));
    }

    private static string Interpolate(string text, IReadOnlyDictionary<string, string>? vars)
    {
        if (vars == null) return text;
        foreach (var (name, value) in vars)
        {
            text = text.Replace("{{" + name + "}}", value);
        }
        return text;
    }

    public class NotificationTemplate
    {
        public string Title { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
    }
}
