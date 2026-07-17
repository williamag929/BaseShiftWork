using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;

namespace ShiftWork.Api.Services
{
    /// <summary>
    /// All analytics aggregation happens here, server-side and scoped by CompanyId.
    /// Raw shift events are never returned to the client — only aggregated series.
    /// Facts are built once per (company, filters) request and cached 5 minutes.
    /// </summary>
    public class AnalyticsService : IAnalyticsService
    {
        private const double DefaultBreakHours = 0.5;
        private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

        private readonly ShiftWorkContext _context;
        private readonly IMemoryCache _cache;

        public AnalyticsService(ShiftWorkContext context, IMemoryCache cache)
        {
            _context = context;
            _cache = cache;
        }

        // ─── Internal fact models ────────────────────────────────────────────
        private sealed record WorkedFact(
            DateTime Day, int PersonId, string PersonName,
            int LocationId, string LocationName, int AreaId, string AreaName,
            double WorkedHours, DateTime ClockIn, bool HasClockOut);

        private sealed record ScheduledFact(
            DateTime Day, int PersonId, string PersonName,
            int LocationId, string LocationName, int AreaId, string AreaName,
            double ScheduledHours, DateTime Start, string Status, bool IsOpen);

        private sealed record Facts(List<WorkedFact> Worked, List<ScheduledFact> Scheduled, int UnclosedShifts);

        // ─── Public endpoints ────────────────────────────────────────────────

        public async Task<AnalyticsResponseDto> GetHoursSummaryAsync(int companyId, AnalyticsQueryDto query)
        {
            var facts = await GetFactsAsync(companyId, query);
            var dim = NormalizeDimension(query.GroupBy);

            var worked = Aggregate(facts.Worked, dim, f => (Key(dim, f.Day, f.PersonId, f.PersonName, f.LocationId, f.LocationName, f.AreaId, f.AreaName), f.WorkedHours));
            var scheduled = Aggregate(facts.Scheduled, dim, f => (Key(dim, f.Day, f.PersonId, f.PersonName, f.LocationId, f.LocationName, f.AreaId, f.AreaName), f.ScheduledHours));

            var workedTotal = facts.Worked.Sum(f => f.WorkedHours);
            var scheduledTotal = facts.Scheduled.Sum(f => f.ScheduledHours);

            return new AnalyticsResponseDto
            {
                Dimension = dim,
                Series = new()
                {
                    new AnalyticsSeriesDto { Key = "worked", Label = "Worked Hours", Points = worked },
                    new AnalyticsSeriesDto { Key = "scheduled", Label = "Scheduled Hours", Points = scheduled },
                },
                Totals = new()
                {
                    ["worked"] = Round(workedTotal),
                    ["scheduled"] = Round(scheduledTotal),
                    ["variancePct"] = Round(Pct(workedTotal - scheduledTotal, scheduledTotal)),
                    ["unclosedShifts"] = facts.UnclosedShifts,
                },
            };
        }

        public async Task<AnalyticsResponseDto> GetScheduleCoverageAsync(int companyId, AnalyticsQueryDto query)
        {
            var facts = await GetFactsAsync(companyId, query);
            var dim = NormalizeDimension(query.GroupBy);

            var filled = Aggregate(facts.Scheduled.Where(s => !s.IsOpen), dim, f => (Key(dim, f.Day, f.PersonId, f.PersonName, f.LocationId, f.LocationName, f.AreaId, f.AreaName), 1d));
            var open = Aggregate(facts.Scheduled.Where(s => s.IsOpen), dim, f => (Key(dim, f.Day, f.PersonId, f.PersonName, f.LocationId, f.LocationName, f.AreaId, f.AreaName), 1d));

            var total = facts.Scheduled.Count;
            var openCount = facts.Scheduled.Count(s => s.IsOpen);

            return new AnalyticsResponseDto
            {
                Dimension = dim,
                Series = new()
                {
                    new AnalyticsSeriesDto { Key = "filled", Label = "Filled Shifts", Points = filled },
                    new AnalyticsSeriesDto { Key = "open", Label = "Open Shifts", Points = open },
                },
                Totals = new()
                {
                    ["totalShifts"] = total,
                    ["openShifts"] = openCount,
                    ["coveragePct"] = Round(Pct(total - openCount, total)),
                },
            };
        }

