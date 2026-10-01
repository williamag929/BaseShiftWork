using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;

namespace ShiftWork.Api.Services
{
    public interface ILineupQueryService
    {
        Task<LineupDto> GetAsync(string companyId, DateOnly date, LineupAccess access);
    }

    public class LineupQueryService : ILineupQueryService
    {
        private readonly ShiftWorkContext _context;
        private readonly ICompanyTimeZoneService _timeZones;
        private readonly IAvailabilityService _availability;

        public LineupQueryService(ShiftWorkContext context, ICompanyTimeZoneService timeZones, IAvailabilityService availability)
        {
            _context = context;
            _timeZones = timeZones;
            _availability = availability;
        }

        public async Task<LineupDto> GetAsync(string companyId, DateOnly date, LineupAccess access)
        {
            var tz = await _timeZones.GetAsync(companyId);
            // Shift dates are floating wall-clock digits labelled UTC, so the day window is wall-clock too.
            var (startWall, endWall) = LineupTime.WallDayWindow(date);

            var locations = (await _context.Locations.AsNoTracking()
                    .Where(l => l.CompanyId == companyId && l.Status == "Active")
                    .OrderBy(l => l.Name)
                    .ToListAsync())
                .Where(l => access.CanSeeLocation(l.LocationId))
                .ToList();
            var visibleIds = locations.Select(l => l.LocationId).ToList();

            // Zero-scope users see an empty lineup (no company-wide bench leak).
            if (!access.AllLocations && access.LocationIds.Count == 0)
                return new LineupDto(date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), tz.Id, access.CanEdit,
                    new List<LineupLocationDto>(), new List<LineupPersonDto>(), new List<LineupUnavailableDto>(), new List<LineupCrewDto>());

            // Cards come from Schedule rows (what the grid, mobile and kiosk write), not legacy ScheduleShift.
            var scheduleRows = await _context.Schedules.AsNoTracking()
                .Where(s => s.CompanyId == companyId
                            && s.LocationId != null && visibleIds.Contains(s.LocationId.Value)
                            && s.Status.ToLower() != "void"
                            && s.StartDate < endWall && s.EndDate > startWall)
                .OrderBy(s => s.StartDate)
                .ToListAsync();

            var shifts = new List<(ShiftWork.Api.Models.Schedule Row, int PersonId)>();
            foreach (var row in scheduleRows)
            {
                if (int.TryParse(row.PersonId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var pid))
                    shifts.Add((row, pid));
            }

            var shiftPersonIds = shifts.Select(s => s.PersonId).Distinct().ToList();
            var names = await _context.Persons.AsNoTracking()
                .Where(p => p.CompanyId == companyId && shiftPersonIds.Contains(p.PersonId))
                .ToDictionaryAsync(p => p.PersonId, p => p.Name);

            var avail = await _availability.GetForWindowAsync(companyId, startWall, endWall, tz);
            var onCard = shiftPersonIds.ToHashSet();

            var crewRows = await _context.Crews.AsNoTracking()
                .Where(c => c.CompanyId == companyId)
                .OrderBy(c => c.Name)
                .ToListAsync();
            var crewIds = crewRows.Select(c => c.CrewId).ToList();
            var links = await _context.PersonCrews.AsNoTracking()
                .Where(pc => crewIds.Contains(pc.CrewId))
                .ToListAsync();

            var locationDtos = locations.Select(l => new LineupLocationDto(
                l.LocationId,
                l.Name,
                ToDto(LocationDefaultShift.TryParse(l.Settings)),
                shifts.Where(s => s.Row.LocationId == l.LocationId)
                      .Select(s => new LineupShiftDto(s.Row.ScheduleId, s.PersonId,
                          names.TryGetValue(s.PersonId, out var n) ? n : "Unknown", s.Row.StartDate, s.Row.EndDate, s.Row.Status))
                      .ToList())).ToList();

            var bench = avail.Available
                .Select(p => new LineupPersonDto(p.PersonId, p.Name,
                    links.Where(x => x.PersonId == p.PersonId).Select(x => x.CrewId).ToList()))
                .ToList();

            // Reasons are deliberately generic: never name a site the caller may not be allowed to see.
            var unavailable = avail.Unavailable
                .Where(u => !onCard.Contains(u.Person.PersonId))
                .Select(u => new LineupUnavailableDto(u.Person.PersonId, u.Person.Name,
                    u.Reason switch
                    {
                        UnavailableReason.TimeOff => "Time off",
                        UnavailableReason.Schedule => "Assigned to another site",
                        _ => "Already scheduled"
                    }))
                .ToList();

            var known = bench.Select(b => b.PersonId).Concat(avail.Unavailable.Select(u => u.Person.PersonId)).ToHashSet();
            var crews = crewRows.Select(c => new LineupCrewDto(c.CrewId, c.Name,
                links.Where(x => x.CrewId == c.CrewId && known.Contains(x.PersonId)).Select(x => x.PersonId).ToList())).ToList();

            return new LineupDto(date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), tz.Id, access.CanEdit, locationDtos, bench, unavailable, crews);
        }

        private static DefaultShiftDto? ToDto(LocationDefaultShift? d) =>
            d == null ? null : new DefaultShiftDto(d.Start.ToString("HH:mm", CultureInfo.InvariantCulture), d.End.ToString("HH:mm", CultureInfo.InvariantCulture), d.AreaId);
    }
}
