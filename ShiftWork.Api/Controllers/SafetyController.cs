using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/safety")]
    [Authorize]
    public class SafetyController : ControllerBase
    {
        private readonly ISafetyService _safety;
        private readonly ILogger<SafetyController> _logger;

        public SafetyController(ISafetyService safety, ILogger<SafetyController> logger)
        {
            _safety = safety;
            _logger = logger;
        }

        [HttpGet]
        [Authorize(Policy = "safety.read")]
        public async Task<ActionResult<IEnumerable<SafetyContentDto>>> GetContents(
            string companyId,
            [FromQuery] int? locationId = null,
            [FromQuery] string? type = null,
            [FromQuery] string? status = null)
        {
            try
            {
                var personId = GetPersonId();
                var contents = await _safety.GetContentsAsync(companyId, locationId, type, status);
                return Ok(contents.Select(c => ToDto(c, personId)));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting safety contents for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("pending")]
        [Authorize(Policy = "safety.read")]
        public async Task<ActionResult<IEnumerable<SafetyContentDto>>> GetPending(string companyId)
        {
            try
            {
                var personId = GetPersonId();
                var contents = await _safety.GetPendingForPersonAsync(companyId, personId);
                return Ok(contents.Select(c => ToDto(c, personId, isAcknowledged: false)));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting pending safety for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("{safetyContentId:guid}")]
        [Authorize(Policy = "safety.read")]
        public async Task<ActionResult<SafetyContentDto>> GetContent(string companyId, Guid safetyContentId)
        {
            try
            {
                var personId = GetPersonId();
                var content = await _safety.GetByIdAsync(safetyContentId, companyId);
                if (content == null) return NotFound();

                return Ok(ToDto(content, personId));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting safety content {SafetyContentId}", safetyContentId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPost]
        [Authorize(Policy = "safety.create")]
        public async Task<ActionResult<SafetyContentDto>> CreateContent(
            string companyId,
            [FromBody] CreateSafetyContentDto dto)
        {
            try
            {
                var personId = GetPersonId();
                var content = new SafetyContent
                {
                    Title = dto.Title,
                    Description = dto.Description,
                    Type = dto.Type,
                    LocationId = dto.LocationId,
                    ContentUrl = dto.ContentUrl,
                    TextContent = dto.TextContent,
                    ThumbnailUrl = dto.ThumbnailUrl,
                    DurationMinutes = dto.DurationMinutes,
                    IsAcknowledgmentRequired = dto.IsAcknowledgmentRequired,
                    ScheduledFor = dto.ScheduledFor,
                    Tags = dto.Tags != null ? JsonSerializer.Serialize(dto.Tags) : null,
                    Status = dto.Status,
                    CreatedByPersonId = personId
                };

                var created = await _safety.CreateAsync(companyId, content);
                return CreatedAtAction(nameof(GetContent),
                    new { companyId, safetyContentId = created.SafetyContentId },
                    ToDto(created, personId, isAcknowledged: false));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating safety content for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPut("{safetyContentId:guid}")]
        [Authorize(Policy = "safety.create")]
        public async Task<ActionResult<SafetyContentDto>> UpdateContent(
            string companyId,
            Guid safetyContentId,
            [FromBody] UpdateSafetyContentDto dto)
        {
            try
            {
                var personId = GetPersonId();
                var updates = new SafetyContent
                {
                    Title = dto.Title,
                    Description = dto.Description,
                    Type = dto.Type,
                    LocationId = dto.LocationId,
                    ContentUrl = dto.ContentUrl,
                    TextContent = dto.TextContent,
                    ThumbnailUrl = dto.ThumbnailUrl,
                    DurationMinutes = dto.DurationMinutes,
                    IsAcknowledgmentRequired = dto.IsAcknowledgmentRequired,
                    ScheduledFor = dto.ScheduledFor,
                    Tags = dto.Tags != null ? JsonSerializer.Serialize(dto.Tags) : null,
                    Status = dto.Status
                };

                var updated = await _safety.UpdateAsync(safetyContentId, companyId, updates);
                if (updated == null) return NotFound();

                return Ok(ToDto(updated, personId));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating safety content {SafetyContentId}", safetyContentId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpDelete("{safetyContentId:guid}")]
        [Authorize(Policy = "safety.delete")]
        public async Task<IActionResult> ArchiveContent(string companyId, Guid safetyContentId)
        {
            try
            {
                var archived = await _safety.ArchiveAsync(safetyContentId, companyId);
                return archived ? NoContent() : NotFound();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error archiving safety content {SafetyContentId}", safetyContentId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPost("{safetyContentId:guid}/acknowledge")]
        [Authorize(Policy = "safety.read")]
        public async Task<IActionResult> Acknowledge(
            string companyId,
            Guid safetyContentId,
            [FromBody] AcknowledgeDto dto)
        {
            try
            {
                var personId = GetPersonId();
                var success = await _safety.AcknowledgeAsync(safetyContentId, companyId, personId, dto.Notes);
                return success ? Ok() : NotFound();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error acknowledging safety content {SafetyContentId}", safetyContentId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("{safetyContentId:guid}/acknowledgments")]
        [Authorize(Policy = "safety.track")]
        public async Task<ActionResult<AcknowledgmentStatusDto>> GetAcknowledgmentStatus(
            string companyId,
            Guid safetyContentId)
        {
            try
            {
                var status = await _safety.GetAcknowledgmentStatusAsync(safetyContentId, companyId);
                return Ok(new AcknowledgmentStatusDto
                {
                    TotalAssigned = status.TotalAssigned,
                    TotalCompleted = status.TotalCompleted,
                    CompletionRate = status.CompletionRate,
                    Completed = status.Completed.Select(p => new PersonAckDto
                    {
                        PersonId = p.PersonId,
                        Name = p.Name,
                        AcknowledgedAt = p.AcknowledgedAt
                    }).ToList(),
                    Pending = status.Pending.Select(p => new PersonAckDto
                    {
                        PersonId = p.PersonId,
                        Name = p.Name,
                        AcknowledgedAt = null
                    }).ToList()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting acknowledgment status for {SafetyContentId}", safetyContentId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        private int GetPersonId()
        {
            var value = User.FindFirstValue("personId");
            return int.TryParse(value, out var id) ? id : 0;
        }

        private static SafetyContentDto ToDto(SafetyContent c, int requestingPersonId, bool? isAcknowledged = null)
        {
            var acknowledged = isAcknowledged ?? (c.Acknowledgments?.Any(a => a.PersonId == requestingPersonId) == true);

            List<string>? tags = null;
            if (!string.IsNullOrEmpty(c.Tags))
            {
                try { tags = JsonSerializer.Deserialize<List<string>>(c.Tags); }
                catch { /* ignore malformed json */ }
            }

            return new SafetyContentDto
            {
                SafetyContentId = c.SafetyContentId,
                CompanyId = c.CompanyId,
                LocationId = c.LocationId,
                Title = c.Title,
                Description = c.Description,
                Type = c.Type,
                ContentUrl = c.ContentUrl,
                TextContent = c.TextContent,
                ThumbnailUrl = c.ThumbnailUrl,
                DurationMinutes = c.DurationMinutes,
                IsAcknowledgmentRequired = c.IsAcknowledgmentRequired,
                ScheduledFor = c.ScheduledFor,
                Tags = tags,
                Status = c.Status,
                CreatedByName = c.CreatedBy?.Name ?? "",
                IsAcknowledgedByCurrentUser = acknowledged,
                CreatedAt = c.CreatedAt
            };
        }
    }
}
