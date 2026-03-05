using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    /// <inheritdoc />
    public class SandboxService : ISandboxService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<SandboxService> _logger;

        public SandboxService(ShiftWorkContext context, ILogger<SandboxService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <inheritdoc />
        public async Task SeedSandboxDataAsync(string companyId)
        {
            _logger.LogInformation("{EventName} {CompanyId}", "sandbox_seed_started", companyId);

            // Create sandbox Location
            var location = new Location
            {
                Name = SandboxSeedTemplate.LocationName,
                CompanyId = companyId,
                Address = SandboxSeedTemplate.LocationAddress,
                City = SandboxSeedTemplate.LocationCity,
                State = SandboxSeedTemplate.LocationState,
                Country = SandboxSeedTemplate.LocationCountry,
                ZipCode = SandboxSeedTemplate.LocationZipCode,
                Status = SandboxSeedTemplate.LocationStatus,
                TimeZone = SandboxSeedTemplate.LocationTimeZone,
                GeoCoordinates = SandboxSeedTemplate.LocationGeoCoordinates,
                RatioMax = 10,
                IsSandbox = true
            };
            _context.Locations.Add(location);
            await _context.SaveChangesAsync(); // get LocationId

            // Create sandbox Area linked to the location
            var area = new Area
            {
                Name = SandboxSeedTemplate.AreaName,
                CompanyId = companyId,
                LocationId = location.LocationId,
                IsSandbox = true
            };
            _context.Areas.Add(area);

            // Create sandbox Persons
            foreach (var emp in SandboxSeedTemplate.SandboxEmployees)
            {
                _context.Persons.Add(new Person
                {
                    Name = emp.Name,
                    Email = emp.Email,
                    CompanyId = companyId,
                    Pin = BCrypt.Net.BCrypt.HashPassword(emp.Pin),
                    Status = emp.Status,
                    IsSandbox = true
                });
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("{EventName} {CompanyId}", "sandbox_seed_completed", companyId);
        }

        /// <inheritdoc />
        public async Task HideSandboxDataAsync(string companyId, IEnumerable<string> entityTypes)
        {
            _logger.LogInformation("{EventName} {CompanyId} {Types}", "sandbox_hide", companyId, string.Join(",", entityTypes));

            var types = entityTypes.Select(t => t.ToLowerInvariant()).ToHashSet();
            bool all = types.Contains("all");

            if (all || types.Contains("person"))
            {
                var persons = await _context.Persons
                    .Where(p => p.CompanyId == companyId && p.IsSandbox)
                    .ToListAsync();
                foreach (var p in persons) p.Status = "Sandbox";
            }

            if (all || types.Contains("location"))
            {
                var locations = await _context.Locations
                    .Where(l => l.CompanyId == companyId && l.IsSandbox)
                    .ToListAsync();
                foreach (var l in locations) l.Status = "Sandbox";
            }

            // Areas don't have a Status field; mark via a note in their Name if needed.
            // For now, hiding areas is achieved by hiding their parent Location.

            await _context.SaveChangesAsync();
        }

        /// <inheritdoc />
        public async Task ResetSandboxDataAsync(string companyId)
        {
            _logger.LogInformation("{EventName} {CompanyId}", "sandbox_reset", companyId);
            await DeleteSandboxDataAsync(companyId);
            await SeedSandboxDataAsync(companyId);
        }

        /// <inheritdoc />
        public async Task DeleteSandboxDataAsync(string companyId)
        {
            _logger.LogInformation("{EventName} {CompanyId}", "sandbox_delete", companyId);

            var persons = await _context.Persons
                .Where(p => p.CompanyId == companyId && p.IsSandbox)
                .ToListAsync();
            _context.Persons.RemoveRange(persons);

            var areas = await _context.Areas
                .Where(a => a.CompanyId == companyId && a.IsSandbox)
                .ToListAsync();
            _context.Areas.RemoveRange(areas);

            var locations = await _context.Locations
                .Where(l => l.CompanyId == companyId && l.IsSandbox)
                .ToListAsync();
            _context.Locations.RemoveRange(locations);

            await _context.SaveChangesAsync();
        }

        /// <inheritdoc />
        public async Task<SandboxStatusResponse> GetSandboxStatusAsync(string companyId)
        {
            var personCount = await _context.Persons.CountAsync(p => p.CompanyId == companyId && p.IsSandbox);
            var areaCount = await _context.Areas.CountAsync(a => a.CompanyId == companyId && a.IsSandbox);
            var locationCount = await _context.Locations.CountAsync(l => l.CompanyId == companyId && l.IsSandbox);

            return new SandboxStatusResponse
            {
                HasSandboxData = personCount > 0 || areaCount > 0 || locationCount > 0,
                SandboxPersonCount = personCount,
                SandboxAreaCount = areaCount,
                SandboxLocationCount = locationCount
            };
        }
    }
}
