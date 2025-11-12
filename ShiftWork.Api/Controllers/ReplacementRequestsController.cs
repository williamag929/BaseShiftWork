using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/replacement-requests")]
    public class ReplacementRequestsController : ControllerBase
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<ReplacementRequestsController> _logger;
        private readonly IMapper _mapper;

        public ReplacementRequestsController(ShiftWorkContext context, ILogger<ReplacementRequestsController> logger, IMapper mapper)
        {
            _context = context;
            _logger = logger;
            _mapper = mapper;
        }

        [HttpPost]
        [ProducesResponseType(typeof(ReplacementRequestDto), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<ReplacementRequestDto>> CreateReplacementRequest(string companyId, [FromBody] CreateReplacementRequestDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var request = new ReplacementRequest
                {
                    ShiftId = dto.ShiftId,
                    CompanyId = companyId,
                    Status = "Open",
                    Notes = dto.Notes,
                    CreatedAt = DateTime.UtcNow
                };

                _context.ReplacementRequests.Add(request);
                await _context.SaveChangesAsync();

                var result = _mapper.Map<ReplacementRequestDto>(request);
                return CreatedAtAction(nameof(GetReplacementRequest), new { companyId, requestId = request.RequestId }, result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating replacement request");
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("{requestId}")]
        [ProducesResponseType(typeof(ReplacementRequestDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<ReplacementRequestDto>> GetReplacementRequest(string companyId, int requestId)
        {
            try
            {
                var request = await _context.ReplacementRequests
                    .FirstOrDefaultAsync(r => r.CompanyId == companyId && r.RequestId == requestId);

                if (request == null)
                {
                    return NotFound();
                }

                return Ok(_mapper.Map<ReplacementRequestDto>(request));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving replacement request {RequestId}", requestId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPost("{requestId}/notify")]
        [ProducesResponseType(200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> NotifyReplacementCandidates(string companyId, int requestId, [FromBody] NotifyReplacementDto dto)
        {
            try
            {
                var request = await _context.ReplacementRequests
                    .FirstOrDefaultAsync(r => r.CompanyId == companyId && r.RequestId == requestId);

                if (request == null)
                {
                    return NotFound();
                }

                // TODO: Implement actual notification logic (push/SMS/email)
                // For now, just log the notification
                _logger.LogInformation("Notifying {Count} candidates for replacement request {RequestId} via {Channel}",
                    dto.PersonIds.Length, requestId, dto.Channel);

                return Ok(new { message = $"Notifications sent to {dto.PersonIds.Length} candidates", channel = dto.Channel });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error notifying candidates for replacement request {RequestId}", requestId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPost("{requestId}/accept")]
        [ProducesResponseType(200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> AcceptReplacementRequest(string companyId, int requestId, [FromBody] AcceptReplacementDto dto)
        {
            try
            {
                var request = await _context.ReplacementRequests
                    .FirstOrDefaultAsync(r => r.CompanyId == companyId && r.RequestId == requestId);

                if (request == null)
                {
                    return NotFound();
                }

                if (request.Status != "Open")
                {
                    return BadRequest($"Request is already {request.Status}");
                }

                request.Status = "Accepted";
                request.AcceptedBy = dto.PersonId;
                request.AcceptedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(_mapper.Map<ReplacementRequestDto>(request));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error accepting replacement request {RequestId}", requestId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpDelete("{requestId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> CancelReplacementRequest(string companyId, int requestId)
        {
            try
            {
                var request = await _context.ReplacementRequests
                    .FirstOrDefaultAsync(r => r.CompanyId == companyId && r.RequestId == requestId);

                if (request == null)
                {
                    return NotFound();
                }

                request.Status = "Cancelled";
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling replacement request {RequestId}", requestId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}
