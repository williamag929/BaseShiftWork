using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
     [Route("api/companies/{companyId}/shiftevents")]
    public class ShiftEventsController : ControllerBase
    {
        private readonly IShiftEventService _shiftEventService;
        private readonly ILogger<ShiftEventsController> _logger;
        private readonly IMapper _mapper;

        public ShiftEventsController(IShiftEventService shiftEventService, ILogger<ShiftEventsController> logger, IMapper mapper)
        {
            _shiftEventService = shiftEventService;
            _logger = logger;
            _mapper = mapper;
        }

        [HttpPost]
        [ProducesResponseType(typeof(ShiftEventDto), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(409)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<ShiftEventDto>> CreateShiftEvent(string companyId,[FromBody] ShiftEventDto shiftEventDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var createdShiftEvent = await _shiftEventService.CreateShiftEventAsync(shiftEventDto);
                var createdShiftEventDto = _mapper.Map<ShiftEventDto>(createdShiftEvent);
                return CreatedAtAction(nameof(GetShiftEvent), new { companyId, eventLogId = createdShiftEventDto.EventLogId }, createdShiftEventDto);
                //return CreatedAtAction(nameof(GetShiftEvent), new { id = createdShiftEventDto.EventLogId }, createdShiftEventDto);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Idempotency conflict creating shift event for person {PersonId}", shiftEventDto.PersonId);
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating shift event");
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("{eventLogId}")]
        [ProducesResponseType(typeof(ShiftEventDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<ShiftEventDto>> GetShiftEvent(string companyId,Guid eventLogId)
        {
            try
            {
                var shiftEvent = await _shiftEventService.GetShiftEventByIdAsync(eventLogId);
                if (shiftEvent == null)
                {
                    return NotFound();
                }
                var shiftEventDto = _mapper.Map<ShiftEventDto>(shiftEvent);
                return Ok(shiftEventDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting shift event with id {eventLogId}");
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("person/{personId}")]
        [ProducesResponseType(typeof(IEnumerable<ShiftEventDto>), 200)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<ShiftEventDto>>> GetShiftEventsByPersonId(string companyId, int personId)
        {
            try
            {
                var shiftEvents = await _shiftEventService.GetShiftEventsByPersonIdAsync(companyId, personId);
                var shiftEventDtos = _mapper.Map<IEnumerable<ShiftEventDto>>(shiftEvents);
                return Ok(shiftEventDtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting shift events for person with id {personId}");
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<ShiftEventDto>), 200)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<ShiftEventDto>>> GetShiftEventsByCompanyId(string companyId)
        {
            try
            {
                var shiftEvents = await _shiftEventService.GetShiftEventsByCompanyIdAsync(companyId);
                var shiftEventDtos = _mapper.Map<IEnumerable<ShiftEventDto>>(shiftEvents);
                return Ok(shiftEventDtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting shift events for company with id {companyId}");
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("eventtype/{eventType}")]
        [ProducesResponseType(typeof(IEnumerable<ShiftEventDto>), 200)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<ShiftEventDto>>> GetShiftEventsByEventType(string companyId, string eventType)
        {
            try
            {
                var shiftEvents = await _shiftEventService.GetShiftEventsByEventTypeAsync(companyId, eventType);
                var shiftEventDtos = _mapper.Map<IEnumerable<ShiftEventDto>>(shiftEvents);
                return Ok(shiftEventDtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting shift events with event type {eventType}");
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPut("{eventLogId}")]
        [ProducesResponseType(typeof(ShiftEventDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<ShiftEventDto>> UpdateShiftEvent(string companyId, Guid eventLogId, [FromBody] ShiftEventDto shiftEventDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var updated = await _shiftEventService.UpdateShiftEventAsync(eventLogId, shiftEventDto);
                if (updated == null)
                {
                    return NotFound();
                }
                return Ok(_mapper.Map<ShiftEventDto>(updated));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating shift event {EventLogId}", eventLogId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpDelete("{eventLogId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> DeleteShiftEvent(string companyId, Guid eventLogId)
        {
            try
            {
                var deleted = await _shiftEventService.DeleteShiftEventAsync(eventLogId);
                if (!deleted)
                {
                    return NotFound();
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting shift event {EventLogId}", eventLogId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}
