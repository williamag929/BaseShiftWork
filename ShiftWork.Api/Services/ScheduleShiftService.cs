using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace ShiftWork.Api.Services
{
    /// <summary>
    /// Defines the contract for the schedule shift service.
    /// </summary>
    public interface IScheduleShiftService
    {
        Task<IEnumerable<ScheduleShift>> GetAll(string companyId);
        Task<ScheduleShift> Get(string companyId, int shiftId);
        Task<(IEnumerable<ScheduleShift> Items, int TotalCount)> GetPaged(string companyId, int? personId, int? locationId, int? areaId, DateTime? startDate, DateTime? endDate, int page, int pageSize);
        Task<ScheduleShift> Add(ScheduleShift scheduleShift);
        Task<ScheduleShift> Update(ScheduleShift scheduleShift);
        Task<bool> Delete(int shiftId);
        Task<IEnumerable<Person>> GetReplacementCandidatesForShift(string companyId, int shiftId);
        Task<IEnumerable<Person>> GetReplacementCandidatesByWindow(string companyId, DateTime startUtc, DateTime endUtc, int? locationId, int? areaId, int? excludePersonId);
    }

    /// <summary>
    /// Service for managing schedule shifts.
    /// </summary>
    public class ScheduleShiftService : IScheduleShiftService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<ScheduleShiftService> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="ScheduleShiftService"/> class.
        /// </summary>
        public ScheduleShiftService(ShiftWorkContext context, ILogger<ScheduleShiftService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IEnumerable<ScheduleShift>> GetAll(string companyId)
        {
            return await _context.ScheduleShifts.Where(s => s.CompanyId == companyId).ToListAsync();
        }

        public async Task<ScheduleShift> Get(string companyId, int shiftId)
        {
            return await _context.ScheduleShifts.FirstOrDefaultAsync(s => s.CompanyId == companyId && s.ScheduleShiftId == shiftId);
        }

        public async Task<(IEnumerable<ScheduleShift> Items, int TotalCount)> GetPaged(string companyId, int? personId, int? locationId, int? areaId, DateTime? startDate, DateTime? endDate, int page, int pageSize)
        {
            var query = _context.ScheduleShifts.Where(s => s.CompanyId == companyId);

            if (personId.HasValue)
            {
                query = query.Where(s => s.PersonId == personId.Value);
            }

            if (locationId.HasValue)
            {
                query = query.Where(s => s.LocationId == locationId.Value);
            }

            if (areaId.HasValue)
            {
                query = query.Where(s => s.AreaId == areaId.Value);
            }

            if (startDate.HasValue)
            {
                query = query.Where(s => s.StartDate >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(s => s.EndDate <= endDate.Value);
            }

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderBy(s => s.StartDate)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, totalCount);
        }

        public async Task<ScheduleShift> Add(ScheduleShift scheduleShift)
        {
            _context.ScheduleShifts.Add(scheduleShift);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Schedule shift with ID {ShiftId} created.", scheduleShift.ScheduleShiftId);
            return scheduleShift;
        }

        public async Task<ScheduleShift> Update(ScheduleShift scheduleShift)
        {
            _context.Entry(scheduleShift).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            _logger.LogInformation("Schedule shift with ID {ShiftId} updated.", scheduleShift.ScheduleShiftId);
            return scheduleShift;
        }

        public async Task<bool> Delete(int shiftId)
        {
            var scheduleShift = await _context.ScheduleShifts.FindAsync(shiftId);
            if (scheduleShift == null)
            {
                return false;
            }

            _context.ScheduleShifts.Remove(scheduleShift);
            await _context.SaveChangesAsync();
                        _logger.LogInformation("Schedule shift with ID {ShiftId} deleted.", shiftId);
            return true;
        }

        public async Task<IEnumerable<Person>> GetReplacementCandidatesForShift(string companyId, int shiftId)
        {
            var shift = await _context.ScheduleShifts.FirstOrDefaultAsync(s => s.CompanyId == companyId && s.ScheduleShiftId == shiftId);
            if (shift == null)
            {
                return Enumerable.Empty<Person>();
            }
            return await GetReplacementCandidatesByWindow(companyId, shift.StartDate, shift.EndDate, shift.LocationId, shift.AreaId, shift.PersonId);
        }

        public async Task<IEnumerable<Person>> GetReplacementCandidatesByWindow(string companyId, DateTime startUtc, DateTime endUtc, int? locationId, int? areaId, int? excludePersonId)
        {
            var peopleQuery = _context.Persons.Where(p => p.CompanyId == companyId);
            if (excludePersonId.HasValue)
            {
                peopleQuery = peopleQuery.Where(p => p.PersonId != excludePersonId.Value);
            }

            // Exclude people who have overlapping scheduled shifts (any status, published or unpublished)
            var overlappingPersonIds = await _context.ScheduleShifts
                .Where(ss => ss.CompanyId == companyId && ss.StartDate < endUtc && ss.EndDate > startUtc)
                .Select(ss => ss.PersonId)
                .Distinct()
                .ToListAsync();

            // Exclude people with sick or timeoff events on the date
            var offEventTypes = new[] { "sick", "timeoff" };
            var dateOnly = startUtc.Date;
            var offPersonIds = await _context.ShiftEvents
                .Where(e => e.CompanyId == companyId && e.EventType != null && offEventTypes.Contains(e.EventType))
                .Where(e => e.EventDate.Date == dateOnly)
                .Select(e => e.PersonId)
                .Distinct()
                .ToListAsync();

            var excluded = new HashSet<int>(overlappingPersonIds);
            foreach (var pid in offPersonIds) excluded.Add(pid);

            var candidates = await peopleQuery
                .Where(p => !excluded.Contains(p.PersonId))
                .OrderBy(p => p.Name)
                .ToListAsync();

            return candidates;
        }
    }
}
