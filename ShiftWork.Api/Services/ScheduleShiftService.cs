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
        Task<ScheduleShift> Add(ScheduleShift scheduleShift);
        Task<ScheduleShift> Update(ScheduleShift scheduleShift);
        Task<bool> Delete(int shiftId);
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
    }
}