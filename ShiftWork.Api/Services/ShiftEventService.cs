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
        private readonly ICompanySettingsService _settingsService;

        public ShiftEventService(ShiftWorkContext context, IMapper mapper, IPeopleService peopleService, ICompanySettingsService settingsService)
        {
            _context = context;
            _mapper = mapper;
            _peopleService = peopleService;
            _settingsService = settingsService;
        }

        public async Task<ShiftEvent> CreateShiftEventAsync(ShiftEventDto shiftEventDto)
        {
            var shiftEvent = _mapper.Map<ShiftEvent>(shiftEventDto);
            shiftEvent.CreatedAt = DateTime.UtcNow;
            shiftEvent.EventDate = shiftEventDto.EventDate == default ? DateTime.UtcNow : shiftEventDto.EventDate;
            // Ensure PhotoUrl from DTO is preserved even if mapper configuration changes
            shiftEvent.PhotoUrl = shiftEventDto.PhotoUrl;

            // Idempotency guard: prevent double clock-in/out based on current StatusShiftWork
            if (shiftEvent.PersonId > 0 && !string.IsNullOrWhiteSpace(shiftEvent.EventType))
            {
                var currentStatus = await _peopleService.GetPersonStatusShiftWork(shiftEvent.PersonId);
                var isOnShift = !string.IsNullOrEmpty(currentStatus) && currentStatus.StartsWith("OnShift", StringComparison.OrdinalIgnoreCase);
                var isOffShift = string.IsNullOrEmpty(currentStatus) || currentStatus.StartsWith("OffShift", StringComparison.OrdinalIgnoreCase);
                var allowManualClockOut = false;
                if (!string.IsNullOrWhiteSpace(shiftEvent.EventObject))
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(shiftEvent.EventObject);
                        if (doc.RootElement.TryGetProperty("manualClockOut", out var manualFlag) && manualFlag.ValueKind == JsonValueKind.True)
                        {
                            allowManualClockOut = true;
                        }
                    }
                    catch
                    {
                        // ignore malformed JSON
                    }
                }

                if (string.Equals(shiftEvent.EventType, "clockin", StringComparison.OrdinalIgnoreCase))
                {
                    if (isOnShift)
                    {
                        var allowManualClockIn = false;
                        if (!string.IsNullOrWhiteSpace(shiftEvent.EventObject))
                        {
                            try
                            {
                                using var doc = JsonDocument.Parse(shiftEvent.EventObject);
                                if (doc.RootElement.TryGetProperty("manualClockIn", out var manualFlag) && manualFlag.ValueKind == JsonValueKind.True)
                                {
                                    allowManualClockIn = true;
                                }
                            }
                            catch
                            {
                                // ignore malformed JSON
                            }
                        }

                        if (!allowManualClockIn)
                        {
                            throw new InvalidOperationException("Person is already OnShift. Duplicate clock-in prevented.");
                        }
                    }
                }
                else if (string.Equals(shiftEvent.EventType, "clockout", StringComparison.OrdinalIgnoreCase))
                {
                    if (isOffShift && !allowManualClockOut)
                    {
                        throw new InvalidOperationException("Person is not currently OnShift. Duplicate clock-out or invalid transition prevented.");
                    }
                }
            }

            _context.ShiftEvents.Add(shiftEvent);
            await _context.SaveChangesAsync();

            // Update person status based on shift event
            if (shiftEvent.PersonId > 0)
            {
                // Use an overlap check for "today" in UTC to avoid timezone date mismatches.
                var nowUtc = shiftEvent.EventDate;
                var startOfDayUtc = nowUtc.Date;
                var endOfDayUtc = startOfDayUtc.AddDays(1);

                var scheduleShift = await _context.ScheduleShifts
                    .Where(ss => ss.PersonId == shiftEvent.PersonId &&
                                 ss.StartDate < endOfDayUtc &&
                                 ss.EndDate > startOfDayUtc)
                    .OrderBy(ss => ss.StartDate)
                    .FirstOrDefaultAsync();

                string status = "";
                // Determine status based on shift event type and schedule shift
                if (scheduleShift != null)
                {
                    if (string.Equals(shiftEvent.EventType, "clockin", StringComparison.OrdinalIgnoreCase))
                    {
                        // Compute Late/Early/OnTime relative to scheduled start with 5-minute grace
                        var startUtc = scheduleShift.StartDate;
                        var diffMinutes = (nowUtc - startUtc).TotalMinutes;
                        string timing;
                        if (diffMinutes > 5)
                        {
                            timing = "Late";
                        }
                        else if (diffMinutes < -5)
                        {
                            timing = "Early";
                        }
                        else
                        {
                            timing = "OnTime";
                        }
                        status = $"OnShift:{timing}";
                    }
                    else if (string.Equals(shiftEvent.EventType, "clockout", StringComparison.OrdinalIgnoreCase))
                    {
                        status = "OffShift";
                    }
                }
                else
                {
                    if (string.Equals(shiftEvent.EventType, "clockin", StringComparison.OrdinalIgnoreCase))
                    {
                        // No schedule found overlapping today; mark as OnShift with NoSchedule detail
                        status = "OnShift:NoSchedule";
                    }
                    else if (string.Equals(shiftEvent.EventType, "clockout", StringComparison.OrdinalIgnoreCase))
                    {
                        status = "OffShift";
                    }
                }

                if (!string.IsNullOrEmpty(status))
                {
                    // Update ShiftWork status (kiosk-specific) instead of general person status
                    await _peopleService.UpdatePersonStatusShiftWork(shiftEvent.PersonId, status);
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

        public async Task<ShiftEvent?> GetShiftEventByIdAsync(Guid id)
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

        public async Task<bool> EnsureAutoClockOutForPersonAsync(string companyId, int personId, DateTime? nowUtc = null)
        {
            var settings = await _settingsService.GetOrCreateSettings(companyId);
            if (settings.AutoClockOutAfter <= 0)
            {
                return false;
            }

            var now = nowUtc ?? DateTime.UtcNow;

            var lastClockIn = await _context.ShiftEvents
                .Where(e => e.CompanyId == companyId && e.PersonId == personId && e.EventType == "clockin")
                .OrderByDescending(e => e.EventDate)
                .FirstOrDefaultAsync();

            if (lastClockIn == null)
            {
                return false;
            }

            var lastClockOutAfter = await _context.ShiftEvents
                .Where(e => e.CompanyId == companyId && e.PersonId == personId && e.EventType == "clockout" && e.EventDate >= lastClockIn.EventDate)
                .OrderByDescending(e => e.EventDate)
                .FirstOrDefaultAsync();

            if (lastClockOutAfter != null)
            {
                return false;
            }

            var autoClockOutAt = lastClockIn.EventDate.AddHours(settings.AutoClockOutAfter);
            if (autoClockOutAt > now)
            {
                return false;
            }

            var autoEvent = new ShiftEvent
            {
                EventLogId = Guid.NewGuid(),
                CompanyId = companyId,
                PersonId = personId,
                EventType = "clockout",
                EventDate = autoClockOutAt,
                CreatedAt = now,
                Description = "Auto clock-out",
                EventObject = "{\"autoClockOut\":true}"
            };

            _context.ShiftEvents.Add(autoEvent);
            await _context.SaveChangesAsync();

            await _peopleService.UpdatePersonStatusShiftWork(personId, "OffShift");
            return true;
        }
    }
}
