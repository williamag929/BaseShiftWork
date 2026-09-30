using System;

namespace ShiftWork.Api.Services
{
    public static class LineupTime
    {
        public static TimeZoneInfo Resolve(string? id)
        {
            if (string.IsNullOrWhiteSpace(id)) return TimeZoneInfo.Utc;
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { return TimeZoneInfo.Utc; }
            catch (InvalidTimeZoneException) { return TimeZoneInfo.Utc; }
        }

        // Real instant for a local wall time in tz.
        public static DateTime ToUtc(DateOnly date, TimeOnly time, TimeZoneInfo tz)
        {
            var local = DateTime.SpecifyKind(date.ToDateTime(time), DateTimeKind.Unspecified);
            // Spring-forward gap: the wall time doesn't exist, so read it as one hour later.
            if (tz.IsInvalidTime(local)) local = local.AddHours(1);
            // Ambiguous (fall-back) times resolve to the standard-time instant by default; fine for scheduling.
            return DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeToUtc(local, tz), DateTimeKind.Utc);
        }

        // Real instants bounding a local calendar day; use for true-UTC data such as ShiftEvent.EventDate.
        public static (DateTime StartUtc, DateTime EndUtc) DayWindowUtc(DateOnly date, TimeZoneInfo tz) =>
            (ToUtc(date, TimeOnly.MinValue, tz), ToUtc(date.AddDays(1), TimeOnly.MinValue, tz));

        // Schedule shifts are stored as floating wall-clock digits labelled Kind=Utc (web grid, kiosk and mobile all read the UTC hours as wall time).
        public static DateTime WallClock(DateOnly date, TimeOnly time) =>
            DateTime.SpecifyKind(date.ToDateTime(time), DateTimeKind.Utc);

        public static (DateTime Start, DateTime End) WallDayWindow(DateOnly date) =>
            (WallClock(date, TimeOnly.MinValue), WallClock(date.AddDays(1), TimeOnly.MinValue));

        public static (DateTime Start, DateTime End) WallShiftWindow(DateOnly date, TimeOnly start, TimeOnly end)
        {
            var endDate = end <= start ? date.AddDays(1) : date;
            return (WallClock(date, start), WallClock(endDate, end));
        }

        public static DateTime WallToInstantUtc(DateTime wall, TimeZoneInfo tz) =>
            ToUtc(DateOnly.FromDateTime(wall), TimeOnly.FromDateTime(wall), tz);
    }
}
