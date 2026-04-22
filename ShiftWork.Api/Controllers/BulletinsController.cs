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
    [Route("api/companies/{companyId}/bulletins")]
    [Authorize]
    public class BulletinsController : ControllerBase
    {
        private readonly IBulletinService _bulletins;
        private readonly ILogger<BulletinsController> _logger;

        public BulletinsController(IBulletinService bulletins, ILogger<BulletinsController> logger)
        {
            _bulletins = bulletins;
            _logger = logger;
        }

        [HttpGet]
        [Authorize(Policy = "bulletins.read")]
        public async Task<ActionResult<IEnumerable<BulletinDto>>> GetBulletins(
            string companyId,
            [FromQuery] int? locationId = null,
            [FromQuery] string? type = null,
            [FromQuery] string? status = null)
        {
            try
            {
                var personId = GetPersonId();
                var bulletins = await _bulletins.GetBulletinsAsync(companyId, personId, locationId, type, status);
                var readIds = await _bulletins.GetUnreadAsync(companyId, personId);
                var unreadSet = readIds.Select(b => b.BulletinId).ToHashSet();

                return Ok(bulletins.Select(b => ToDto(b, !unreadSet.Contains(b.BulletinId))));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting bulletins for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("unread")]
        [Authorize(Policy = "bulletins.read")]
        public async Task<ActionResult<IEnumerable<BulletinDto>>> GetUnread(
            string companyId,
            [FromQuery] bool urgentOnly = false)
        {
            try
            {
                var personId = GetPersonId();
                var bulletins = await _bulletins.GetUnreadAsync(companyId, personId, urgentOnly);
                return Ok(bulletins.Select(b => ToDto(b, false)));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting unread bulletins for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("{bulletinId:guid}")]
        [Authorize(Policy = "bulletins.read")]
        public async Task<ActionResult<BulletinDto>> GetBulletin(string companyId, Guid bulletinId)
        {
            try
            {
                var personId = GetPersonId();
                var bulletin = await _bulletins.GetByIdAsync(bulletinId, companyId);
                if (bulletin == null) return NotFound();

                var isRead = bulletin.Reads.Any(r => r.PersonId == personId);
                return Ok(ToDto(bulletin, isRead));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting bulletin {BulletinId}", bulletinId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPost]
        [Authorize(Policy = "bulletins.create")]
        public async Task<ActionResult<BulletinDto>> CreateBulletin(string companyId, [FromBody] CreateBulletinDto dto)
        {
            try
            {
                var personId = GetPersonId();
                var bulletin = new Bulletin
                {
                    Title = dto.Title,
                    Content = dto.Content,
                    Type = dto.Type,
                    Priority = dto.Priority,
                    LocationId = dto.LocationId,
                    ExpiresAt = dto.ExpiresAt,
                    AttachmentUrls = dto.AttachmentUrls != null ? JsonSerializer.Serialize(dto.AttachmentUrls) : null,
                    Status = dto.Status,
                    CreatedByPersonId = personId,
                    PublishedAt = dto.Status == "Published" ? DateTime.UtcNow : default
                };

                var created = await _bulletins.CreateAsync(companyId, bulletin);
                return CreatedAtAction(nameof(GetBulletin),
                    new { companyId, bulletinId = created.BulletinId },
                    ToDto(created, false));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating bulletin for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPut("{bulletinId:guid}")]
        [Authorize(Policy = "bulletins.create")]
        public async Task<ActionResult<BulletinDto>> UpdateBulletin(string companyId, Guid bulletinId, [FromBody] UpdateBulletinDto dto)
        {
            try
            {
                var updates = new Bulletin
                {
                    Title = dto.Title,
                    Content = dto.Content,
                    Type = dto.Type,
                    Priority = dto.Priority,
                    LocationId = dto.LocationId,
                    ExpiresAt = dto.ExpiresAt,
                    AttachmentUrls = dto.AttachmentUrls != null ? JsonSerializer.Serialize(dto.AttachmentUrls) : null,
                    Status = dto.Status
                };

                var updated = await _bulletins.UpdateAsync(bulletinId, companyId, updates);
                if (updated == null) return NotFound();

                return Ok(ToDto(updated, false));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating bulletin {BulletinId}", bulletinId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpDelete("{bulletinId:guid}")]
        [Authorize(Policy = "bulletins.delete")]
        public async Task<IActionResult> ArchiveBulletin(string companyId, Guid bulletinId)
        {
            try
            {
                var archived = await _bulletins.ArchiveAsync(bulletinId, companyId);
                return archived ? NoContent() : NotFound();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error archiving bulletin {BulletinId}", bulletinId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPost("{bulletinId:guid}/read")]
        [Authorize(Policy = "bulletins.read")]
        public async Task<IActionResult> MarkAsRead(string companyId, Guid bulletinId)
        {
            try
            {
                await _bulletins.MarkAsReadAsync(bulletinId, companyId, GetPersonId());
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking bulletin {BulletinId} as read", bulletinId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("{bulletinId:guid}/reads")]
        [Authorize(Policy = "bulletins.track-reads")]
        public async Task<ActionResult<IEnumerable<BulletinReadDto>>> GetReads(string companyId, Guid bulletinId)
        {
            try
            {
                var reads = await _bulletins.GetReadsAsync(bulletinId, companyId);
                return Ok(reads.Select(r => new BulletinReadDto
                {
                    PersonId = r.PersonId,
                    PersonName = r.Person?.Name ?? "",
                    ReadAt = r.ReadAt
                }));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting reads for bulletin {BulletinId}", bulletinId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        private int GetPersonId()
        {
            var value = User.FindFirstValue("personId");
            return int.TryParse(value, out var id) ? id : 0;
        }

        private static BulletinDto ToDto(Bulletin b, bool isRead)
        {
            List<string>? attachments = null;
            if (!string.IsNullOrEmpty(b.AttachmentUrls))
            {
                try { attachments = JsonSerializer.Deserialize<List<string>>(b.AttachmentUrls); }
                catch { /* ignore malformed json */ }
            }

            return new BulletinDto
            {
                BulletinId = b.BulletinId,
                CompanyId = b.CompanyId,
                LocationId = b.LocationId,
                Title = b.Title,
                Content = b.Content,
                Type = b.Type,
                Priority = b.Priority,
                AttachmentUrls = attachments,
                PublishedAt = b.PublishedAt,
                ExpiresAt = b.ExpiresAt,
                Status = b.Status,
                CreatedByName = b.CreatedBy?.Name ?? "",
                IsReadByCurrentUser = isRead,
                TotalReads = b.Reads?.Count ?? 0,
                CreatedAt = b.CreatedAt
            };
        }
    }
}
