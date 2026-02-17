using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// API controller for managing locations.
    /// </summary>
    [ApiController]
    [Route("api/companies/{companyId}/[controller]")]
    public class LocationsController : ControllerBase
    {
        private readonly ILocationService _locationService;
        private readonly IMapper _mapper;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<LocationsController> _logger;
        private readonly IWebhookService _webhookService;

        /// <summary>
        /// Initializes a new instance of the <see cref="LocationsController"/> class.
        /// </summary>
        public LocationsController(ILocationService locationService, IMapper mapper, IMemoryCache memoryCache, ILogger<LocationsController> logger, IWebhookService webhookService)
        {
            _locationService = locationService ?? throw new ArgumentNullException(nameof(locationService));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _memoryCache = memoryCache ?? throw new ArgumentNullException(nameof(memoryCache));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _webhookService = webhookService ?? throw new ArgumentNullException(nameof(webhookService));
        }

        /// <summary>
        /// Retrieves all locations for a company.
        /// </summary>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<LocationDto>), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<LocationDto>>> GetLocations(string companyId)
        {
            try
            {
                var cacheKey = $"locations_{companyId}";
                if (!_memoryCache.TryGetValue(cacheKey, out IEnumerable<Location> locations))
                {
                    _logger.LogInformation("Cache miss for locations in company {CompanyId}", companyId);
                    locations = await _locationService.GetAll(companyId);

                    if (locations == null || !locations.Any())
                    {
                        return NotFound($"No locations found for company {companyId}.");
                    }

                    var cacheEntryOptions = new MemoryCacheEntryOptions().SetSlidingExpiration(TimeSpan.FromMinutes(5));
                    _memoryCache.Set(cacheKey, locations, cacheEntryOptions);
                }
                else
                {
                    _logger.LogInformation("Cache hit for locations in company {CompanyId}", companyId);
                }

                return Ok(_mapper.Map<IEnumerable<LocationDto>>(locations));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving locations for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Retrieves a specific location by its ID.
        /// </summary>
        [HttpGet("{locationId}")]
        [ProducesResponseType(typeof(LocationDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<LocationDto>> GetLocation(string companyId, int locationId)
        {
            try
            {
                var cacheKey = $"location_{companyId}_{locationId}";
                if (!_memoryCache.TryGetValue(cacheKey, out Location location))
                {
                    _logger.LogInformation("Cache miss for location {LocationId} in company {CompanyId}", locationId, companyId);
                    location = await _locationService.Get(companyId, locationId);

                    if (location == null)
                    {
                        return NotFound($"Location with ID {locationId} not found.");
                    }

                    var cacheEntryOptions = new MemoryCacheEntryOptions().SetSlidingExpiration(TimeSpan.FromMinutes(5));
                    _memoryCache.Set(cacheKey, location, cacheEntryOptions);
                }
                else
                {
                    _logger.LogInformation("Cache hit for location {LocationId} in company {CompanyId}", locationId, companyId);
                }

                return Ok(_mapper.Map<LocationDto>(location));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving location {LocationId} for company {CompanyId}.", locationId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Creates a new location.
        /// </summary>
        [HttpPost]
        [ProducesResponseType(typeof(LocationDto), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<LocationDto>> PostLocation(string companyId, [FromBody] LocationDto locationDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var location = _mapper.Map<Location>(locationDto);
                var createdLocation = await _locationService.Add(location);

                if (createdLocation == null)
                {
                    return BadRequest("Failed to create location.");
                }

                _memoryCache.Remove($"locations_{companyId}");
                var createdLocationDto = _mapper.Map<LocationDto>(createdLocation);

                // Trigger webhook for location.created event (non-blocking with timeout)
                try
                {
                    await _webhookService.SendWebhookAsync(WebhookEventType.LocationCreated, createdLocationDto);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send webhook for location.created event. LocationId: {LocationId}", createdLocation.LocationId);
                }

                return CreatedAtAction(nameof(GetLocation), new { companyId, locationId = createdLocation.LocationId }, createdLocationDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating location for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Updates an existing location.
        /// </summary>
        [HttpPut("{locationId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> PutLocation(string companyId, int locationId, [FromBody] LocationDto locationDto)
        {
            if (locationId != locationDto.LocationId)
            {
                return BadRequest("Location ID mismatch.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var location = _mapper.Map<Location>(locationDto);
                var updatedLocation = await _locationService.Update(location);

                if (updatedLocation == null)
                {
                    return NotFound($"Location with ID {locationId} not found.");
                }

                _mapper.Map(locationDto , updatedLocation);

                _memoryCache.Remove($"locations_{companyId}");
                _memoryCache.Remove($"location_{companyId}_{locationId}");

                var updatedLocationDto = _mapper.Map<LocationDto>(updatedLocation);

                // Trigger webhook for location.updated event (non-blocking with timeout)
                try
                {
                    await _webhookService.SendWebhookAsync(WebhookEventType.LocationUpdated, updatedLocationDto);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send webhook for location.updated event. LocationId: {LocationId}", locationId);
                }

                return Ok(updatedLocationDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating location {LocationId} for company {CompanyId}.", locationId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Deletes a location by its ID.
        /// </summary>
        [HttpDelete("{locationId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> DeleteLocation(string companyId, int locationId)
        {
            try
            {
                var isDeleted = await _locationService.Delete(companyId, locationId);
                if (!isDeleted)
                {
                    return NotFound($"Location with ID {locationId} not found.");
                }

                _memoryCache.Remove($"locations_{companyId}");
                _memoryCache.Remove($"location_{companyId}_{locationId}");

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting location {LocationId} for company {CompanyId}.", locationId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}