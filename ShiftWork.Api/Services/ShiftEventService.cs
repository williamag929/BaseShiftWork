using AutoMapper;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Text.Json;

namespace ShiftWork.Api.Services
{
    public class ShiftEventService : IShiftEventService
    {
        private readonly ShiftWorkContext _context;
        private readonly IMapper _mapper;
        private readonly IPeopleService _peopleService;

        public ShiftEventService(ShiftWorkContext context, IMapper mapper, IPeopleService peopleService)
        {
            _context = context;
            _mapper = mapper;
            _peopleService = peopleService;
        }

        public async Task<ShiftEvent> CreateShiftEventAsync(ShiftEventDto shiftEventDto)
        {
            var shiftEvent = _mapper.Map<ShiftEvent>(shiftEventDto);
            shiftEvent.CreatedAt = DateTime.UtcNow;
            shiftEvent.EventDate = DateTime.UtcNow;

            _context.ShiftEvents.Add(shiftEvent);
            await _context.SaveChangesAsync();

            // Update person status based on shift event
            if (shiftEvent.PersonId > 0)
            {
                var today = DateTime.UtcNow.Date;
                var scheduleShift = await _context.ScheduleShifts
                    .FirstOrDefaultAsync(ss => ss.PersonId == shiftEvent.PersonId && ss.StartDate.Date == today);
                string status = "";
                // Determine status based on shift event type and schedule shift
                if (scheduleShift != null)
                {

                    if (shiftEvent.EventType.Equals("clockin", StringComparison.OrdinalIgnoreCase))
                    {
                        status = "OnShift";
                        /**
                        var latenessThreshold = scheduleShift.StartDate.AddMinutes(5);
                        if (shiftEvent.EventDate > latenessThreshold)
                        {
                            status = "Late";
                        }
                        else if (shiftEvent.EventDate < scheduleShift.StartDate)
                        {
                            status = "Early";
                        }
                        else
                        {
                            status = "OnShift";
                        }**/
                    }
                    else if (shiftEvent.EventType.Equals("clockout", StringComparison.OrdinalIgnoreCase))
                    {
                        status = "OffShift";
                    }
                }
                else
                {
                    if (shiftEvent.EventType.Equals("clockin", StringComparison.OrdinalIgnoreCase))
                    {
                        status = "OnShift";
                    }
                    else if (shiftEvent.EventType.Equals("clockout", StringComparison.OrdinalIgnoreCase))
                    {
                        status = "OffShift";
                    }
                        
                    //_logger.LogWarning("No schedule shift found for person {PersonId} on date {Date}", shiftEvent.PersonId, today);
                }

                if (!string.IsNullOrEmpty(status))
                {
                    await _peopleService.UpdatePersonStatus(shiftEvent.PersonId, status);
                }
            }

            // Handle sick/timeoff events: open overlapping shifts for this person
            if (!string.IsNullOrEmpty(shiftEvent.EventType) &&
                (shiftEvent.EventType.Equals("sick", StringComparison.OrdinalIgnoreCase) ||
                 shiftEvent.EventType.Equals("timeoff", StringComparison.OrdinalIgnoreCase)))
            {
                DateTime? startWindow = null;
                DateTime? endWindow = null;
                if (!string.IsNullOrEmpty(shiftEvent.EventObject))
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(shiftEvent.EventObject);
                        var root = doc.RootElement;
                        if (root.TryGetProperty("start", out var s) && root.TryGetProperty("end", out var e))
                        {
                            if (DateTime.TryParse(s.GetString(), out var startParsed)) startWindow = startParsed.ToUniversalTime();
                            if (DateTime.TryParse(e.GetString(), out var endParsed)) endWindow = endParsed.ToUniversalTime();
                        }
                    }
                    catch
                    {
                        // ignore malformed JSON
                    }
                }
                if (!startWindow.HasValue || !endWindow.HasValue)
                {
                    var date = shiftEvent.EventDate.Date;
                    startWindow = date;
                    endWindow = date.AddDays(1);
                }

                var overlappingShifts = await _context.ScheduleShifts
                    .Where(ss => ss.PersonId == shiftEvent.PersonId &&
                                 ss.StartDate < endWindow.Value && ss.EndDate > startWindow.Value)
                    .ToListAsync();
                foreach (var ss in overlappingShifts)
                {
                    ss.Status = "open";
                }
                if (overlappingShifts.Count > 0)
                {
                    await _context.SaveChangesAsync();
                }
            }

            return shiftEvent;
        }

        public async Task<ShiftEvent> GetShiftEventByIdAsync(Guid id)
        {
            return await _context.ShiftEvents.FindAsync(id);
        }

        public async Task<IEnumerable<ShiftEvent>> GetShiftEventsByPersonIdAsync(string companyId, int personId)
        {
            return await _context.ShiftEvents
                .Where(e => e.CompanyId == companyId && e.PersonId == personId)
                .ToListAsync();
        }

        public async Task<IEnumerable<ShiftEvent>> GetShiftEventsByCompanyIdAsync(string companyId)
        {
            return await _context.ShiftEvents
                .Where(e => e.CompanyId == companyId)
                .ToListAsync();
        }

        public async Task<IEnumerable<ShiftEvent>> GetShiftEventsByEventTypeAsync(string companyId, string eventType)
        {
            return await _context.ShiftEvents
                .Where(e => e.EventType == eventType)
                .ToListAsync();
        }

        public async Task<ShiftEvent?> UpdateShiftEventAsync(Guid id, ShiftEventDto shiftEventDto)
        {
            var existing = await _context.ShiftEvents.FindAsync(id);
            if (existing == null)
            {
                return null;
            }

            // Map allowed fields from DTO onto existing entity
            _mapper.Map(shiftEventDto, existing);

            await _context.SaveChangesAsync();
            return existing;
        }

        public async Task<bool> DeleteShiftEventAsync(Guid id)
        {
            var existing = await _context.ShiftEvents.FindAsync(id);
            if (existing == null)
            {
                return false;
            }

            _context.ShiftEvents.Remove(existing);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
