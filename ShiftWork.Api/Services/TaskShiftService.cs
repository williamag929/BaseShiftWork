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
    /// Defines the contract for the task shift service.
    /// </summary>
    public interface ITaskShiftService
    {
        Task<IEnumerable<TaskShift>> GetAll(string companyId);
        Task<TaskShift> Get(string companyId, int id);
        Task<TaskShift> Add(TaskShift taskShift);
        Task<TaskShift> Update(TaskShift taskShift);
        Task<bool> Delete(string companyId, int id);
    }

    /// <summary>
    /// Service for managing task shifts.
    /// </summary>
    public class TaskShiftService : ITaskShiftService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<TaskShiftService> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="TaskShiftService"/> class.
        /// </summary>
        public TaskShiftService(ShiftWorkContext context, ILogger<TaskShiftService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IEnumerable<TaskShift>> GetAll(string companyId)
        {
            return await _context.TaskShifts.Where(t => t.CompanyId == companyId).ToListAsync();
        }

        public async Task<TaskShift> Get(string companyId, int id)
        {
            return await _context.TaskShifts.FirstOrDefaultAsync(t => t.CompanyId == companyId && t.TaskShiftId == id);
        }

        public async Task<TaskShift> Add(TaskShift taskShift)
        {
            _context.TaskShifts.Add(taskShift);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Task shift with ID {Id} created.", taskShift.TaskShiftId);
            return taskShift;
        }

        public async Task<TaskShift> Update(TaskShift taskShift)
        {
            // Load existing entity to enable proper change tracking for audit
            var existingTask = await _context.TaskShifts
                .FirstOrDefaultAsync(t => t.TaskShiftId == taskShift.TaskShiftId && t.CompanyId == taskShift.CompanyId);

            if (existingTask == null)
            {
                throw new InvalidOperationException($"TaskShift with ID {taskShift.TaskShiftId} not found.");
            }

            // Update properties individually so EF Core tracks which fields changed
            existingTask.Title = taskShift.Title;
            existingTask.Description = taskShift.Description;
            existingTask.Status = taskShift.Status;
            existingTask.LocationId = taskShift.LocationId;
            existingTask.AreaId = taskShift.AreaId;
            existingTask.PersonId = taskShift.PersonId;
            existingTask.UpdatedBy = taskShift.UpdatedBy;
            existingTask.UpdatedAt = DateTime.UtcNow;
            existingTask.LastUpdatedBy = taskShift.LastUpdatedBy;
            existingTask.LastUpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            _logger.LogInformation("Task shift with ID {Id} updated.", taskShift.TaskShiftId);
            return existingTask;
        }

        public async Task<bool> Delete(string companyId, int id)
        {
            var taskShift = await _context.TaskShifts
                .FirstOrDefaultAsync(t => t.TaskShiftId == id && t.CompanyId == companyId);
            if (taskShift == null) // This now correctly handles not found within the specified company
            {
                return false;
            }

            // Also remove associated ScheduleShifts to prevent integrity errors
            var scheduleShifts = _context.ScheduleShifts.Where(ss => ss.TaskShiftId == id);
            if (await scheduleShifts.AnyAsync())
            {
                _context.ScheduleShifts.RemoveRange(scheduleShifts);
            }

            _context.TaskShifts.Remove(taskShift);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Task shift with ID {Id} for company {CompanyId} deleted.", id, companyId);
            return true;
        }
    }
}