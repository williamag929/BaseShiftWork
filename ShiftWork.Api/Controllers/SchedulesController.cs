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
    //todo: consider using a service for schedule management to encapsulate business logic and data access
    //todo: consider adding endpoints for generating schedules, updating assignments, etc.
    //todo: consider add pagination and filtering options for schedules
    //todo: consider add option to aprove or reject schedules
    //todo: cosider add webhooks or notifications for schedule changes like a interceptor to use with different clients

    /// <summary>
    /// API controller for managing schedules.
    /// </summary>
    [ApiController]
    [Route("api/companies/{companyId}/[controller]")]
    public class SchedulesController : ControllerBase
    {
        private readonly IScheduleService _scheduleService;
        private readonly ILocationService _locationService;
        private readonly IMapper _mapper;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<SchedulesController> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="SchedulesController"/> class.
        /// </summary>
        public SchedulesController(IScheduleService scheduleService, ILocationService locationService, IMapper mapper, IMemoryCache memoryCache, ILogger<SchedulesController> logger)
        {
            _scheduleService = scheduleService ?? throw new ArgumentNullException(nameof(scheduleService));
            _locationService = locationService ?? throw new ArgumentNullException(nameof(locationService));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _memoryCache = memoryCache ?? throw new ArgumentNullException(nameof(memoryCache));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Retrieves all schedules for a company.
        /// </summary>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<ScheduleDto>), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<ScheduleDto>>> GetSchedules(string companyId)
        {
            try
            {
                var cacheKey = $"schedules_{companyId}";
                if (!_memoryCache.TryGetValue(cacheKey, out IEnumerable<Schedule> schedules))
                {
                    _logger.LogInformation("Cache miss for schedules in company {CompanyId}", companyId);
                    schedules = await _scheduleService.GetAll(companyId);

                    if (schedules == null || !schedules.Any())
                    {
                        return NotFound($"No schedules found for company {companyId}.");
                    }

                    var cacheEntryOptions = new MemoryCacheEntryOptions().SetSlidingExpiration(TimeSpan.FromMinutes(5));
                    _memoryCache.Set(cacheKey, schedules, cacheEntryOptions);
                }
                else
                {
                    _logger.LogInformation("Cache hit for schedules in company {CompanyId}", companyId);
                }

                return Ok(_mapper.Map<IEnumerable<ScheduleDto>>(schedules));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving schedules for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Retrieves a specific schedule by its ID.
        /// </summary>
        [HttpGet("{scheduleId}")]
        [ProducesResponseType(typeof(ScheduleDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<ScheduleDto>> GetSchedule(string companyId, int scheduleId)
        {
            try
            {
                var cacheKey = $"schedule_{companyId}_{scheduleId}";
                if (!_memoryCache.TryGetValue(cacheKey, out Schedule schedule))
                {
                    _logger.LogInformation("Cache miss for schedule {ScheduleId} in company {CompanyId}", scheduleId, companyId);
                    schedule = await _scheduleService.Get(companyId, scheduleId);

                    if (schedule == null)
                    {
                        return NotFound($"Schedule with ID {scheduleId} not found.");
                    }

                    var cacheEntryOptions = new MemoryCacheEntryOptions().SetSlidingExpiration(TimeSpan.FromMinutes(5));
                    _memoryCache.Set(cacheKey, schedule, cacheEntryOptions);
                }
                else
                {
                    _logger.LogInformation("Cache hit for schedule {ScheduleId} in company {CompanyId}", scheduleId, companyId);
                }

                return Ok(_mapper.Map<ScheduleDto>(schedule));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving schedule {ScheduleId} for company {CompanyId}.", scheduleId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Creates a new schedule.
        /// </summary>
        [HttpPost]
        [ProducesResponseType(typeof(ScheduleDto), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<ScheduleDto>> PostSchedule(string companyId, [FromBody] ScheduleDto scheduleDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var location = await _locationService.Get(companyId, scheduleDto.LocationId);
                if (location == null)
                {
                    return BadRequest($"Location with ID {scheduleDto.LocationId} not found.");
                }

                var schedule = _mapper.Map<Schedule>(scheduleDto);
                schedule.TimeZone = location.TimeZone;
                schedule.Type = "Shift"; // Default type, can be customized later
                var createdSchedule = await _scheduleService.Add(schedule);

                if (createdSchedule == null)
                {
                    return BadRequest("Failed to create schedule.");
                }

                _memoryCache.Remove($"schedules_{companyId}");
                var createdScheduleDto = _mapper.Map<ScheduleDto>(createdSchedule);

                return CreatedAtAction(nameof(GetSchedule), new { companyId, scheduleId = createdSchedule.ScheduleId }, createdScheduleDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating schedule for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Updates an existing schedule.
        /// </summary>
        [HttpPut("{scheduleId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> PutSchedule(string companyId, int scheduleId, [FromBody] ScheduleDto scheduleDto)
        {
            if (scheduleId != scheduleDto.ScheduleId)
            {
                return BadRequest("Schedule ID mismatch.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var schedule = _mapper.Map<Schedule>(scheduleDto);
                var updatedSchedule = await _scheduleService.Update(schedule);

                if (updatedSchedule == null)
                {
                    return NotFound($"Schedule with ID {scheduleId} not found.");
                }

                _mapper.Map(scheduleDto, updatedSchedule);
                _memoryCache.Remove($"schedules_{companyId}");
                _memoryCache.Remove($"schedule_{companyId}_{scheduleId}");

                return Ok(_mapper.Map<ScheduleDto>(updatedSchedule));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating schedule {ScheduleId} for company {CompanyId}.", scheduleId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Deletes a schedule by its ID.
        /// </summary>
        [HttpDelete("{scheduleId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> DeleteSchedule(string companyId, int scheduleId)
        {
            try
            {
                var isDeleted = await _scheduleService.Delete(scheduleId);
                if (!isDeleted)
                {
                    return NotFound($"Schedule with ID {scheduleId} not found.");
                }

                _memoryCache.Remove($"schedules_{companyId}");
                _memoryCache.Remove($"schedule_{companyId}_{scheduleId}");

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting schedule {ScheduleId} for company {CompanyId}.", scheduleId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

/*
        [HttpPost("generate")]
        public async Task<ActionResult<ScheduleDto>> GenerateSchedule(string companyId, [FromBody] ScheduleDto parameters)
        {
            try {
                var schedule = await _scheduleService.Add(parameters);
                // ... handle the result, possibly mapping to a DTO and returning CreatedAtAction
                return Ok(_mapper.Map<ScheduleDto>(schedule));  // Placeholder
            } catch (Exception ex) {
                _logger.LogError(ex, "Error generating schedule for company {CompanyId}.", companyId);
                return StatusCode(500, "Schedule generation failed.");
            }
        }

        [HttpPut("{scheduleId}/assignments")]
        public async Task<IActionResult> UpdateScheduleAssignments(string companyId, int scheduleId, [FromBody] ScheduleAssignmentChanges assignments) {
            try {
                var updatedSchedule = await _scheduleService.UpdateScheduleAssignments(scheduleId, assignments);
                if (updatedSchedule == null) {
                    return NotFound($"Schedule with ID {scheduleId} not found.");
                }
                // ... handle the result, possibly invalidating cache, etc.
                return NoContent();
            } catch (Exception ex) {
                _logger.LogError(ex, "Error updating schedule assignments for schedule {ScheduleId} in company {CompanyId}.", scheduleId, companyId);
                return StatusCode(500, "Failed to update schedule assignments.");
            }
        }
        */

        /// <summary>
        /// Searches for schedules based on various criteria.
        /// </summary>
        [HttpGet("search")]
        [ProducesResponseType(typeof(IEnumerable<ScheduleDto>), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<ScheduleDto>>> SearchSchedules(string companyId, [FromQuery] int? personId, [FromQuery] int? locationId, [FromQuery] string? startDate, [FromQuery] string? endDate, [FromQuery] string? searchQuery)
        {
            try
            {
                DateTime? startDateTime = null;
                if (!string.IsNullOrEmpty(startDate) && DateTime.TryParse(startDate, out var parsedStartDate))
                {
                    startDateTime = parsedStartDate;
                }

                DateTime? endDateTime = null;
                if (!string.IsNullOrEmpty(endDate) && DateTime.TryParse(endDate, out var parsedEndDate))
                {
                    endDateTime = parsedEndDate;
                }

                var cacheKey = $"schedules_search_{companyId}_{personId}_{locationId}_{startDate}_{endDate}_{searchQuery}";
                if (!_memoryCache.TryGetValue(cacheKey, out IEnumerable<Schedule> schedules))
                {
                    _logger.LogInformation("Cache miss for schedule search in company {CompanyId}", companyId);

                    schedules = await _scheduleService.GetSchedules(companyId, personId, locationId, startDateTime, endDateTime, searchQuery);

                    if (schedules == null || !schedules.Any())
                    {
                        return NotFound($"No schedules found for the given criteria in company {companyId}.");
                    }

                    var cacheEntryOptions = new MemoryCacheEntryOptions().SetSlidingExpiration(TimeSpan.FromMinutes(5));
                    _memoryCache.Set(cacheKey, schedules, cacheEntryOptions);
                }
                else
                {
                    _logger.LogInformation("Cache hit for schedule search in company {CompanyId}", companyId);
                }

                return Ok(_mapper.Map<IEnumerable<ScheduleDto>>(schedules));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching schedules for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}