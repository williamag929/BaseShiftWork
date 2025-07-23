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
    /// <summary>
    /// API controller for managing task shifts.
    /// </summary>
    [ApiController]
    [Route("api/companies/{companyId}/[controller]")]
    public class TaskShiftsController : ControllerBase
    {
        private readonly ITaskShiftService _taskShiftService;
        private readonly IMapper _mapper;
        private readonly ILogger<TaskShiftsController> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="TaskShiftsController"/> class.
        /// </summary>
        public TaskShiftsController(ITaskShiftService taskShiftService, IMapper mapper, ILogger<TaskShiftsController> logger)
        {
            _taskShiftService = taskShiftService ?? throw new ArgumentNullException(nameof(taskShiftService));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Retrieves all task shifts for a company.
        /// </summary>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<TaskShiftDto>), 200)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<TaskShiftDto>>> GetTaskShifts(string companyId)
        {
            try
            {
                var tasks = await _taskShiftService.GetAll(companyId);
                return Ok(_mapper.Map<IEnumerable<TaskShiftDto>>(tasks));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving task shifts for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Retrieves a specific task shift by its ID.
        /// </summary>
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(TaskShiftDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<TaskShiftDto>> GetTaskShift(string companyId, int id)
        {
            try
            {
                var taskShift = await _taskShiftService.Get(companyId, id);
                if (taskShift == null)
                {
                    return NotFound($"Task shift with ID {id} not found.");
                }
                return Ok(_mapper.Map<TaskShiftDto>(taskShift));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving task shift {Id} for company {CompanyId}.", id, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Creates a new task shift.
        /// </summary>
        [HttpPost]
        [ProducesResponseType(typeof(TaskShiftDto), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<TaskShiftDto>> PostTaskShift(string companyId, [FromBody] TaskShiftDto taskShiftDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var taskShift = _mapper.Map<TaskShift>(taskShiftDto);
                var createdTask = await _taskShiftService.Add(taskShift);
                if (createdTask == null)
                {
                    return BadRequest("Failed to create task shift.");
                }
                var createdTaskDto = _mapper.Map<TaskShiftDto>(createdTask);
                return CreatedAtAction(nameof(GetTaskShift), new { companyId, id = createdTask.TaskShiftId }, createdTaskDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating task shift for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Updates an existing task shift.
        /// </summary>
        [HttpPut("{id}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> PutTaskShift(string companyId, int id, [FromBody] TaskShiftDto taskShiftDto)
        {
            if (id != taskShiftDto.TaskShiftId)
            {
                return BadRequest("Task shift ID mismatch.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var taskShift = _mapper.Map<TaskShift>(taskShiftDto);
                var updatedTaskShift = await _taskShiftService.Update(taskShift);
                if (updatedTaskShift == null)
                {
                    return NotFound($"Task shift with ID {id} not found.");
                }
                _mapper.Map(taskShiftDto, updatedTaskShift);
                return Ok(_mapper.Map<TaskShiftDto>(updatedTaskShift));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating task shift {Id} for company {CompanyId}.", id, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Deletes a task shift by its ID.
        /// </summary>
        [HttpDelete("{id}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> DeleteTaskShift(string companyId, int id)
        {
            try
            {
                // SECURITY FIX: The companyId must be passed to the service to ensure
                // a user from one company cannot delete resources from another.
                var isDeleted = await _taskShiftService.Delete(id);
                if (!isDeleted)
                {
                    return NotFound($"Task shift with ID {id} not found.");
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting task shift {Id} for company {CompanyId}.", id, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}