        public async Task<AnalyticsResponseDto> GetAttendanceAsync(int companyId, AnalyticsQueryDto query)
        {
            var facts = await GetFactsAsync(companyId, query);
            var grace = await GetGraceMinutesAsync(companyId);
            var dim = NormalizeDimension(query.GroupBy);

            // Attendance is judged against assigned (non-open) scheduled shifts.
            var clockInByPersonDay = facts.Worked
                .GroupBy(w => (w.PersonId, w.Day.Date))
                .ToDictionary(g => g.Key, g => g.Min(w => w.ClockIn));

            var rows = new List<(string status, DateTime day, int personId, string personName, int locationId, string locationName, int areaId, string areaName)>();
            foreach (var s in facts.Scheduled.Where(s => !s.IsOpen))
            {
                string status;
                if (!clockInByPersonDay.TryGetValue((s.PersonId, s.Day.Date), out var clockIn))
                    status = "no-show";
                else if (clockIn <= s.Start.AddMinutes(grace))
                    status = "on-time";
                else
                    status = "late";
                rows.Add((status, s.Day, s.PersonId, s.PersonName, s.LocationId, s.LocationName, s.AreaId, s.AreaName));
            }

            List<AnalyticsPointDto> SeriesFor(string status) =>
                Aggregate(rows.Where(r => r.status == status), dim,
                    r => (Key(dim, r.day, r.personId, r.personName, r.locationId, r.locationName, r.areaId, r.areaName), 1d));

            var onTime = rows.Count(r => r.status == "on-time");
            var late = rows.Count(r => r.status == "late");
            var noShow = rows.Count(r => r.status == "no-show");
            var totalJudged = rows.Count;

            return new AnalyticsResponseDto
            {
                Dimension = dim,
                Series = new()
                {
                    new AnalyticsSeriesDto { Key = "on-time", Label = "On Time", Points = SeriesFor("on-time") },
                    new AnalyticsSeriesDto { Key = "late", Label = "Late", Points = SeriesFor("late") },
                    new AnalyticsSeriesDto { Key = "no-show", Label = "No Show", Points = SeriesFor("no-show") },
                },
                Totals = new()
                {
                    ["onTime"] = onTime,
                    ["late"] = late,
                    ["noShow"] = noShow,
                    ["onTimePct"] = Round(Pct(onTime, totalJudged)),
                },
            };
        }

        public async Task<AnalyticsResponseDto> GetVarianceAsync(int companyId, AnalyticsQueryDto query)
        {
            var facts = await GetFactsAsync(companyId, query);
            // Variance is most useful per person or per location; default to person.
            var dim = query.GroupBy is "location" or "area" ? NormalizeDimension(query.GroupBy) : "person";

            var worked = Aggregate(facts.Worked, dim, f => (Key(dim, f.Day, f.PersonId, f.PersonName, f.LocationId, f.LocationName, f.AreaId, f.AreaName), f.WorkedHours));
            var scheduled = Aggregate(facts.Scheduled, dim, f => (Key(dim, f.Day, f.PersonId, f.PersonName, f.LocationId, f.LocationName, f.AreaId, f.AreaName), f.ScheduledHours));

            var workedTotal = facts.Worked.Sum(f => f.WorkedHours);
            var scheduledTotal = facts.Scheduled.Sum(f => f.ScheduledHours);

            return new AnalyticsResponseDto
            {
                Dimension = dim,
                Series = new()
                {
                    new AnalyticsSeriesDto { Key = "scheduled", Label = "Scheduled Hours", Points = scheduled },
                    new AnalyticsSeriesDto { Key = "worked", Label = "Worked Hours", Points = worked },
                },
                Totals = new()
                {
                    ["worked"] = Round(workedTotal),
                    ["scheduled"] = Round(scheduledTotal),
                    ["varianceHours"] = Round(workedTotal - scheduledTotal),
                    ["variancePct"] = Round(Pct(workedTotal - scheduledTotal, scheduledTotal)),
                },
            };
        }

