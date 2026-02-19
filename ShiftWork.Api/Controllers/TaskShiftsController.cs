using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Authorization;
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
    /// API controller for managing task shifts.
    /// </summary>
    [ApiController]
    [Route("api/companies/{companyId}/[controller]")]
    public class TaskShiftsController : ControllerBase
    {
        private readonly ITaskShiftService _taskShiftService;
        private readonly IMapper _mapper;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<TaskShiftsController> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="TaskShiftsController"/> class.
        /// </summary>
        public TaskShiftsController(ITaskShiftService taskShiftService, IMapper mapper, IMemoryCache memoryCache, ILogger<TaskShiftsController> logger)
        {
            _taskShiftService = taskShiftService ?? throw new ArgumentNullException(nameof(taskShiftService));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _memoryCache = memoryCache ?? throw new ArgumentNullException(nameof(memoryCache));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Retrieves all task shifts for a company.
        /// </summary>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<TaskShiftDto>), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        [Authorize(Policy = "tasks.read")]
        public async Task<ActionResult<IEnumerable<TaskShiftDto>>> GetTaskShifts(string companyId)
        {
            try
            {
                var cacheKey = $"task_shifts_{companyId}";
                if (!_memoryCache.TryGetValue(cacheKey, out IEnumerable<TaskShift> tasks))
                {
                    _logger.LogInformation("Cache miss for task shifts in company {CompanyId}", companyId);
                    tasks = await _taskShiftService.GetAll(companyId);

                    if (tasks == null || !tasks.Any())
                    {
                        return NotFound($"No task shifts found for company {companyId}.");
                    }

                    var cacheEntryOptions = new MemoryCacheEntryOptions().SetSlidingExpiration(TimeSpan.FromMinutes(5));
                    _memoryCache.Set(cacheKey, tasks, cacheEntryOptions);
                }

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
        [Authorize(Policy = "tasks.read")]
        public async Task<ActionResult<TaskShiftDto>> GetTaskShift(string companyId, int id)
        {
            try
            {
                var cacheKey = $"task_shift_{companyId}_{id}";
                if (!_memoryCache.TryGetValue(cacheKey, out TaskShift taskShift))
                {
                    _logger.LogInformation("Cache miss for task shift {Id} in company {CompanyId}", id, companyId);
                    taskShift = await _taskShiftService.Get(companyId, id);

                    if (taskShift == null)
                    {
                        return NotFound($"Task shift with ID {id} not found.");
                    }

                    var cacheEntryOptions = new MemoryCacheEntryOptions().SetSlidingExpiration(TimeSpan.FromMinutes(5));
                    _memoryCache.Set(cacheKey, taskShift, cacheEntryOptions);
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
        [Authorize(Policy = "tasks.create")]
        public async Task<ActionResult<TaskShiftDto>> PostTaskShift(string companyId, [FromBody] TaskShiftDto taskShiftDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var taskShift = _mapper.Map<TaskShift>(taskShiftDto);
                taskShift.CompanyId = companyId; // Ensure the company ID is set from the route

                var currentUser = User.Identity?.Name ?? "System";
                var currentTime = DateTime.UtcNow;

                taskShift.CreatedAt = currentTime;
                taskShift.CreatedBy = currentUser;
                taskShift.UpdatedAt = currentTime;
                taskShift.UpdatedBy = currentUser;
                taskShift.LastUpdatedBy = currentUser;
                taskShift.LastUpdatedAt = currentTime;

                var createdTask = await _taskShiftService.Add(taskShift);
                if (createdTask == null)
                {
                    return BadRequest("Failed to create task shift.");
                }
                _memoryCache.Remove($"task_shifts_{companyId}");
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
        [ProducesResponseType(typeof(TaskShiftDto), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        [Authorize(Policy = "tasks.update")]
        public async Task<ActionResult<TaskShiftDto>> PutTaskShift(string companyId, int id, [FromBody] TaskShiftDto taskShiftDto)
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
                var taskShiftToUpdate = await _taskShiftService.Get(companyId, id);
                if (taskShiftToUpdate == null)
                {
                    return NotFound($"Task shift with ID {id} not found.");
                }

                _mapper.Map(taskShiftDto, taskShiftToUpdate);

                var currentUser = User.Identity?.Name ?? "System";

                taskShiftToUpdate.UpdatedAt = DateTime.UtcNow;
                taskShiftToUpdate.UpdatedBy = currentUser;
                taskShiftToUpdate.LastUpdatedBy = currentUser;
                taskShiftToUpdate.LastUpdatedAt = DateTime.UtcNow;


                var updatedTaskShift = await _taskShiftService.Update(taskShiftToUpdate);

                _memoryCache.Remove($"task_shifts_{companyId}");
                _memoryCache.Remove($"task_shift_{companyId}_{id}");

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
        [Authorize(Policy = "tasks.delete")]
        public async Task<IActionResult> DeleteTaskShift(string companyId, int id)
        {
            try
            {
                // SECURITY FIX: The companyId must be passed to the service to ensure
                // a user from one company cannot delete resources from another.
                // Assuming the service method is updated to `Delete(string companyId, int id)` for security.
                var isDeleted = await _taskShiftService.Delete(companyId, id);
                if (!isDeleted)
                {
                    return NotFound($"Task shift with ID {id} not found.");
                }

                _memoryCache.Remove($"task_shifts_{companyId}");
                _memoryCache.Remove($"task_shift_{companyId}_{id}");
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