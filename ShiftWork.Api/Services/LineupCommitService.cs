using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public interface ILineupCommitService
    {
        Task<LineupCommitResponse> CommitAsync(string companyId, DateOnly date, LineupCommitRequest request, LineupAccess access);
    }

    public class LineupCommitService : ILineupCommitService
    {
        private readonly ShiftWorkContext _context;
        private readonly ICompanyTimeZoneService _timeZones;
        private readonly IScheduleService _schedules;
        private readonly IScheduleValidationService _validation;
        private readonly IAvailabilityService _availability;
        private readonly ICompanySettingsService _settings;
        private readonly PushNotificationService _push;
        private readonly TimeProvider _time;
        private readonly ILogger<LineupCommitService> _logger;

        public LineupCommitService(
            ShiftWorkContext context,
            ICompanyTimeZoneService timeZones,
            IScheduleService schedules,
            IScheduleValidationService validation,
            IAvailabilityService availability,
            ICompanySettingsService settings,
            PushNotificationService push,
            TimeProvider time,
            ILogger<LineupCommitService> logger)
        {
            _context = context;
            _timeZones = timeZones;
            _schedules = schedules;
            _validation = validation;
            _availability = availability;
            _settings = settings;
            _push = push;
            _time = time;
            _logger = logger;
        }

        public async Task<LineupCommitResponse> CommitAsync(string companyId, DateOnly date, LineupCommitRequest request, LineupAccess access)
        {
            var results = new List<LineupCommitResultDto>();
            var now = _time.GetUtcNow().UtcDateTime;
            var companyTz = await _timeZones.GetAsync(companyId);
            var settings = await _settings.GetOrCreateSettings(companyId);
            var status = settings.AutoApproveShifts ? "Published" : "unpublished";

            // Removals run first so a move (remove at one site, assign at another) validates against the post-removal state.
            // ShiftId in the request/response carries a Schedule id (the lineup's unit of work).
            foreach (var scheduleId in request.Removals ?? new List<int>())
            {
                try { results.Add(await RemoveAsync(companyId, scheduleId, access, now, companyTz)); }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lineup removal of schedule {ScheduleId} failed for company {CompanyId}.", scheduleId, companyId);
                    DetachPending();
                    results.Add(Rejected(shiftId: scheduleId, error: "Could not remove this shift."));
                }
            }

            foreach (var a in request.Assignments ?? new List<LineupAssignmentDto>())
            {
                try { results.Add(await AssignAsync(companyId, date, a, access, status, companyTz, now)); }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lineup assignment of person {PersonId} failed for company {CompanyId}.", a.PersonId, companyId);
                    DetachPending();
                    results.Add(Rejected(a.PersonId, a.LocationId, error: "Could not assign this person."));
                }
            }
            return new LineupCommitResponse(results);
        }

        private async Task<LineupCommitResultDto> RemoveAsync(
            string companyId, int scheduleId, LineupAccess access, DateTime now, TimeZoneInfo companyTz)
        {
            var schedule = await _context.Schedules.AsNoTracking()
                .FirstOrDefaultAsync(s => s.ScheduleId == scheduleId && s.CompanyId == companyId);
            // Same answer for missing, foreign, site-less and out-of-scope so ids can't be probed.
            if (schedule == null || !schedule.LocationId.HasValue || !access.CanSeeLocation(schedule.LocationId.Value))
                return Rejected(shiftId: scheduleId, error: "Shift not found.");

            // Stored times are floating wall-clock; read them in the site's zone (company zone as fallback) to compare with the real instant "now".
            var locationId = schedule.LocationId.Value;
            var locationZone = await _context.Locations.AsNoTracking()
                .Where(l => l.LocationId == locationId && l.CompanyId == companyId)
                .Select(l => l.TimeZone)
                .FirstOrDefaultAsync();
            var zoneId = string.IsNullOrWhiteSpace(locationZone) ? companyTz.Id : locationZone;
            var startInstant = LineupTime.WallToInstantUtc(schedule.StartDate, LineupTime.Resolve(zoneId));
            if (startInstant <= now)
                return Rejected(shiftId: scheduleId, error: "Only future shifts can be removed.");

            if (!await _schedules.Delete(scheduleId))
                return Rejected(shiftId: scheduleId, error: "Shift not found.");

            return new LineupCommitResultDto
            {
                Status = "removed", ShiftId = scheduleId, LocationId = locationId,
                PersonId = int.TryParse(schedule.PersonId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var pid) ? pid : null
            };
        }

        private async Task<LineupCommitResultDto> AssignAsync(
            string companyId, DateOnly date, LineupAssignmentDto a, LineupAccess access, string status, TimeZoneInfo companyTz, DateTime now)
        {
            var location = await _context.Locations.AsNoTracking()
                .FirstOrDefaultAsync(l => l.LocationId == a.LocationId && l.CompanyId == companyId && l.Status == "Active");
            if (location == null) return Rejected(a.PersonId, a.LocationId, "Unknown job site.");
            if (!access.CanSeeLocation(a.LocationId)) return Rejected(a.PersonId, a.LocationId, "You can't edit this job site.");

            var person = await _context.Persons.AsNoTracking()
                .FirstOrDefaultAsync(p => p.PersonId == a.PersonId && p.CompanyId == companyId && p.Status == "Active");
            if (person == null) return Rejected(a.PersonId, a.LocationId, "Person not available.");

            var def = LocationDefaultShift.TryParse(location.Settings);
            TimeOnly start, end;
            if (a.Start != null || a.End != null)
            {
                if (!TryTime(a.Start, out start) || !TryTime(a.End, out end) || start == end)
                    return Rejected(a.PersonId, a.LocationId, "Invalid shift time.");
            }
            else if (def != null) { start = def.Start; end = def.End; }
            else return Rejected(a.PersonId, a.LocationId, "No shift time set for this location");

            var areaId = a.AreaId ?? def?.AreaId;
            if (areaId.HasValue)
            {
                var ok = await _context.Areas.AnyAsync(x => x.AreaId == areaId && x.LocationId == a.LocationId && x.CompanyId == companyId);
                if (!ok) return Rejected(a.PersonId, a.LocationId, "Unknown area.");
            }
            else
            {
                areaId = await _context.Areas.Where(x => x.LocationId == a.LocationId && x.CompanyId == companyId)
                    .OrderBy(x => x.AreaId).Select(x => (int?)x.AreaId).FirstOrDefaultAsync();
                if (!areaId.HasValue) return Rejected(a.PersonId, a.LocationId, "No area set for this location.");
            }

            // Floating wall-clock stored as Kind=Utc, exactly like every other writer of Schedule (no zone conversion).
            var (startWall, endWall) = LineupTime.WallShiftWindow(date, start, end);
            var personKey = a.PersonId.ToString(CultureInfo.InvariantCulture);

            var existing = await _context.Schedules.AsNoTracking().FirstOrDefaultAsync(s =>
                s.CompanyId == companyId && s.PersonId == personKey && s.LocationId == a.LocationId
                && s.StartDate == startWall && s.EndDate == endWall && s.Status.ToLower() != "void");
            if (existing != null)
                return new LineupCommitResultDto { Status = "unchanged", PersonId = a.PersonId, LocationId = a.LocationId, ShiftId = existing.ScheduleId };

            // Time off (approved request or sick/timeoff clock event) is final and never overridable by acceptWarnings.
            var timeOffPeople = await _availability.GetTimeOffPersonIdsAsync(companyId, startWall, endWall, companyTz);
            if (timeOffPeople.Contains(a.PersonId))
                return Rejected(a.PersonId, a.LocationId, "Time off");

            var candidate = new Schedule
            {
                Name = "Lineup " + date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                CompanyId = companyId, PersonId = personKey,
                LocationId = a.LocationId, AreaId = areaId,
                StartDate = startWall, EndDate = endWall,
                Status = status, Type = "Shift",
                TimeZone = string.IsNullOrWhiteSpace(location.TimeZone) ? companyTz.Id : location.TimeZone,
                CreatedBy = access.CompanyUserId, CreatedAt = now
            };

            var validation = await _validation.ValidateSchedule(companyId, candidate, a.PersonId);
            // Errors (including overlap) are never overridable; acceptWarnings only covers warnings.
            if (validation.Errors.Count > 0)
                return RejectedMany(a.PersonId, a.LocationId, validation.Errors.ToArray());
            if (validation.Warnings.Count > 0 && !a.AcceptWarnings)
                return new LineupCommitResultDto
                {
                    Status = "needs-confirmation", PersonId = a.PersonId, LocationId = a.LocationId,
                    Warnings = validation.Warnings.ToList()
                };

            var created = await _schedules.Add(candidate);

            if (status == "Published")
            {
                // NotifySchedulePublishedAsync looks recipients up through ScheduleShift rows, which a lineup Schedule
                // never has, so it would notify nobody. Notify the assigned person directly instead.
                try { await _push.NotifyShiftAssignedAsync(companyId, a.PersonId, created.ScheduleId, created.StartDate); }
                catch (Exception ex) { _logger.LogWarning(ex, "Push for lineup schedule {ScheduleId} failed.", created.ScheduleId); }
            }

            return new LineupCommitResultDto { Status = "created", PersonId = a.PersonId, LocationId = a.LocationId, ShiftId = created.ScheduleId };
        }

        // A failed SaveChanges leaves the bad entities tracked; drop them so later items in the batch start clean.
        private void DetachPending()
        {
            foreach (var e in _context.ChangeTracker.Entries()
                         .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted).ToList())
                e.State = EntityState.Detached;
        }

        private static bool TryTime(string? text, out TimeOnly time)
        {
            time = default;
            return text != null && TimeOnly.TryParseExact(text, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out time);
        }

        private static LineupCommitResultDto Rejected(int? personId = null, int? locationId = null, string? error = null, int? shiftId = null) =>
            RejectedMany(personId, locationId, error == null ? Array.Empty<string>() : new[] { error }, shiftId);

        private static LineupCommitResultDto RejectedMany(int? personId, int? locationId, string[] errors, int? shiftId = null) =>
            new() { Status = "rejected", PersonId = personId, LocationId = locationId, ShiftId = shiftId, Errors = errors.ToList() };
    }
}
