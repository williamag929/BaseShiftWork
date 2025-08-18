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
    /// Defines the contract for the schedule service.
    /// </summary>
    public interface IScheduleService
    {
        Task<IEnumerable<Schedule>> GetAll(string companyId);
        Task<Schedule> Get(string companyId, int scheduleId);
        Task<IEnumerable<Schedule>> GetSchedules(string companyId, int? personId, int? locationId, DateTime? startDate, DateTime? endDate, string searchQuery);
        Task<Schedule> Add(Schedule schedule);
        Task<Schedule> Update(Schedule schedule);
        Task<bool> Delete(int scheduleId);
    }

    /// <summary>
    /// Service for managing schedules.
    /// </summary>
    public class ScheduleService : IScheduleService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<ScheduleService> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="ScheduleService"/> class.
        /// </summary>
        public ScheduleService(ShiftWorkContext context, ILogger<ScheduleService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IEnumerable<Schedule>> GetAll(string companyId)
        {
            return await _context.Schedules.Where(s => s.CompanyId == companyId).ToListAsync();
        }

        public async Task<Schedule> Get(string companyId, int scheduleId)
        {
            return await _context.Schedules.FirstOrDefaultAsync(s => s.CompanyId == companyId && s.ScheduleId == scheduleId);
        }

        public async Task<IEnumerable<Schedule>> GetSchedules(string companyId, int? personId, int? locationId, DateTime? startDate, DateTime? endDate, string searchQuery)
        {
            var query = _context.Schedules.Where(s => s.CompanyId == companyId);

            if (personId.HasValue)
            {
                query = query.Where(s => s.PersonId == personId.ToString());
            }

            if (locationId.HasValue)
            {
                query = query.Where(s => s.LocationId == locationId.Value);
            }

            if (startDate.HasValue)
            {
                query = query.Where(s => s.StartDate >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(s => s.EndDate <= endDate.Value);
            }

            if (!string.IsNullOrEmpty(searchQuery))
            {
                query = query.Where(s => s.Name.Contains(searchQuery) || s.Description.Contains(searchQuery));
            }

            return await query.ToListAsync();
        }

        public async Task<Schedule> Add(Schedule schedule)
        {
            _context.Schedules.Add(schedule);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Schedule with ID {ScheduleId} created.", schedule.ScheduleId);
            return schedule;
        }

        public async Task<Schedule> Update(Schedule schedule)
        {
            _context.Entry(schedule).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            _logger.LogInformation("Schedule with ID {ScheduleId} updated.", schedule.ScheduleId);
            return schedule;
        }

        public async Task<bool> Delete(int scheduleId)
        {
            var schedule = await _context.Schedules.FindAsync(scheduleId);
            if (schedule == null)
            {
                return false;
            }

            _context.Schedules.Remove(schedule);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Schedule with ID {ScheduleId} deleted.", scheduleId);
            return true;
        }
    }
}