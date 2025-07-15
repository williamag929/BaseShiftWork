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
    /// Defines the contract for the location service.
    /// </summary>
    public interface ILocationService
    {
        Task<IEnumerable<Location>> GetAll(string companyId);
        Task<Location> Get(string companyId, int locationId);
        Task<Location> Add(Location location);
        Task<Location> Update(Location location);
        Task<bool> Delete(string companyId, int locationId);
    }

    /// <summary>
    /// Service for managing locations.
    /// </summary>
    public class LocationService : ILocationService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<LocationService> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="LocationService"/> class.
        /// </summary>
        public LocationService(ShiftWorkContext context, ILogger<LocationService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IEnumerable<Location>> GetAll(string companyId)
        {
            return await _context.Locations.Where(l => l.CompanyId == companyId).ToListAsync();
        }

        public async Task<Location> Get(string companyId, int locationId)
        {
            return await _context.Locations.FirstOrDefaultAsync(l => l.CompanyId == companyId && l.LocationId == locationId);
        }

        public async Task<Location> Add(Location location)
        {
            _context.Locations.Add(location);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Location with ID {LocationId} created.", location.LocationId);
            return location;
        }

        public async Task<Location> Update(Location location)
        {
            _context.Entry(location).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            _logger.LogInformation("Location with ID {LocationId} updated.", location.LocationId);
            return location;
        }

        public async Task<bool> Delete(string companyId, int locationId)
        {
            var location = await _context.Locations.FirstOrDefaultAsync(l => l.CompanyId == companyId && l.LocationId == locationId);
            if (location == null)
            {
                return false;
            }

            // Also remove associated ScheduleShifts to prevent integrity errors
            var scheduleShifts = _context.ScheduleShifts.Where(ss => ss.LocationId == locationId);
            if (await scheduleShifts.AnyAsync())
            {
                _context.ScheduleShifts.RemoveRange(scheduleShifts);
            }

            _context.Locations.Remove(location);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Location with ID {LocationId} for company {CompanyId} deleted.", locationId, companyId);
            return true;
        }
    }
}