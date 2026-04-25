using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public interface IDailyReportService
    {
        Task<List<LocationDailyReport>> GetReportsAsync(string companyId, int locationId, DateOnly? startDate = null, DateOnly? endDate = null, string? status = null);
        Task<LocationDailyReport> GetOrCreateAsync(string companyId, int locationId, DateOnly date);
        Task<LocationDailyReport?> UpdateAsync(Guid reportId, string companyId, string? notes, string status, int submittedByPersonId);
        Task<ReportMedia> AddMediaAsync(Guid reportId, string companyId, int personId, string mediaType, string mediaUrl, string? caption, Guid? shiftEventId = null);
        Task<bool> RemoveMediaAsync(Guid mediaId, Guid reportId, string companyId);
    }

    public class DailyReportService : IDailyReportService
    {
        private readonly ShiftWorkContext _context;
        private readonly IWeatherService _weather;
        private readonly ILogger<DailyReportService> _logger;

        public DailyReportService(ShiftWorkContext context, IWeatherService weather, ILogger<DailyReportService> logger)
        {
            _context = context;
            _weather = weather;
            _logger = logger;
        }

        public async Task<List<LocationDailyReport>> GetReportsAsync(string companyId, int locationId, DateOnly? startDate = null, DateOnly? endDate = null, string? status = null)
        {
            var query = _context.LocationDailyReports
                .Include(r => r.Media)
                .Where(r => r.CompanyId == companyId && r.LocationId == locationId);

            if (startDate.HasValue) query = query.Where(r => r.ReportDate >= startDate.Value);
            if (endDate.HasValue)   query = query.Where(r => r.ReportDate <= endDate.Value);
            if (!string.IsNullOrEmpty(status)) query = query.Where(r => r.Status == status);

            return await query.OrderByDescending(r => r.ReportDate).ToListAsync();
        }

        public async Task<LocationDailyReport> GetOrCreateAsync(string companyId, int locationId, DateOnly date)
        {
            var report = await _context.LocationDailyReports
                .Include(r => r.Media)
                .FirstOrDefaultAsync(r => r.CompanyId == companyId && r.LocationId == locationId && r.ReportDate == date);

            if (report != null) return report;

            // Auto-create draft for the requested date
            report = new LocationDailyReport
            {
                CompanyId = companyId,
                LocationId = locationId,
                ReportDate = date,
                Status = "Draft",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            // Fetch weather for today only — historical dates skip it
            if (date == DateOnly.FromDateTime(DateTime.UtcNow))
            {
                var location = await _context.Locations.FindAsync(locationId);
                if (location != null && !string.IsNullOrEmpty(location.GeoCoordinates))
                {
                    var coords = ParseCoordinates(location.GeoCoordinates);
                    if (coords.HasValue)
                    {
                        var snapshot = await _weather.GetCurrentWeatherAsync(coords.Value.lat, coords.Value.lon);
                        if (snapshot != null)
                            report.WeatherDataJson = JsonSerializer.Serialize(snapshot);
                    }
                }
            }

            var (employees, hours) = await AggregateShiftTotalsAsync(companyId, locationId, date);
            report.TotalEmployees = employees;
            report.TotalHours = hours;

            _context.LocationDailyReports.Add(report);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Daily report created for Location {LocationId} on {Date} at Company {CompanyId}", locationId, date, companyId);
            return report;
        }

        public async Task<LocationDailyReport?> UpdateAsync(Guid reportId, string companyId, string? notes, string status, int submittedByPersonId)
        {
            var report = await _context.LocationDailyReports
                .Include(r => r.Media)
                .FirstOrDefaultAsync(r => r.ReportId == reportId && r.CompanyId == companyId);

            if (report == null) return null;

            report.Notes = notes;
            report.UpdatedAt = DateTime.UtcNow;

            if (status == "Submitted" && report.Status == "Draft")
            {
                // Snapshot live totals before locking the report
                var (employees, hours) = await AggregateShiftTotalsAsync(companyId, report.LocationId, report.ReportDate);
                report.TotalEmployees = employees;
                report.TotalHours = hours;
                report.Status = "Submitted";
                report.SubmittedByPersonId = submittedByPersonId;
            }
            else if (status == "Approved" && report.Status == "Submitted")
            {
                report.Status = "Approved";
            }
            else
            {
                report.Status = status;
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Report {ReportId} status changed to {Status} by Person {PersonId} at Company {CompanyId}", reportId, status, submittedByPersonId, companyId);
            return report;
        }

        public async Task<ReportMedia> AddMediaAsync(Guid reportId, string companyId, int personId, string mediaType, string mediaUrl, string? caption, Guid? shiftEventId = null)
        {
            var media = new ReportMedia
            {
                ReportId = reportId,
                PersonId = personId,
                MediaType = mediaType,
                MediaUrl = mediaUrl,
                Caption = caption,
                ShiftEventId = shiftEventId,
                UploadedAt = DateTime.UtcNow
            };

            _context.ReportMedia.Add(media);
            await _context.SaveChangesAsync();
            return media;
        }

        public async Task<bool> RemoveMediaAsync(Guid mediaId, Guid reportId, string companyId)
        {
            var media = await _context.ReportMedia
                .FirstOrDefaultAsync(m => m.MediaId == mediaId && m.ReportId == reportId);

            if (media == null) return false;

            _context.ReportMedia.Remove(media);
            await _context.SaveChangesAsync();
            return true;
        }

        private async Task<(int employees, decimal hours)> AggregateShiftTotalsAsync(string companyId, int locationId, DateOnly date)
        {
            var dayStart = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var dayEnd   = date.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

            var events = await _context.ShiftEvents
                .Where(e => e.CompanyId == companyId
                    && e.EventDate >= dayStart
                    && e.EventDate <= dayEnd)
                .ToListAsync();

            // Filter by location via schedule — ShiftEvent has no direct LocationId
            var scheduledPersonIds = await _context.ScheduleShifts
                .Where(ss => ss.LocationId == locationId
                    && _context.Schedules.Any(s => s.ScheduleId == ss.ScheduleId && s.CompanyId == companyId
                        && s.StartDate <= dayEnd && s.EndDate >= dayStart))
                .Select(ss => ss.PersonId)
                .Distinct()
                .ToListAsync();

            var locationEvents = events.Where(e => scheduledPersonIds.Contains(e.PersonId)).ToList();

            var clockIns  = locationEvents.Where(e => e.EventType == "clock_in").ToList();
            var clockOuts = locationEvents.Where(e => e.EventType == "clock_out").ToList();

            var uniqueEmployees = clockIns.Select(e => e.PersonId).Distinct().Count();

            var totalHours = 0m;
            foreach (var personId in scheduledPersonIds)
            {
                var ins  = clockIns.Where(e => e.PersonId == personId).OrderBy(e => e.EventDate).ToList();
                var outs = clockOuts.Where(e => e.PersonId == personId).OrderBy(e => e.EventDate).ToList();

                for (var i = 0; i < ins.Count && i < outs.Count; i++)
                    totalHours += (decimal)(outs[i].EventDate - ins[i].EventDate).TotalHours;
            }

            return (uniqueEmployees, Math.Round(totalHours, 2));
        }

        private static (double lat, double lon)? ParseCoordinates(string geoCoordinates)
        {
            // Supports "lat,lon" string format
            var parts = geoCoordinates.Split(',');
            if (parts.Length == 2
                && double.TryParse(parts[0].Trim(), out var lat)
                && double.TryParse(parts[1].Trim(), out var lon))
                return (lat, lon);

            return null;
        }
    }
}
