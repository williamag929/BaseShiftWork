using System.Text.Json;
using System.Text.Json.Serialization;

namespace ShiftWork.Api.Helpers
{
    /// <summary>
    /// JSON converter that ensures all DateTime values are serialized with the "Z" (UTC) suffix
    /// and deserialized as DateTimeKind.Utc.
    ///
    /// Schedule shift times represent "wall-clock" times (e.g. 7:00 AM means 7:00 AM).
    /// By always treating the stored value as UTC and using UTC methods on the client,
    /// we eliminate round-trip drift caused by local timezone conversion.
    /// </summary>
    public class UtcDateTimeJsonConverter : JsonConverter<DateTime>
    {
        public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            var dt = reader.GetDateTime();
            return DateTime.SpecifyKind(dt, DateTimeKind.Utc);
        }

        public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
        {
            // Always serialize as UTC with Z suffix regardless of DateTimeKind
            var utc = DateTime.SpecifyKind(value, DateTimeKind.Utc);
            writer.WriteStringValue(utc.ToString("yyyy-MM-ddTHH:mm:ssZ"));
        }
    }

    /// <summary>
    /// JSON converter for nullable DateTime that mirrors UtcDateTimeJsonConverter behavior.
    /// </summary>
    public class UtcNullableDateTimeJsonConverter : JsonConverter<DateTime?>
    {
        public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Null)
                return null;

            var dt = reader.GetDateTime();
            return DateTime.SpecifyKind(dt, DateTimeKind.Utc);
        }

        public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
        {
            if (!value.HasValue)
            {
                writer.WriteNullValue();
                return;
            }

            var utc = DateTime.SpecifyKind(value.Value, DateTimeKind.Utc);
            writer.WriteStringValue(utc.ToString("yyyy-MM-ddTHH:mm:ssZ"));
        }
    }
}
