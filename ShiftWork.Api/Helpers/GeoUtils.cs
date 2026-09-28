using System;
using System.Text.Json;
using ShiftWork.Api.DTOs;

namespace ShiftWork.Api.Helpers
{
    /// <summary>
    /// Coordinate parsing and distance math shared by geofence checks (ShiftEventService, KioskService)
    /// and any future consumer of <c>Location.GeoCoordinates</c> / <c>ShiftEvent.GeoLocation</c>.
    /// </summary>
    public static class GeoUtils
    {
        /// <summary>
        /// Parses a coordinate string that may be in either format actually found in the data:
        /// JSON (what the Angular Locations form writes via LocationDto, e.g. {"Latitude":40.7,"Longitude":-74.0})
        /// or a plain "lat,lon" string (legacy/seed data, and what mobile/kiosk clients send for GeoLocation).
        /// Returns null if the value is empty or matches neither format.
        /// </summary>
        public static (double Lat, double Lon)? ParseCoordinates(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            var trimmed = value.Trim();

            if (trimmed.StartsWith("{"))
            {
                try
                {
                    var dto = JsonSerializer.Deserialize<GeoCoordinatesDto>(trimmed, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true,
                    });
                    if (dto != null && (dto.Latitude != 0 || dto.Longitude != 0))
                    {
                        return (dto.Latitude, dto.Longitude);
                    }
                    return null;
                }
                catch (JsonException)
                {
                    return null;
                }
            }

            var parts = trimmed.Split(',');
            if (parts.Length == 2
                && double.TryParse(parts[0].Trim(), out var lat)
                && double.TryParse(parts[1].Trim(), out var lon))
            {
                return (lat, lon);
            }

            return null;
        }

        /// <summary>Great-circle distance between two coordinates, in meters (Haversine formula).</summary>
        public static double DistanceMeters(double lat1, double lon1, double lat2, double lon2)
        {
            const double earthRadiusMeters = 6371000;
            var dLat = ToRadians(lat2 - lat1);
            var dLon = ToRadians(lon2 - lon1);

            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                    + Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2))
                    * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

            return earthRadiusMeters * c;
        }

        private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;
    }
}
