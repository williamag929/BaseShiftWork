using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
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
        /// <summary>Stores the location's default shift in Settings (other keys preserved). Null when the location is not in the company; ArgumentException for invalid input.</summary>
        Task<DefaultShiftDto?> SetDefaultShiftAsync(string companyId, int locationId, DefaultShiftDto input);
        /// <summary>Removes the default shift from Settings. False when the location is not found.</summary>
        Task<bool> ClearDefaultShiftAsync(string companyId, int locationId);
        /// <summary>Live "who's on site" roster per active location, for the Active Sites dashboard.</summary>
        Task<List<ActiveSiteStatusDto>> GetActiveSiteStatusAsync(string companyId);
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
            // Load existing entity from database to enable change tracking
            var existingLocation = await _context.Locations
                .FirstOrDefaultAsync(l => l.LocationId == location.LocationId && l.CompanyId == location.CompanyId);

            if (existingLocation == null)
            {
                throw new InvalidOperationException($"Location with ID {location.LocationId} not found.");
            }

            // Update properties individually so EF Core can track which fields changed
            existingLocation.Name = location.Name;
            existingLocation.Address = location.Address;
            existingLocation.City = location.City;
            existingLocation.State = location.State;
            existingLocation.Region = location.Region;
            existingLocation.Street = location.Street;
            existingLocation.Building = location.Building;
            existingLocation.Floor = location.Floor;
            existingLocation.Department = location.Department;
            existingLocation.Country = location.Country;
            existingLocation.ZipCode = location.ZipCode;
            existingLocation.GeoCoordinates = location.GeoCoordinates;
            existingLocation.RatioMax = location.RatioMax;
            existingLocation.PhoneNumber = location.PhoneNumber;
            existingLocation.Email = location.Email;
            existingLocation.ExternalCode = location.ExternalCode;
            existingLocation.TimeZone = location.TimeZone;
            // Settings is intentionally not assigned: it holds server-managed keys (e.g. defaultShift)
            // that the location DTO does not carry, so copying it would wipe them.
            existingLocation.Status = location.Status;
            existingLocation.RequirePin = location.RequirePin;
            existingLocation.RequirePhoto = location.RequirePhoto;

            // SaveChangesAsync will trigger the audit interceptor with proper change tracking
            await _context.SaveChangesAsync();
            _logger.LogInformation("Location with ID {LocationId} updated.", location.LocationId);
            return existingLocation;
        }

        public async Task<DefaultShiftDto?> SetDefaultShiftAsync(string companyId, int locationId, DefaultShiftDto input)
        {
            if (input == null) throw new ArgumentException("A default shift is required.");

            var location = await _context.Locations.FirstOrDefaultAsync(l => l.CompanyId == companyId && l.LocationId == locationId);
            if (location == null) return null;

            var start = ParseTime(input.Start, "Start");
            var end = ParseTime(input.End, "End");
            if (start == end) throw new ArgumentException("Start and end times must be different.");

            if (input.AreaId.HasValue)
            {
                var areaId = input.AreaId.Value;
                var areaOk = await _context.Areas.AnyAsync(a => a.AreaId == areaId && a.CompanyId == companyId && a.LocationId == locationId);
                if (!areaOk) throw new ArgumentException("The selected area does not belong to this location.");
            }

            var root = ParseSettingsObject(location.Settings);
            var node = new JsonObject
            {
                ["start"] = start.ToString("HH:mm", CultureInfo.InvariantCulture),
                ["end"] = end.ToString("HH:mm", CultureInfo.InvariantCulture),
            };
            if (input.AreaId.HasValue) node["areaId"] = input.AreaId.Value;
            root["defaultShift"] = node;

            location.Settings = root.ToJsonString();
            await _context.SaveChangesAsync();
            _logger.LogInformation("Default shift set for location {LocationId}.", locationId);

            return new DefaultShiftDto(
                start.ToString("HH:mm", CultureInfo.InvariantCulture),
                end.ToString("HH:mm", CultureInfo.InvariantCulture),
                input.AreaId);
        }

        public async Task<bool> ClearDefaultShiftAsync(string companyId, int locationId)
        {
            var location = await _context.Locations.FirstOrDefaultAsync(l => l.CompanyId == companyId && l.LocationId == locationId);
            if (location == null) return false;

            var root = ParseSettingsObject(location.Settings);
            root.Remove("defaultShift");
            location.Settings = root.Count == 0 ? null : root.ToJsonString();
            await _context.SaveChangesAsync();
            _logger.LogInformation("Default shift cleared for location {LocationId}.", locationId);
            return true;
        }

        private static TimeOnly ParseTime(string? value, string label)
        {
            if (!TimeOnly.TryParseExact(value, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var t))
                throw new ArgumentException($"{label} must be a time in HH:mm format.");
            return t;
        }

        // Anything that is not a JSON object (null, blank, malformed, array, scalar) becomes a fresh object.
        private static JsonObject ParseSettingsObject(string? settings)
        {
            if (string.IsNullOrWhiteSpace(settings)) return new JsonObject();
            try
            {
                return JsonNode.Parse(settings) as JsonObject ?? new JsonObject();
            }
            catch (JsonException)
            {
                return new JsonObject();
            }
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

        public async Task<List<ActiveSiteStatusDto>> GetActiveSiteStatusAsync(string companyId)
        {
            var locations = await _context.Locations
                .Where(l => l.CompanyId == companyId && l.Status == "Active")
                .ToListAsync();

            var sitesByLocationId = locations.ToDictionary(l => l.LocationId, l => new ActiveSiteStatusDto
            {
                LocationId = l.LocationId,
                Name = l.Name,
                Address = l.Address,
            });
            const int unassignedLocationId = -1;

            var onShiftPersons = await _context.Persons
                .Where(p => p.CompanyId == companyId
                    && p.StatusShiftWork != null
                    && p.StatusShiftWork.StartsWith("OnShift"))
                .ToListAsync();

            var roleNames = await _context.Roles
                .Where(r => r.CompanyId == companyId)
                .ToDictionaryAsync(r => r.RoleId, r => r.Name);

            foreach (var person in onShiftPersons)
            {
                var lastClockIn = await _context.ShiftEvents
                    .Where(e => e.CompanyId == companyId && e.PersonId == person.PersonId && e.EventType == "clockin")
                    .OrderByDescending(e => e.EventDate)
                    .FirstOrDefaultAsync();

                if (lastClockIn == null)
                {
                    continue;
                }

                var timingStatus = "NoSchedule";
                var statusParts = person.StatusShiftWork?.Split(':');
                if (statusParts != null && statusParts.Length == 2)
                {
                    timingStatus = statusParts[1];
                }

                // Person.RoleId is obsolete for permission resolution (use UserRole instead) but is
                // still the field that holds an employee's job-title role — same field the People
                // list already displays it from.
#pragma warning disable CS0618
                string? roleName = person.RoleId.HasValue && roleNames.TryGetValue(person.RoleId.Value, out var rn)
                    ? rn
                    : null;
#pragma warning restore CS0618

                var entry = new ActiveSiteRosterEntryDto
                {
                    PersonId = person.PersonId,
                    Name = person.Name,
                    PhotoUrl = person.PhotoUrl,
                    RoleName = roleName,
                    ClockInTime = lastClockIn.EventDate,
                    TimingStatus = timingStatus,
                    GeofenceStatus = lastClockIn.GeofenceStatus ?? "Unknown",
                    GeofenceDistanceMeters = lastClockIn.GeofenceDistanceMeters,
                    GeofenceReviewed = lastClockIn.GeofenceReviewedAt.HasValue,
                    ShiftEventId = lastClockIn.EventLogId,
                };

                var targetLocationId = lastClockIn.LocationId.HasValue && sitesByLocationId.ContainsKey(lastClockIn.LocationId.Value)
                    ? lastClockIn.LocationId.Value
                    : unassignedLocationId;

                // Pre-migration events (no LocationId yet) or a since-archived location fall into "Unassigned".
                if (!sitesByLocationId.TryGetValue(targetLocationId, out var site))
                {
                    site = new ActiveSiteStatusDto { LocationId = unassignedLocationId, Name = "Unassigned", Address = "" };
                    sitesByLocationId[unassignedLocationId] = site;
                }
                site.Roster.Add(entry);
            }

            foreach (var site in sitesByLocationId.Values)
            {
                site.OnShiftCount = site.Roster.Count;
            }

            return sitesByLocationId.Values
                .OrderBy(s => s.LocationId == unassignedLocationId ? int.MaxValue : s.LocationId)
                .ToList();
        }
    }
}