        public async Task<AnalyticsKpisDto> GetKpisAsync(int companyId, AnalyticsQueryDto query)
        {
            var cur = await GetFactsAsync(companyId, query);

            // Previous equal-length window immediately before [from, to].
            var span = query.To - query.From;
            var prevQuery = Clone(query);
            prevQuery.To = query.From;
            prevQuery.From = query.From - span;
            var prev = await GetFactsAsync(companyId, prevQuery);

            var graceMin = await GetGraceMinutesAsync(companyId);

            double OnTimePct(Facts f)
            {
                var clockIns = f.Worked.GroupBy(w => (w.PersonId, w.Day.Date))
                    .ToDictionary(g => g.Key, g => g.Min(w => w.ClockIn));
                int on = 0, judged = 0;
                foreach (var s in f.Scheduled.Where(s => !s.IsOpen))
                {
                    judged++;
                    if (clockIns.TryGetValue((s.PersonId, s.Day.Date), out var ci) && ci <= s.Start.AddMinutes(graceMin))
                        on++;
                }
                return Pct(on, judged);
            }

            AnalyticsKpiDto Kpi(string key, string format, double value, double previous) => new()
            {
                Key = key,
                Format = format,
                Value = Round(value),
                PreviousValue = Round(previous),
                DeltaPct = Round(Pct(value - previous, previous)),
            };

            return new AnalyticsKpisDto
            {
                Kpis = new()
                {
                    Kpi("worked", "hours", cur.Worked.Sum(f => f.WorkedHours), prev.Worked.Sum(f => f.WorkedHours)),
                    Kpi("scheduled", "hours", cur.Scheduled.Sum(f => f.ScheduledHours), prev.Scheduled.Sum(f => f.ScheduledHours)),
                    Kpi("onTimePct", "percent", OnTimePct(cur), OnTimePct(prev)),
                    Kpi("openShifts", "count", cur.Scheduled.Count(s => s.IsOpen), prev.Scheduled.Count(s => s.IsOpen)),
                },
            };
        }

        public async Task<AnalyticsDrilldownResultDto> GetDrilldownAsync(int companyId, AnalyticsQueryDto query, string? bucket, int page, int pageSize)
        {
            var facts = await GetFactsAsync(companyId, query);
            var grace = await GetGraceMinutesAsync(companyId);
            var dim = NormalizeDimension(query.GroupBy);

            var workedByKey = facts.Worked
                .GroupBy(w => (w.PersonId, w.Day.Date))
                .ToDictionary(g => g.Key, g => g.First());

            var rows = new List<AnalyticsDrilldownRowDto>();

            // Scheduled rows (with matched worked hours + attendance status).
            foreach (var s in facts.Scheduled)
            {
                workedByKey.TryGetValue((s.PersonId, s.Day.Date), out var w);
                var workedHours = w?.WorkedHours ?? 0;
                string status;
                if (s.IsOpen) status = "open";
                else if (w == null) status = "no-show";
                else if (w.ClockIn <= s.Start.AddMinutes(grace)) status = "on-time";
                else status = "late";

                rows.Add(new AnalyticsDrilldownRowDto
                {
                    Day = s.Day.Date,
                    PersonId = s.PersonId,
                    PersonName = s.PersonName,
                    LocationId = s.LocationId,
                    LocationName = s.LocationName,
                    ScheduledHours = Round(s.ScheduledHours),
                    WorkedHours = Round(workedHours),
                    VarianceHours = Round(workedHours - s.ScheduledHours),
                    Status = status,
                });
            }

            // Worked-but-unscheduled rows (person clocked in with no scheduled shift that day).
            var scheduledKeys = facts.Scheduled.Select(s => (s.PersonId, s.Day.Date)).ToHashSet();
            foreach (var w in facts.Worked.Where(w => !scheduledKeys.Contains((w.PersonId, w.Day.Date))))
            {
                rows.Add(new AnalyticsDrilldownRowDto
                {
                    Day = w.Day.Date,
                    PersonId = w.PersonId,
                    PersonName = w.PersonName,
                    LocationId = w.LocationId,
                    LocationName = w.LocationName,
                    ScheduledHours = 0,
                    WorkedHours = Round(w.WorkedHours),
                    VarianceHours = Round(w.WorkedHours),
                    Status = "unscheduled",
                });
            }

            // Optional: restrict to the clicked chart segment.
            if (!string.IsNullOrWhiteSpace(bucket))
            {
                rows = rows.Where(r =>
                    Key(dim, r.Day, r.PersonId, r.PersonName, r.LocationId, r.LocationName, 0, string.Empty).label == bucket).ToList();
            }

            var ordered = rows.OrderBy(r => r.Day).ThenBy(r => r.PersonName).ToList();
            var pageRows = ordered.Skip((page - 1) * pageSize).Take(pageSize).ToList();

            return new AnalyticsDrilldownResultDto
            {
                Rows = pageRows,
                Total = ordered.Count,
                Page = page,
                PageSize = pageSize,
            };
        }

