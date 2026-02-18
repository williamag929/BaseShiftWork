using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/timeoff-requests")]
    public class TimeOffRequestsController : ControllerBase
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<TimeOffRequestsController> _logger;
        private readonly IMapper _mapper;
    private readonly IPeopleService _peopleService;
    private readonly IPtoService _ptoService;
        private readonly INotificationService _notificationService;

        public TimeOffRequestsController(ShiftWorkContext context, ILogger<TimeOffRequestsController> logger, IMapper mapper, IPeopleService peopleService, INotificationService notificationService, IPtoService ptoService)
        {
            _context = context;
            _logger = logger;
            _mapper = mapper;
            _peopleService = peopleService;
            _notificationService = notificationService;
            _ptoService = ptoService;
        }

        /// <summary>
        /// Get all time off requests for a company with optional filters
        /// </summary>
        [HttpGet]
        [Authorize(Policy = "timeoff-requests.read")]
        [ProducesResponseType(typeof(IEnumerable<TimeOffRequestDto>), 200)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<TimeOffRequestDto>>> GetTimeOffRequests(
            string companyId,
            [FromQuery] int? personId = null,
            [FromQuery] string? status = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            try
            {
                var query = _context.TimeOffRequests
                    .Include(t => t.Person)
                    .Include(t => t.Approver)
                    .Where(t => t.CompanyId == companyId);

                if (personId.HasValue)
                {
                    query = query.Where(t => t.PersonId == personId.Value);
                }

                if (!string.IsNullOrEmpty(status))
                {
                    query = query.Where(t => t.Status == status);
                }

                if (startDate.HasValue)
                {
                    query = query.Where(t => t.EndDate >= startDate.Value);
                }

                if (endDate.HasValue)
                {
                    query = query.Where(t => t.StartDate <= endDate.Value);
                }

                var requests = await query.OrderByDescending(t => t.CreatedAt).ToListAsync();

                var dtos = requests.Select(r => new TimeOffRequestDto
                {
                    TimeOffRequestId = r.TimeOffRequestId,
                    CompanyId = r.CompanyId,
                    PersonId = r.PersonId,
                    PersonName = r.Person?.Name,
                    Type = r.Type,
                    StartDate = r.StartDate,
                    EndDate = r.EndDate,
                    IsPartialDay = r.IsPartialDay,
                    PartialStartTime = r.PartialStartTime,
                    PartialEndTime = r.PartialEndTime,
                    Reason = r.Reason,
                    Status = r.Status,
                    CreatedAt = r.CreatedAt,
                    ApprovedBy = r.ApprovedBy,
                    ApproverName = r.Approver?.Name,
                    ApprovedAt = r.ApprovedAt,
                    ApprovalNotes = r.ApprovalNotes,
                    HoursRequested = r.HoursRequested,
                    PtoBalanceBefore = r.PtoBalanceBefore,
                    PtoBalanceAfter = r.PtoBalanceAfter
                });

                return Ok(dtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time off requests for company {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Get a specific time off request by ID
        /// </summary>
        [HttpGet("{requestId}")]
        [Authorize(Policy = "timeoff-requests.read")]
        [ProducesResponseType(typeof(TimeOffRequestDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<TimeOffRequestDto>> GetTimeOffRequest(string companyId, int requestId)
        {
            try
            {
                var request = await _context.TimeOffRequests
                    .Include(t => t.Person)
                    .Include(t => t.Approver)
                    .FirstOrDefaultAsync(t => t.CompanyId == companyId && t.TimeOffRequestId == requestId);

                if (request == null)
                {
                    return NotFound();
                }

                var dto = new TimeOffRequestDto
                {
                    TimeOffRequestId = request.TimeOffRequestId,
                    CompanyId = request.CompanyId,
                    PersonId = request.PersonId,
                    PersonName = request.Person?.Name,
                    Type = request.Type,
                    StartDate = request.StartDate,
                    EndDate = request.EndDate,
                    IsPartialDay = request.IsPartialDay,
                    PartialStartTime = request.PartialStartTime,
                    PartialEndTime = request.PartialEndTime,
                    Reason = request.Reason,
                    Status = request.Status,
                    CreatedAt = request.CreatedAt,
                    ApprovedBy = request.ApprovedBy,
                    ApproverName = request.Approver?.Name,
                    ApprovedAt = request.ApprovedAt,
                    ApprovalNotes = request.ApprovalNotes,
                    HoursRequested = request.HoursRequested,
                    PtoBalanceBefore = request.PtoBalanceBefore,
                    PtoBalanceAfter = request.PtoBalanceAfter
                };

                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time off request {RequestId}", requestId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Create a new time off request
        /// </summary>
        [HttpPost]
        [Authorize(Policy = "timeoff-requests.create")]
        [ProducesResponseType(typeof(TimeOffRequestDto), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<TimeOffRequestDto>> CreateTimeOffRequest(string companyId, [FromBody] CreateTimeOffRequestDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                // Calculate hours requested
                var totalHours = (decimal)(dto.EndDate - dto.StartDate).TotalHours;
                if (dto.IsPartialDay && dto.PartialStartTime.HasValue && dto.PartialEndTime.HasValue)
                {
                    totalHours = (decimal)(dto.PartialEndTime.Value - dto.PartialStartTime.Value).TotalHours;
                }

                // Check for overlapping approved requests
                var overlapping = await _context.TimeOffRequests
                    .Where(t => t.CompanyId == companyId && 
                                t.PersonId == dto.PersonId && 
                                t.Status == "Approved" &&
                                t.StartDate < dto.EndDate && 
                                t.EndDate > dto.StartDate)
                    .AnyAsync();

                if (overlapping)
                {
                    return BadRequest("This time off request overlaps with an existing approved request.");
                }

                var request = new TimeOffRequest
                {
                    CompanyId = companyId,
                    PersonId = dto.PersonId,
                    Type = dto.Type,
                    StartDate = dto.StartDate,
                    EndDate = dto.EndDate,
                    IsPartialDay = dto.IsPartialDay,
                    PartialStartTime = dto.PartialStartTime,
                    PartialEndTime = dto.PartialEndTime,
                    Reason = dto.Reason,
                    Status = "Pending",
                    CreatedAt = DateTime.UtcNow,
                    HoursRequested = totalHours
                };

                _context.TimeOffRequests.Add(request);
                await _context.SaveChangesAsync();

                // Reload with navigation properties
                request = await _context.TimeOffRequests
                    .Include(t => t.Person)
                    .FirstOrDefaultAsync(t => t.TimeOffRequestId == request.TimeOffRequestId);

                var result = new TimeOffRequestDto
                {
                    TimeOffRequestId = request!.TimeOffRequestId,
                    CompanyId = request.CompanyId,
                    PersonId = request.PersonId,
                    PersonName = request.Person?.Name,
                    Type = request.Type,
                    StartDate = request.StartDate,
                    EndDate = request.EndDate,
                    IsPartialDay = request.IsPartialDay,
                    PartialStartTime = request.PartialStartTime,
                    PartialEndTime = request.PartialEndTime,
                    Reason = request.Reason,
                    Status = request.Status,
                    CreatedAt = request.CreatedAt,
                    HoursRequested = request.HoursRequested
                };

                return CreatedAtAction(nameof(GetTimeOffRequest), 
                    new { companyId, requestId = request.TimeOffRequestId }, result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating time off request");
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Approve or deny a time off request
        /// </summary>
        [HttpPatch("{requestId}/approve")]
        [Authorize(Policy = "timeoff-requests.approve")]
        [ProducesResponseType(typeof(TimeOffRequestDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<TimeOffRequestDto>> ApproveTimeOffRequest(
            string companyId, 
            int requestId, 
            [FromBody] ApproveTimeOffRequestDto dto,
            [FromQuery] int? approverId = null)
        {
            try
            {
                var request = await _context.TimeOffRequests
                    .Include(t => t.Person)
                    .FirstOrDefaultAsync(t => t.CompanyId == companyId && t.TimeOffRequestId == requestId);

                if (request == null)
                {
                    return NotFound();
                }

                if (request.Status != "Pending")
                {
                    return BadRequest($"Request is already {request.Status}");
                }

                request.Status = dto.Approved ? "Approved" : "Denied";
                request.ApprovedBy = approverId;
                request.ApprovedAt = DateTime.UtcNow;
                request.ApprovalNotes = dto.Notes;

                await _context.SaveChangesAsync();

                // If approved, create ShiftEvent to mark shifts as needing coverage
                if (dto.Approved)
                {
                    // If PTO/Vacation, deduct hours from PTO balance
                    try
                    {
                        if (request.HoursRequested.HasValue &&
                            (string.Equals(request.Type, "Vacation", StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(request.Type, "PTO", StringComparison.OrdinalIgnoreCase)))
                        {
                            var (before, after) = await _ptoService.ApplyTimeOff(companyId, request.PersonId, request.HoursRequested.Value, $"TimeOff #{request.TimeOffRequestId} ({request.Type})");
                            request.PtoBalanceBefore = before;
                            request.PtoBalanceAfter = after;
                            await _context.SaveChangesAsync();
                        }
                    }
                    catch (Exception ptoEx)
                    {
                        _logger.LogWarning(ptoEx, "Failed to apply PTO deduction for request {RequestId}", requestId);
                    }

                    var shiftEvent = new ShiftEvent
                    {
                        EventDate = DateTime.UtcNow,
                        EventType = "timeoff",
                        CompanyId = companyId,
                        PersonId = request.PersonId,
                        EventObject = System.Text.Json.JsonSerializer.Serialize(new
                        {
                            start = request.StartDate,
                            end = request.EndDate,
                            timeOffRequestId = request.TimeOffRequestId
                        }),
                        Description = $"Time off approved: {request.Type}",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.ShiftEvents.Add(shiftEvent);
                    await _context.SaveChangesAsync();
                }

                // Reload with approver
                request = await _context.TimeOffRequests
                    .Include(t => t.Person)
                    .Include(t => t.Approver)
                    .FirstOrDefaultAsync(t => t.TimeOffRequestId == requestId);

                // Notify employee of decision (default channel: push)
                try
                {
                    if (request?.PersonId != null)
                    {
                        var person = await _peopleService.Get(companyId, request.PersonId);
                        var targets = new List<(int personId, string? email, string? phone)>
                        {
                            (request.PersonId, person?.Email, person?.PhoneNumber)
                        };
                        var subject = request.Status == "Approved" ? "Time off approved" : "Time off decision";
                        var msg = request.Status == "Approved"
                            ? $"Your time off ({request.Type}) from {request.StartDate:g} to {request.EndDate:g} was approved."
                            : $"Your time off ({request.Type}) from {request.StartDate:g} to {request.EndDate:g} was denied.";
                        if (!string.IsNullOrWhiteSpace(request.ApprovalNotes))
                        {
                            msg += $" Notes: {request.ApprovalNotes}";
                        }
                        await _notificationService.NotifyReplacementCandidates(companyId, targets, "push", subject, msg, null);
                    }
                }
                catch (Exception nEx)
                {
                    _logger.LogWarning(nEx, "Failed to send time-off notification for request {RequestId}", requestId);
                }

                var result = new TimeOffRequestDto
                {
                    TimeOffRequestId = request!.TimeOffRequestId,
                    CompanyId = request.CompanyId,
                    PersonId = request.PersonId,
                    PersonName = request.Person?.Name,
                    Type = request.Type,
                    StartDate = request.StartDate,
                    EndDate = request.EndDate,
                    IsPartialDay = request.IsPartialDay,
                    PartialStartTime = request.PartialStartTime,
                    PartialEndTime = request.PartialEndTime,
                    Reason = request.Reason,
                    Status = request.Status,
                    CreatedAt = request.CreatedAt,
                    ApprovedBy = request.ApprovedBy,
                    ApproverName = request.Approver?.Name,
                    ApprovedAt = request.ApprovedAt,
                    ApprovalNotes = request.ApprovalNotes,
                    HoursRequested = request.HoursRequested,
                    PtoBalanceBefore = request.PtoBalanceBefore,
                    PtoBalanceAfter = request.PtoBalanceAfter
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error approving time off request {RequestId}", requestId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Cancel a time off request (only if pending or by the requester)
        /// </summary>
        [HttpDelete("{requestId}")]
        [Authorize(Policy = "timeoff-requests.delete")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> CancelTimeOffRequest(string companyId, int requestId)
        {
            try
            {
                var request = await _context.TimeOffRequests
                    .FirstOrDefaultAsync(t => t.CompanyId == companyId && t.TimeOffRequestId == requestId);

                if (request == null)
                {
                    return NotFound();
                }

                if (request.Status == "Approved")
                {
                    return BadRequest("Cannot cancel an approved request. Please contact your manager.");
                }

                request.Status = "Cancelled";
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling time off request {RequestId}", requestId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}
