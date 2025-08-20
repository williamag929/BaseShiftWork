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

        public async Task<List<ScheduleShiftSummaryDto>> GetScheduleShiftSummary(int companyId)
        {
            var events = await _context.ShiftEvents
                .Include(e => e.Person)
                .Where(e => e.CompanyId == companyId.ToString() && (e.EventType == "clockin" || e.EventType == "clockout"))
                .ToListAsync();

            var summary = new List<ScheduleShiftSummaryDto>();

            var eventsByPersonAndDay = events.GroupBy(e => new { e.EventDate.Date, e.PersonId });

            foreach (var group in eventsByPersonAndDay)
            {
                var clockInEvent = group.FirstOrDefault(e => e.EventType == "clockin");
                var clockOutEvent = group.FirstOrDefault(e => e.EventType == "clockout");

                if (clockInEvent != null && clockOutEvent != null)
                {
                    var locationInfo = JsonSerializer.Deserialize<LocationDto>(clockInEvent.EventObject);
                    var location = await _context.Locations.Include(l => l.Areas).FirstOrDefaultAsync(l => l.LocationId == locationInfo.LocationId);
                    var area = location?.Areas.FirstOrDefault();

                    summary.Add(new ScheduleShiftSummaryDto
                    {
                        Day = group.Key.Date,
                        PersonId = group.Key.PersonId,
                        PersonName = clockInEvent.Person.Name,
                        LocationId = location.LocationId,
                        LocationName = location.Name,
                        AreaId = area.AreaId,
                        AreaName = area.Name,
                        MinStartTime = clockInEvent.EventDate,
                        MaxEndTime = clockOutEvent.EventDate,
                        BreakTime = 30 // Default break time
                    });
                }
            }

            return summary;
        }
    }
}