        // ─── Fact building (cached) ──────────────────────────────────────────

        private async Task<Facts> GetFactsAsync(int companyId, AnalyticsQueryDto query)
        {
            var cacheKey = $"analytics:facts:{companyId}:{query.From:o}:{query.To:o}:{query.LocationId}:{query.AreaId}:{query.PersonId}";
            if (_cache.TryGetValue(cacheKey, out Facts? cached) && cached != null)
                return cached;

            var facts = await BuildFactsAsync(companyId, query);
            _cache.Set(cacheKey, facts, CacheTtl);
            return facts;
        }

        private async Task<Facts> BuildFactsAsync(int companyId, AnalyticsQueryDto query)
        {
            var companyIdStr = companyId.ToString();

            // Name lookups (avoids N+1 when resolving labels).
            var persons = await _context.Persons
                .Where(p => p.CompanyId == companyIdStr)
                .Select(p => new { p.PersonId, p.Name })
                .ToDictionaryAsync(p => p.PersonId, p => p.Name);
            var locations = await _context.Locations
                .Where(l => l.CompanyId == companyIdStr)
                .Select(l => new { l.LocationId, l.Name })
                .ToDictionaryAsync(l => l.LocationId, l => l.Name);
            var areas = await _context.Areas
                .Where(a => a.CompanyId == companyIdStr)
                .Select(a => new { a.AreaId, a.Name })
                .ToDictionaryAsync(a => a.AreaId, a => a.Name);

            string PersonName(int id) => persons.TryGetValue(id, out var n) ? n : $"Person {id}";
            string LocationName(int id) => id > 0 && locations.TryGetValue(id, out var n) ? n : "Unassigned";
            string AreaName(int id) => id > 0 && areas.TryGetValue(id, out var n) ? n : "Unassigned";

            // ── Scheduled shifts ──
            var shiftQuery = _context.ScheduleShifts
                .Where(s => s.CompanyId == companyIdStr && s.StartDate >= query.From && s.StartDate <= query.To);
            if (query.LocationId.HasValue) shiftQuery = shiftQuery.Where(s => s.LocationId == query.LocationId.Value);
            if (query.AreaId.HasValue) shiftQuery = shiftQuery.Where(s => s.AreaId == query.AreaId.Value);
            if (query.PersonId.HasValue) shiftQuery = shiftQuery.Where(s => s.PersonId == query.PersonId.Value);

            var shifts = await shiftQuery
                .Select(s => new { s.PersonId, s.LocationId, s.AreaId, s.StartDate, s.EndDate, s.BreakDuration, s.Status })
                .ToListAsync();

            var scheduled = shifts.Select(s =>
            {
                var isOpen = s.PersonId <= 0 || string.Equals(s.Status, "Open", StringComparison.OrdinalIgnoreCase);
                var hours = Math.Max(0, (s.EndDate - s.StartDate).TotalHours - (s.BreakDuration ?? 0) / 60.0);
                return new ScheduledFact(
                    s.StartDate.Date, s.PersonId, PersonName(s.PersonId),
                    s.LocationId, LocationName(s.LocationId), s.AreaId, AreaName(s.AreaId),
                    hours, s.StartDate, s.Status ?? string.Empty, isOpen);
            }).ToList();

            // Map person+day → (locationId, areaId) from the schedule, to attribute worked hours.
            var locByPersonDay = scheduled
                .GroupBy(s => (s.PersonId, s.Day))
                .ToDictionary(g => g.Key, g => (g.First().LocationId, g.First().AreaId));

            // ── Worked hours from clockin/clockout pairs ──
            var eventQuery = _context.ShiftEvents
                .Where(e => e.CompanyId == companyIdStr
                    && (e.EventType == "clockin" || e.EventType == "clockout")
                    && e.EventDate >= query.From && e.EventDate <= query.To);
            if (query.PersonId.HasValue) eventQuery = eventQuery.Where(e => e.PersonId == query.PersonId.Value);

            var events = await eventQuery
                .Select(e => new { e.PersonId, e.EventType, e.EventDate })
                .ToListAsync();

            var worked = new List<WorkedFact>();
            var unclosed = 0;
            foreach (var g in events.GroupBy(e => new { e.PersonId, Day = e.EventDate.Date }))
            {
                var clockIn = g.Where(e => e.EventType == "clockin").Select(e => (DateTime?)e.EventDate).Min();
                var clockOut = g.Where(e => e.EventType == "clockout").Select(e => (DateTime?)e.EventDate).Max();
                if (clockIn == null) continue;
                if (clockOut == null) { unclosed++; continue; } // unclosed shift — excluded from worked totals

                var hours = Math.Max(0, (clockOut.Value - clockIn.Value).TotalHours - DefaultBreakHours);
                locByPersonDay.TryGetValue((g.Key.PersonId, g.Key.Day), out var loc);
                var (locId, areaId) = loc;

                worked.Add(new WorkedFact(
                    g.Key.Day, g.Key.PersonId, PersonName(g.Key.PersonId),
                    locId, LocationName(locId), areaId, AreaName(areaId),
                    hours, clockIn.Value, HasClockOut: true));
            }

            // Apply location/area filter to worked facts (attributed from schedule).
            if (query.LocationId.HasValue) worked = worked.Where(w => w.LocationId == query.LocationId.Value).ToList();
            if (query.AreaId.HasValue) worked = worked.Where(w => w.AreaId == query.AreaId.Value).ToList();

            return new Facts(worked, scheduled, unclosed);
        }

