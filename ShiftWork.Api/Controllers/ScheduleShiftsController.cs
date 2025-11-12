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
    /// API controller for managing schedule shifts.
    /// </summary>
    [ApiController]
    [Route("api/companies/{companyId}/[controller]")]
    public class ScheduleShiftsController : ControllerBase
    {
        private readonly IScheduleShiftService _scheduleShiftService;
        private readonly IMapper _mapper;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<ScheduleShiftsController> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="ScheduleShiftsController"/> class.
        /// </summary>
        public ScheduleShiftsController(IScheduleShiftService scheduleShiftService, IMapper mapper, IMemoryCache memoryCache, ILogger<ScheduleShiftsController> logger)
        {
            _scheduleShiftService = scheduleShiftService ?? throw new ArgumentNullException(nameof(scheduleShiftService));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _memoryCache = memoryCache ?? throw new ArgumentNullException(nameof(memoryCache));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Retrieves all schedule shifts for a company.
        /// </summary>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<ScheduleShiftDto>), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<ScheduleShiftDto>>> GetScheduleShifts(string companyId)
        {
            try
            {
                var cacheKey = $"schedule_shifts_{companyId}";
                if (!_memoryCache.TryGetValue(cacheKey, out IEnumerable<ScheduleShift> scheduleShifts))
                {
                    _logger.LogInformation("Cache miss for schedule shifts in company {CompanyId}", companyId);
                    scheduleShifts = await _scheduleShiftService.GetAll(companyId);

                    if (scheduleShifts == null || !scheduleShifts.Any())
                    {
                        return NotFound($"No schedule shifts found for company {companyId}.");
                    }

                    var cacheEntryOptions = new MemoryCacheEntryOptions().SetSlidingExpiration(TimeSpan.FromMinutes(5));
                    _memoryCache.Set(cacheKey, scheduleShifts, cacheEntryOptions);
                }
                else
                {
                    _logger.LogInformation("Cache hit for schedule shifts in company {CompanyId}", companyId);
                }

                return Ok(_mapper.Map<IEnumerable<ScheduleShiftDto>>(scheduleShifts));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving schedule shifts for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Retrieves a specific schedule shift by its ID.
        /// </summary>
        [HttpGet("{shiftId}")]
        [ProducesResponseType(typeof(ScheduleShiftDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<ScheduleShiftDto>> GetScheduleShift(string companyId, int shiftId)
        {
            try
            {
                var cacheKey = $"schedule_shift_{companyId}_{shiftId}";
                if (!_memoryCache.TryGetValue(cacheKey, out ScheduleShift scheduleShift))
                {
                    _logger.LogInformation("Cache miss for schedule shift {ShiftId} in company {CompanyId}", shiftId, companyId);
                    scheduleShift = await _scheduleShiftService.Get(companyId, shiftId);

                    if (scheduleShift == null)
                    {
                        return NotFound($"Schedule shift with ID {shiftId} not found.");
                    }

                    var cacheEntryOptions = new MemoryCacheEntryOptions().SetSlidingExpiration(TimeSpan.FromMinutes(5));
                    _memoryCache.Set(cacheKey, scheduleShift, cacheEntryOptions);
                }
                else
                {
                    _logger.LogInformation("Cache hit for schedule shift {ShiftId} in company {CompanyId}", shiftId, companyId);
                }

                return Ok(_mapper.Map<ScheduleShiftDto>(scheduleShift));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving schedule shift {ShiftId} for company {CompanyId}.", shiftId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Creates a new schedule shift.
        /// </summary>
        [HttpPost]
        [ProducesResponseType(typeof(ScheduleShiftDto), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<ScheduleShiftDto>> PostScheduleShift(string companyId, [FromBody] ScheduleShiftDto scheduleShiftDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var scheduleShift = _mapper.Map<ScheduleShift>(scheduleShiftDto);
                var createdScheduleShift = await _scheduleShiftService.Add(scheduleShift);

                if (createdScheduleShift == null)
                {
                    return BadRequest("Failed to create schedule shift.");
                }

                _memoryCache.Remove($"schedule_shifts_{companyId}");
                var createdScheduleShiftDto = _mapper.Map<ScheduleShiftDto>(createdScheduleShift);

                return CreatedAtAction(nameof(GetScheduleShift), new { companyId, shiftId = createdScheduleShift.ScheduleShiftId }, createdScheduleShiftDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating schedule shift for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Updates an existing schedule shift.
        /// </summary>
        [HttpPut("{shiftId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> PutScheduleShift(string companyId, int shiftId, [FromBody] ScheduleShiftDto scheduleShiftDto)
        {
            if (shiftId != scheduleShiftDto.ScheduleShiftId)
            {
                return BadRequest("Schedule shift ID mismatch.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var scheduleShift = _mapper.Map<ScheduleShift>(scheduleShiftDto);
                var updatedScheduleShift = await _scheduleShiftService.Update(scheduleShift);

                if (updatedScheduleShift == null)
                {
                    return NotFound($"Schedule shift with ID {shiftId} not found.");
                }
                _mapper.Map(scheduleShiftDto, updatedScheduleShift);
                _memoryCache.Remove($"schedule_shifts_{companyId}");
                _memoryCache.Remove($"schedule_shift_{companyId}_{shiftId}");

                return Ok(_mapper.Map<ScheduleShiftDto>(updatedScheduleShift));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating schedule shift {ShiftId} for company {CompanyId}.", shiftId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Deletes a schedule shift by its ID.
        /// </summary>
        [HttpDelete("{shiftId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> DeleteScheduleShift(string companyId, int shiftId)
        {
            try
            {
                var isDeleted = await _scheduleShiftService.Delete(shiftId);
                if (!isDeleted)
                {
                    return NotFound($"Schedule shift with ID {shiftId} not found.");
                }

                _memoryCache.Remove($"schedule_shifts_{companyId}");
                _memoryCache.Remove($"schedule_shift_{companyId}_{shiftId}");

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting schedule shift {ShiftId} for company {CompanyId}.", shiftId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
                }

        /// <summary>
        /// Gets replacement candidates for a specific shift.
        /// </summary>
        [HttpGet("{shiftId}/replacement-candidates")]
        [ProducesResponseType(typeof(IEnumerable<ReplacementCandidateDto>), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<ReplacementCandidateDto>>> GetReplacementCandidatesForShift(string companyId, int shiftId)
        {
            try
            {
                var shift = await _scheduleShiftService.Get(companyId, shiftId);
                if (shift == null)
                {
                    return NotFound($"Schedule shift with ID {shiftId} not found.");
                }
                var candidates = await _scheduleShiftService.GetReplacementCandidatesForShift(companyId, shiftId);
                var dtos = candidates.Select(p => new ReplacementCandidateDto { PersonId = p.PersonId, Name = p.Name });
                return Ok(dtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting replacement candidates for shift {ShiftId} in company {CompanyId}.", shiftId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Gets replacement candidates for an arbitrary time window.
        /// </summary>
        [HttpGet("replacement-candidates")]
        [ProducesResponseType(typeof(IEnumerable<ReplacementCandidateDto>), 200)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<ReplacementCandidateDto>>> GetReplacementCandidatesByWindow(
            string companyId,
            [FromQuery] DateTime start,
            [FromQuery] DateTime end,
            [FromQuery] int? locationId,
            [FromQuery] int? areaId,
            [FromQuery] int? excludePersonId)
        {
            try
            {
                var candidates = await _scheduleShiftService.GetReplacementCandidatesByWindow(companyId, start, end, locationId, areaId, excludePersonId);
                var dtos = candidates.Select(p => new ReplacementCandidateDto { PersonId = p.PersonId, Name = p.Name });
                return Ok(dtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting replacement candidates by window in company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}
