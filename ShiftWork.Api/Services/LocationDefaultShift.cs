using System;
using System.Globalization;
using System.Text.Json;

namespace ShiftWork.Api.Services
{
    public record LocationDefaultShift(TimeOnly Start, TimeOnly End, int? AreaId)
    {
        public static LocationDefaultShift? TryParse(string? settingsJson)
        {
            if (string.IsNullOrWhiteSpace(settingsJson)) return null;
            try
            {
                using var doc = JsonDocument.Parse(settingsJson);
                if (doc.RootElement.ValueKind != JsonValueKind.Object
                    || !doc.RootElement.TryGetProperty("defaultShift", out var d)
                    || d.ValueKind != JsonValueKind.Object) return null;

                if (!TryTime(d, "start", out var start) || !TryTime(d, "end", out var end)) return null;

                int? area = d.TryGetProperty("areaId", out var a) && a.ValueKind == JsonValueKind.Number && a.TryGetInt32(out var id)
                    ? id : null;
                return new LocationDefaultShift(start, end, area);
            }
            catch (JsonException) { return null; }
        }

        private static bool TryTime(JsonElement obj, string name, out TimeOnly time)
        {
            time = default;
            return obj.TryGetProperty(name, out var p)
                   && p.ValueKind == JsonValueKind.String
                   && TimeOnly.TryParseExact(p.GetString(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out time);
        }
    }
}
