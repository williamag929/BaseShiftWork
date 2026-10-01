using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public interface INfcPunchService
    {
        Task<NfcPunchResponse> PunchAsync(string companyId, int personId, NfcPunchRequest request);
    }

    public class NfcPunchService : INfcPunchService
    {
        public const string TapDescription = "NFC tap";
        public static readonly TimeSpan RepeatTapWindow = TimeSpan.FromSeconds(60);

        private readonly ShiftWorkContext _context;
        private readonly IShiftEventService _shiftEventService;
        private readonly IPeopleService _peopleService;
        private readonly IMemoryCache _cache;

        public NfcPunchService(ShiftWorkContext context, IShiftEventService shiftEventService, IPeopleService peopleService, IMemoryCache cache)
        {
            _context = context;
            _shiftEventService = shiftEventService;
            _peopleService = peopleService;
            _cache = cache;
        }

        public async Task<NfcPunchResponse> PunchAsync(string companyId, int personId, NfcPunchRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.TagKey))
                throw new NfcPunchRejectedException(400, "TAG_MISSING", "The tag link has no key.");
            if (request.EventLogId == Guid.Empty)
                throw new NfcPunchRejectedException(400, "EVENT_ID_MISSING", "eventLogId is required.");

            var isEmployee = await _context.Persons.AsNoTracking()
                .AnyAsync(p => p.PersonId == personId && p.CompanyId == companyId);
            if (!isEmployee)
                throw new NfcPunchRejectedException(403, "NOT_AN_EMPLOYEE", "You are not an employee of this company.");

            // A retried request returns the original punch instead of recording a second one.
            var existing = await _context.ShiftEvents.AsNoTracking()
                .FirstOrDefaultAsync(e => e.EventLogId == request.EventLogId);
            if (existing != null)
                return await ExistingResultAsync(existing, companyId, personId);

            var location = await _context.Locations
                .FirstOrDefaultAsync(l => l.NfcTagKey == request.TagKey && l.CompanyId == companyId);
            if (location == null)
                throw new NfcPunchRejectedException(404, "TAG_NOT_FOUND", "This tag is not linked to a site in your company.");

            var now = DateTime.UtcNow;
            DateTime eventDate;
            try
            {
                eventDate = PunchTime.Resolve(request.EventDate, now);
            }
            catch (ArgumentException ex)
            {
                throw new NfcPunchRejectedException(400, "EVENT_DATE_INVALID", ex.Message);
            }

            // Phones can report one physical tap twice, and people tap again when unsure. With no Undo,
            // that second tap would clock them straight back out, so it returns the first punch instead.
            var repeatSince = now - RepeatTapWindow;
            var recentTap = await _context.ShiftEvents.AsNoTracking()
                .Where(e => e.CompanyId == companyId && e.PersonId == personId
                            && e.LocationId == location.LocationId
                            && e.Description == TapDescription
                            && e.CreatedAt >= repeatSince)
                .OrderByDescending(e => e.CreatedAt)
                .FirstOrDefaultAsync();
            if (recentTap != null)
                return ToResponse(recentTap, location, repeated: true);

            var status = await _peopleService.GetPersonStatusShiftWork(personId);
            var isOnShift = !string.IsNullOrEmpty(status) && status.StartsWith("OnShift", StringComparison.OrdinalIgnoreCase);

            var dto = new ShiftEventDto
            {
                EventLogId = request.EventLogId,
                EventDate = eventDate,
                EventType = isOnShift ? "clockout" : "clockin",
                CompanyId = companyId,
                PersonId = personId,
                Description = TapDescription,
                KioskDevice = request.Device,
                GeoLocation = request.GeoLocation,
                LocationId = location.LocationId,
            };

            ShiftEvent created;
            try
            {
                created = await _shiftEventService.CreateShiftEventAsync(dto);
            }
            catch (InvalidOperationException ex)
            {
                throw new NfcPunchRejectedException(409, "TRANSITION_CONFLICT", ex.Message);
            }
            catch (DbUpdateException)
            {
                // A concurrent retry with the same eventLogId was saved first: answer with that one.
                _context.ChangeTracker.Clear();
                var winner = await _context.ShiftEvents.AsNoTracking()
                    .FirstOrDefaultAsync(e => e.EventLogId == request.EventLogId);
                if (winner == null) throw;
                return await ExistingResultAsync(winner, companyId, personId);
            }

            location.NfcLastTappedAt = now;
            await _context.SaveChangesAsync();
            // Same keys LocationsController caches under, so the admin form shows the new "Last tapped".
            _cache.Remove($"locations_{companyId}");
            _cache.Remove($"location_{companyId}_{location.LocationId}");

            return ToResponse(created, location, repeated: false);
        }

        private async Task<NfcPunchResponse> ExistingResultAsync(ShiftEvent existing, string companyId, int personId)
        {
            if (existing.CompanyId != companyId || existing.PersonId != personId)
                throw new NfcPunchRejectedException(409, "EVENT_ID_CONFLICT", "This event id was already used for a different punch.");

            var location = existing.LocationId.HasValue
                ? await _context.Locations.AsNoTracking().FirstOrDefaultAsync(l => l.LocationId == existing.LocationId.Value)
                : null;
            return ToResponse(existing, location, repeated: false);
        }

        private static NfcPunchResponse ToResponse(ShiftEvent e, Location? location, bool repeated) => new()
        {
            EventLogId = e.EventLogId,
            EventType = e.EventType ?? string.Empty,
            EventDate = e.EventDate,
            LocationId = location?.LocationId ?? e.LocationId ?? 0,
            LocationName = location?.Name ?? string.Empty,
            GeofenceStatus = e.GeofenceStatus ?? "Unknown",
            Repeated = repeated,
        };
    }
}
