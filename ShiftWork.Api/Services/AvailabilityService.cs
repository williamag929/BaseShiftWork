using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public enum UnavailableReason { Shift, TimeOff, Schedule }

    public record UnavailablePerson(Person Person, UnavailableReason Reason, int? LocationId, DateTime? StartUtc, DateTime? EndUtc);

    public record AvailabilityResult(IReadOnlyList<Person> Available, IReadOnlyList<UnavailablePerson> Unavailable);

    public interface IAvailabilityService
    {
        /// <summary>
        /// The window is wall-clock digits labelled Kind=Utc (see <see cref="LineupTime.WallDayWindow"/>), matching how
        /// Schedule and ScheduleShift dates are stored. <paramref name="tz"/> converts calendar days to real instants for ShiftEvent lookups.
        /// Precedence of reasons: Schedule, then Shift (legacy ScheduleShift), then TimeOff.
        /// </summary>
        Task<AvailabilityResult> GetForWindowAsync(string companyId, DateTime startWall, DateTime endWall, TimeZoneInfo tz);

        /// <summary>
        /// Person ids with approved time off overlapping the wall window (full-day, or partial-day ranges that overlap it)
        /// or a sick/timeoff clock event on any company-zone calendar day the window touches.
        /// </summary>
        Task<HashSet<int>> GetTimeOffPersonIdsAsync(string companyId, DateTime startWall, DateTime endWall, TimeZoneInfo tz);
    }

    public class AvailabilityService : IAvailabilityService
    {
        private readonly ShiftWorkContext _context;
        public AvailabilityService(ShiftWorkContext context) => _context = context;

        public async Task<HashSet<int>> GetTimeOffPersonIdsAsync(string companyId, DateTime startWall, DateTime endWall, TimeZoneInfo tz)
        {
            // Time-off rows are calendar dates; the window's last instant is exclusive.
            var firstDt = startWall.Date;
            var lastDt = endWall.AddTicks(-1).Date;

            var requests = await _context.TimeOffRequests.AsNoTracking()
                .Where(t => t.CompanyId == companyId
                            && t.Status.ToLower() == "approved"
                            && t.StartDate.Date <= lastDt && t.EndDate.Date >= firstDt)
                .ToListAsync();

            var ids = new HashSet<int>();
            foreach (var t in requests)
            {
                if (!t.IsPartialDay || t.PartialStartTime == null || t.PartialEndTime == null)
                {
                    ids.Add(t.PersonId);
                    continue;
                }

                // Partial day: blocks only when the request's daily range overlaps the window.
                var from = t.StartDate.Date > firstDt ? t.StartDate.Date : firstDt;
                var to = t.EndDate.Date < lastDt ? t.EndDate.Date : lastDt;
                for (var d = from; d <= to; d = d.AddDays(1))
                {
                    var rangeStart = d + t.PartialStartTime.Value;
                    var rangeEnd = d + t.PartialEndTime.Value;
                    if (rangeEnd <= rangeStart) rangeEnd = rangeEnd.AddDays(1); // overnight range
                    if (rangeStart < endWall && rangeEnd > startWall)
                    {
                        ids.Add(t.PersonId);
                        break;
                    }
                }
            }

            // Clock events are real UTC instants: widen to the whole company-zone calendar day(s) the window touches,
            // so someone who called in sick at 05:30 is not offered for a 07:00 shift.
            var eventStart = LineupTime.WallToInstantUtc(firstDt, tz);
            var eventEnd = LineupTime.WallToInstantUtc(lastDt.AddDays(1), tz);

            var eventPersonIds = await _context.ShiftEvents.AsNoTracking()
                .Where(ev => ev.CompanyId == companyId
                             && ev.EventType != null
                             && (ev.EventType.ToLower() == "sick" || ev.EventType.ToLower() == "timeoff")
                             && ev.EventDate >= eventStart && ev.EventDate < eventEnd)
                .Select(ev => ev.PersonId)
                .Distinct()
                .ToListAsync();
            foreach (var id in eventPersonIds) ids.Add(id);

            return ids;
        }

        public async Task<AvailabilityResult> GetForWindowAsync(string companyId, DateTime startWall, DateTime endWall, TimeZoneInfo tz)
        {
            var people = await _context.Persons
                .Where(p => p.CompanyId == companyId && p.Status == "Active")
                .OrderBy(p => p.Name)
                .ToListAsync();

            var schedules = await _context.Schedules.AsNoTracking()
                .Where(s => s.CompanyId == companyId
                            && s.Status.ToLower() != "void"
                            && s.StartDate < endWall && s.EndDate > startWall)
                .ToListAsync();

            var shifts = await _context.ScheduleShifts
                .Where(s => s.CompanyId == companyId
                            && s.Status.ToLower() != "void"
                            && s.StartDate < endWall && s.EndDate > startWall)
                .ToListAsync();

            var timeOffIds = await GetTimeOffPersonIdsAsync(companyId, startWall, endWall, tz);

            var available = new List<Person>();
            var unavailable = new List<UnavailablePerson>();
            foreach (var p in people)
            {
                var pid = p.PersonId.ToString();
                var schedule = schedules.Where(s => s.PersonId == pid).OrderBy(s => s.StartDate).FirstOrDefault();
                if (schedule != null)
                {
                    unavailable.Add(new UnavailablePerson(p, UnavailableReason.Schedule, schedule.LocationId, schedule.StartDate, schedule.EndDate));
                    continue;
                }
                var shift = shifts.Where(s => s.PersonId == p.PersonId).OrderBy(s => s.StartDate).FirstOrDefault();
                if (shift != null)
                {
                    unavailable.Add(new UnavailablePerson(p, UnavailableReason.Shift, shift.LocationId, shift.StartDate, shift.EndDate));
                    continue;
                }
                if (timeOffIds.Contains(p.PersonId))
                {
                    unavailable.Add(new UnavailablePerson(p, UnavailableReason.TimeOff, null, null, null));
                    continue;
                }
                available.Add(p);
            }
            return new AvailabilityResult(available, unavailable);
        }
    }
}
