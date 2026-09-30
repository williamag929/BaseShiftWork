using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public enum UnavailableReason { Shift, TimeOff }

    public record UnavailablePerson(Person Person, UnavailableReason Reason, int? LocationId, DateTime? StartUtc, DateTime? EndUtc);

    public record AvailabilityResult(IReadOnlyList<Person> Available, IReadOnlyList<UnavailablePerson> Unavailable);

    public interface IAvailabilityService
    {
        /// <summary>
        /// The window is wall-clock digits labelled Kind=Utc (see <see cref="LineupTime.WallDayWindow"/>), matching how
        /// ScheduleShift dates are stored. <paramref name="tz"/> converts it to real instants for ShiftEvent lookups.
        /// </summary>
        Task<AvailabilityResult> GetForWindowAsync(string companyId, DateTime startWall, DateTime endWall, TimeZoneInfo tz);
    }

    public class AvailabilityService : IAvailabilityService
    {
        private readonly ShiftWorkContext _context;
        public AvailabilityService(ShiftWorkContext context) => _context = context;

        public async Task<AvailabilityResult> GetForWindowAsync(string companyId, DateTime startWall, DateTime endWall, TimeZoneInfo tz)
        {
            var people = await _context.Persons
                .Where(p => p.CompanyId == companyId && p.Status == "Active")
                .OrderBy(p => p.Name)
                .ToListAsync();

            var shifts = await _context.ScheduleShifts
                .Where(s => s.CompanyId == companyId
                            && s.Status.ToLower() != "void"
                            && s.StartDate < endWall && s.EndDate > startWall)
                .ToListAsync();

            // Time-off rows are calendar dates; the window's last instant is exclusive.
            var firstDt = startWall.Date;
            var lastDt = endWall.AddTicks(-1).Date;

            var timeOff = await _context.TimeOffRequests
                .Where(t => t.CompanyId == companyId
                            && t.Status.ToLower() == "approved"
                            && !t.IsPartialDay
                            && t.StartDate.Date <= lastDt && t.EndDate.Date >= firstDt)
                .ToListAsync();

            // Clock events are real UTC instants, unlike shifts.
            var eventStart = LineupTime.WallToInstantUtc(startWall, tz);
            var eventEnd = LineupTime.WallToInstantUtc(endWall, tz);

            var offEventPersonIds = (await _context.ShiftEvents
                .Where(ev => ev.CompanyId == companyId
                             && ev.EventType != null
                             && (ev.EventType.ToLower() == "sick" || ev.EventType.ToLower() == "timeoff")
                             && ev.EventDate >= eventStart && ev.EventDate < eventEnd)
                .Select(ev => ev.PersonId)
                .Distinct()
                .ToListAsync()).ToHashSet();

            var available = new List<Person>();
            var unavailable = new List<UnavailablePerson>();
            foreach (var p in people)
            {
                var shift = shifts.Where(s => s.PersonId == p.PersonId).OrderBy(s => s.StartDate).FirstOrDefault();
                if (shift != null)
                {
                    unavailable.Add(new UnavailablePerson(p, UnavailableReason.Shift, shift.LocationId, shift.StartDate, shift.EndDate));
                    continue;
                }
                if (offEventPersonIds.Contains(p.PersonId) || timeOff.Any(t => t.PersonId == p.PersonId))
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
