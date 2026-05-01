using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public record WeatherSnapshot(
        double Temperature,
        double FeelsLike,
        int Humidity,
        string Description,
        string Icon,
        double WindSpeed,
        DateTime FetchedAt
    );

    public interface IWeatherService
    {
        Task<WeatherSnapshot?> GetCurrentWeatherAsync(double latitude, double longitude);
    }

    public class WeatherService : IWeatherService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly ILogger<WeatherService> _logger;

        public WeatherService(IHttpClientFactory httpClientFactory, IConfiguration configuration, ILogger<WeatherService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<WeatherSnapshot?> GetCurrentWeatherAsync(double latitude, double longitude)
        {
            var apiKey = _configuration["OPENWEATHER_API_KEY"];
            if (string.IsNullOrEmpty(apiKey))
            {
                _logger.LogWarning("OPENWEATHER_API_KEY not configured — weather skipped");
                return null;
            }

            try
            {
                var client = _httpClientFactory.CreateClient("weather");
                var url = $"https://api.openweathermap.org/data/2.5/weather?lat={latitude}&lon={longitude}&units=imperial&appid={apiKey}";

                var response = await client.GetFromJsonAsync<OpenWeatherResponse>(url);
                if (response == null) return null;

                return new WeatherSnapshot(
                    Temperature: response.Main.Temp,
                    FeelsLike: response.Main.FeelsLike,
                    Humidity: response.Main.Humidity,
                    Description: response.Weather.Length > 0 ? response.Weather[0].Description : "",
                    Icon: response.Weather.Length > 0 ? response.Weather[0].Icon : "",
                    WindSpeed: response.Wind.Speed,
                    FetchedAt: DateTime.UtcNow
                );
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Weather fetch failed for ({Lat},{Lon}) — continuing without weather", latitude, longitude);
                return null;
            }
        }

        // OpenWeatherMap response shape
        private sealed class OpenWeatherResponse
        {
            [JsonPropertyName("main")] public MainData Main { get; set; } = new();
            [JsonPropertyName("weather")] public WeatherData[] Weather { get; set; } = Array.Empty<WeatherData>();
            [JsonPropertyName("wind")] public WindData Wind { get; set; } = new();
        }

        private sealed class MainData
        {
            [JsonPropertyName("temp")] public double Temp { get; set; }
            [JsonPropertyName("feels_like")] public double FeelsLike { get; set; }
            [JsonPropertyName("humidity")] public int Humidity { get; set; }
        }

        private sealed class WeatherData
        {
            [JsonPropertyName("description")] public string Description { get; set; } = "";
            [JsonPropertyName("icon")] public string Icon { get; set; } = "";
        }

        private sealed class WindData
        {
            [JsonPropertyName("speed")] public double Speed { get; set; }
        }
    }
}
