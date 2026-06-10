using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public class ScheduleShiftSummaryService : IScheduleShiftSummaryService
    {
        private readonly ShiftWorkContext _context;

        public ScheduleShiftSummaryService(ShiftWorkContext context)
        {
            _context = context;
        }

        public async Task<List<ScheduleShiftSummaryDto>> GetScheduleShiftSummary(int companyId, DateTime startDate, DateTime endDate, int? locationId, int? personId)
        {
            var query = _context.ShiftEvents
                .Include(e => e.Person)
                .Where(e => e.CompanyId == companyId.ToString() && (e.EventType == "clockin" || e.EventType == "clockout"))
                .Where(e => e.EventDate >= startDate && e.EventDate <= endDate);

            if (personId.HasValue)
            {
                query = query.Where(e => e.PersonId == personId.Value);
            }

            var events = await query.ToListAsync();

            var summary = new List<ScheduleShiftSummaryDto>();

            var eventsByPersonAndDay = events.GroupBy(e => new { e.EventDate.Date, e.PersonId });

            foreach (var group in eventsByPersonAndDay)
            {
                var clockInEvent = group.FirstOrDefault(e => e.EventType == "clockin");
                var clockOutEvent = group.FirstOrDefault(e => e.EventType == "clockout");

                if (clockInEvent != null && clockOutEvent != null)
                {
                    // Try to extract location from EventObject; it may be null or a non-location JSON
                    int parsedLocationId = 0;
                    if (!string.IsNullOrWhiteSpace(clockInEvent.EventObject))
                    {
                        try
                        {
                            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                            var locationInfo = JsonSerializer.Deserialize<LocationDto>(clockInEvent.EventObject, options);
                            if (locationInfo != null)
                            {
                                parsedLocationId = locationInfo.LocationId;
                            }
                        }
                        catch (JsonException)
                        {
                            // EventObject is not a LocationDto (e.g. manual clock-in flags, photo data)
                        }
                    }

                    if (locationId.HasValue && parsedLocationId != locationId.Value)
                    {
                        continue;
                    }

                    Models.Location? location = null;
                    Models.Area? area = null;
                    if (parsedLocationId > 0)
                    {
                        location = await _context.Locations.Include(l => l.Areas).FirstOrDefaultAsync(l => l.LocationId == parsedLocationId);
                        area = location?.Areas?.FirstOrDefault();
                    }

                    // Get approval if exists for this person/day
                    var approval = await _context.ShiftSummaryApprovals
                        .AsNoTracking()
                        .FirstOrDefaultAsync(a => a.CompanyId == companyId.ToString()
                                              && a.PersonId == group.Key.PersonId
                                              && a.Day == group.Key.Date);

                    summary.Add(new ScheduleShiftSummaryDto
                    {
                        Day = group.Key.Date,
                        PersonId = group.Key.PersonId,
                        PersonName = clockInEvent.Person?.Name ?? $"Person {group.Key.PersonId}",
                        LocationId = location?.LocationId ?? 0,
                        LocationName = location?.Name ?? "Unknown",
                        AreaId = area?.AreaId ?? 0,
                        AreaName = area?.Name ?? "Unknown",
                        MinStartTime = clockInEvent.EventDate,
                        MaxEndTime = clockOutEvent.EventDate,
                        BreakTime = 30, // Default break time
                        TotalHours = (clockOutEvent.EventDate - clockInEvent.EventDate).TotalHours - 0.5, // Subtracting break time
                        Status = approval?.Status ?? "shifted",
                        ApprovedBy = approval?.ApprovedBy,
                        ApprovedAt = approval?.ApprovedAt
                    });
                }
            }

            return summary;
        }
    }
}