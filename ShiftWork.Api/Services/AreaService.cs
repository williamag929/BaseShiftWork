using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    /// <summary>
    /// Defines the contract for the area service.
    /// </summary>
    public interface IAreaService
    {
        Task<IEnumerable<Area>> Get(string companyId, int[] areaIds);
        Task<Area> Add(Area area);
        Task<Area> Update(Area area);
        Task<bool> Delete(Area area);
    }

    /// <summary>
    /// Service for managing areas.
    /// </summary>
    public class AreaService : IAreaService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<AreaService> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="AreaService"/> class.
        /// </summary>
        public AreaService(ShiftWorkContext context, ILogger<AreaService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Adds a new area to the database.
        /// </summary>
        /// <param name="area">The area to add.</param>
        /// <returns>The added area.</returns>
        public async Task<Area> Add(Area area)
        {
            if (area == null) throw new ArgumentNullException(nameof(area));

            try
            {
                _context.Areas.Add(area);
                await _context.SaveChangesAsync();
                _logger.LogInformation("Successfully added new area with ID {AreaId}", area.AreaId);
                return area;
            }
            catch (DbUpdateException ex)
            {
                _logger.LogError(ex, "Error adding a new area to the database.");
                throw;
            }
        }

        /// <summary>
        /// Deletes an area from the database.
        /// </summary>
        /// <param name="area">The area to delete.</param>
        /// <returns>True if deletion was successful, otherwise false.</returns>
        public async Task<bool> Delete(Area area)
        {
            if (area == null) throw new ArgumentNullException(nameof(area));

            try
            {
                // Also remove associated ScheduleShifts to prevent integrity errors
                var scheduleShifts = _context.ScheduleShifts.Where(ss => ss.AreaId == area.AreaId);
                if (await scheduleShifts.AnyAsync())
                {
                    _context.ScheduleShifts.RemoveRange(scheduleShifts);
                }

                _context.Areas.Remove(area);
                var changes = await _context.SaveChangesAsync();
                var success = changes > 0;
                if (success)
                {
                    _logger.LogInformation("Successfully deleted area with ID {AreaId}", area.AreaId);
                }
                else
                {
                    _logger.LogWarning("Failed to delete area with ID {AreaId}. It may have already been deleted.", area.AreaId);
                }
                return success;
            }
            catch (DbUpdateException ex)
            {
                _logger.LogError(ex, "Error deleting area with ID {AreaId} from the database.", area.AreaId);
                throw;
            }
        }

        /// <summary>
        /// Retrieves areas based on company and area IDs.
        /// </summary>
        /// <param name="companyId">The company's ID.</param>
        /// <param name="areaIds">An array of area IDs to retrieve. If empty, retrieves all.</param>
        /// <returns>A list of areas.</returns>
        public async Task<IEnumerable<Area>> Get(string companyId, int[] areaIds)
        {
            if (string.IsNullOrEmpty(companyId)) throw new ArgumentException("Company ID cannot be null or empty.", nameof(companyId));

            try
            {
                var query = _context.Areas.AsQueryable();
                query = query.Where(a => a.CompanyId == companyId);

                // Treat null as empty
                if (areaIds != null && areaIds.Length > 0)
                {
                    query = query.Where(a => areaIds.Contains(a.AreaId));
                }

                var result = await query.ToListAsync();
                return result ?? new List<Area>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving areas for company {CompanyId}.", companyId);
                throw;
            }
        }

        /// <summary>
        /// Updates an existing area.
        /// </summary>
        /// <param name="area">The area with updated information.</param>
        /// <returns>The updated area.</returns>
        public async Task<Area> Update(Area area)
        {
            if (area == null) throw new ArgumentNullException(nameof(area));

            try
            {
                // Load existing entity to enable proper change tracking for audit
                var existingArea = await _context.Areas
                    .FirstOrDefaultAsync(a => a.AreaId == area.AreaId && a.CompanyId == area.CompanyId);

                if (existingArea == null)
                {
                    throw new InvalidOperationException($"Area with ID {area.AreaId} not found.");
                }

                // Update properties individually so EF Core tracks which fields changed
                existingArea.Name = area.Name;
                existingArea.LocationId = area.LocationId;

                await _context.SaveChangesAsync();
                _logger.LogInformation("Successfully updated area with ID {AreaId}", area.AreaId);
                return existingArea;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error while updating area {AreaId}.", area.AreaId);
                throw; // Or handle by reloading data
            }
            catch (DbUpdateException ex)
            {
                _logger.LogError(ex, "Error updating area with ID {AreaId} in the database.", area.AreaId);
                throw;
            }
        }
    }
}