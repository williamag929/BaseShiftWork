using System;

namespace ShiftWork.Api.Services
{
    /// <summary>The client-reported punch time window shared by kiosk and NFC punches.</summary>
    public static class PunchTime
    {
        public static readonly TimeSpan MaxClockSkew = TimeSpan.FromMinutes(5);
        public static readonly TimeSpan MaxPunchAge = TimeSpan.FromDays(7);

        public static DateTime Resolve(DateTime? requested, DateTime nowUtc)
        {
            if (!requested.HasValue) return nowUtc;

            var utc = requested.Value.Kind switch
            {
                DateTimeKind.Utc => requested.Value,
                DateTimeKind.Local => requested.Value.ToUniversalTime(),
                _ => DateTime.SpecifyKind(requested.Value, DateTimeKind.Utc),
            };

            if (utc > nowUtc + MaxClockSkew)
                throw new ArgumentException("EventDate cannot be in the future.");
            if (utc < nowUtc - MaxPunchAge)
                throw new ArgumentException("EventDate is more than 7 days old.");
            return utc;
        }
    }
}