        // ─── Aggregation helpers ─────────────────────────────────────────────

        private static List<AnalyticsPointDto> Aggregate<T>(IEnumerable<T> source, string dim, Func<T, ((string key, string label) bucket, double value)> selector)
        {
            var groups = new Dictionary<string, (string label, double sum)>();
            foreach (var item in source)
            {
                var (bucket, value) = selector(item);
                if (groups.TryGetValue(bucket.key, out var g))
                    groups[bucket.key] = (g.label, g.sum + value);
                else
                    groups[bucket.key] = (bucket.label, value);
            }

            var isDate = dim is "day" or "week" or "month";
            var ordered = isDate
                ? groups.OrderBy(kv => kv.Key, StringComparer.Ordinal)
                : groups.OrderByDescending(kv => kv.Value.sum);

            return ordered
                .Select(kv => new AnalyticsPointDto { X = kv.Value.label, Y = Round(kv.Value.sum) })
                .ToList();
        }

        private static (string key, string label) Key(string dim, DateTime day, int personId, string personName, int locationId, string locationName, int areaId, string areaName)
        {
            switch (dim)
            {
                case "week":
                    var weekStart = day.Date.AddDays(-((int)day.DayOfWeek + 6) % 7); // ISO Monday
                    return (weekStart.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), weekStart.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                case "month":
                    return (day.ToString("yyyy-MM", CultureInfo.InvariantCulture), day.ToString("yyyy-MM", CultureInfo.InvariantCulture));
                case "person":
                    return ($"p{personId}", personName);
                case "location":
                    return ($"l{locationId}", locationName);
                case "area":
                    return ($"a{areaId}", areaName);
                case "day":
                default:
                    return (day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            }
        }

        private static string NormalizeDimension(string? groupBy)
        {
            var g = (groupBy ?? "day").Trim().ToLowerInvariant();
            return g is "day" or "week" or "month" or "person" or "location" or "area" ? g : "day";
        }

        private async Task<int> GetGraceMinutesAsync(int companyId)
        {
            var companyIdStr = companyId.ToString();
            var grace = await _context.CompanySettings
                .Where(cs => cs.CompanyId == companyIdStr)
                .Select(cs => (int?)cs.GracePeriodLateClockIn)
                .FirstOrDefaultAsync();
            return grace ?? 5;
        }

        private static double Pct(double numerator, double denominator) =>
            denominator == 0 ? 0 : numerator / denominator * 100.0;

        private static double Round(double v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

        private static AnalyticsQueryDto Clone(AnalyticsQueryDto q) => new()
        {
            From = q.From,
            To = q.To,
            LocationId = q.LocationId,
            AreaId = q.AreaId,
            PersonId = q.PersonId,
            GroupBy = q.GroupBy,
        };
    }
}
