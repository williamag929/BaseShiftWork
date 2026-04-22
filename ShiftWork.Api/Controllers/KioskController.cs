using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using ShiftWork.Api.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BCrypt.Net;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/kiosk")]
    public class KioskController : ControllerBase
    {
        private readonly IKioskService _kioskService;
        private readonly IConfiguration _configuration;
        private readonly ICompanySettingsService _companySettingsService;
        private readonly IBulletinService _bulletins;
        private readonly ISafetyService _safety;

        public KioskController(
            IKioskService kioskService,
            IConfiguration configuration,
            ICompanySettingsService companySettingsService,
            IBulletinService bulletins,
            ISafetyService safety)
        {
            _kioskService = kioskService;
            _configuration = configuration;
            _companySettingsService = companySettingsService;
            _bulletins = bulletins;
            _safety = safety;
        }

        [HttpGet("{companyId}/questions")]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<KioskQuestion>>> GetKioskQuestions(int companyId)
        {
            return await _kioskService.GetActiveQuestionsAsync(companyId);
        }

        [HttpPost("answers")]
        [AllowAnonymous]
        public async Task<IActionResult> PostKioskAnswers([FromBody] List<KioskAnswer> answers)
        {
            if (answers == null || !answers.Any())
            {
                return BadRequest("Answers cannot be null or empty.");
            }

            await _kioskService.PostAnswersAsync(answers);

            return Ok();
        }

        /// <summary>
        /// Returns the active employee list for display on a kiosk device.
        /// No authentication required — only name, photo and shift status are returned.
        /// </summary>
        [HttpGet("{companyId}/employees")]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<KioskEmployeeDto>>> GetKioskEmployees(string companyId)
        {
            if (string.IsNullOrWhiteSpace(companyId))
                return BadRequest("companyId is required.");

            var employees = await _kioskService.GetKioskEmployeesAsync(companyId);
            return Ok(employees);
        }

        /// <summary>
        /// Creates a clock-in or clock-out shift event from a kiosk device.
        /// Atomically persists the event and any associated kiosk answers.
        /// No authentication required — the person must belong to the specified company.
        /// </summary>
        [HttpPost("{companyId}/clock")]
        [AllowAnonymous]
        public async Task<ActionResult<KioskClockResponse>> ClockFromKiosk(string companyId, [FromBody] KioskClockRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (string.IsNullOrWhiteSpace(request.EventType) ||
                (request.EventType != "ClockIn" && request.EventType != "ClockOut"))
                return BadRequest(new { message = "EventType must be 'ClockIn' or 'ClockOut'." });

            try
            {
                var result = await _kioskService.ClockFromKioskAsync(companyId, request);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch
            {
                return StatusCode(500, "An error occurred while processing the clock event.");
            }
        }

        /// <summary>
        /// Returns up to 3 urgent unread bulletins and pending safety acknowledgments
        /// for the given employee immediately after a clock-out. Anonymous — personId
        /// is validated against the company, not via JWT.
        /// </summary>
        [HttpGet("{companyId}/post-clockout")]
        [AllowAnonymous]
        public async Task<ActionResult<PostClockoutDto>> GetPostClockout(
            string companyId,
            [FromQuery] int personId,
            [FromQuery] int? locationId = null)
        {
            try
            {
                // Urgent unread bulletins scoped to this location
                var unread = await _bulletins.GetUnreadAsync(companyId, personId);
                var urgent = unread
                    .Where(b => b.Priority == "Critical" || b.Type == "Urgent")
                    .Where(b => locationId == null || b.LocationId == null || b.LocationId == locationId)
                    .Take(3)
                    .Select(b => new KioskBulletinDto
                    {
                        BulletinId = b.BulletinId,
                        Title      = b.Title,
                        Content    = b.Content,
                        Priority   = b.Priority,
                        Type       = b.Type
                    })
                    .ToList();

                // Pending required safety acknowledgments
                var pendingSafety = await _safety.GetPendingForPersonAsync(companyId, personId);
                var safetyItems = pendingSafety
                    .Take(3)
                    .Select(s => new KioskSafetyDto
                    {
                        SafetyContentId        = s.SafetyContentId,
                        Title                  = s.Title,
                        Description            = s.Description,
                        TextContent            = s.TextContent,
                        Type                   = s.Type,
                        IsAcknowledgmentRequired = s.IsAcknowledgmentRequired
                    })
                    .ToList();

                return Ok(new PostClockoutDto
                {
                    UrgentBulletins = urgent,
                    PendingSafety   = safetyItems
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Marks a bulletin as read by the given employee. Anonymous — used from kiosk after clock-out.
        /// </summary>
        [HttpPost("{companyId}/bulletins/{bulletinId:guid}/mark-read")]
        [AllowAnonymous]
        public async Task<IActionResult> MarkBulletinRead(string companyId, Guid bulletinId, [FromQuery] int personId)
        {
            try
            {
                await _bulletins.MarkAsReadAsync(bulletinId, companyId, personId);
                return Ok();
            }
            catch (Exception)
            {
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Records a safety acknowledgment from a kiosk device. Anonymous — personId supplied in body.
        /// </summary>
        [HttpPost("{companyId}/safety/{safetyContentId:guid}/acknowledge")]
        [AllowAnonymous]
        public async Task<IActionResult> AcknowledgeSafety(
            string companyId,
            Guid safetyContentId,
            [FromQuery] int personId)
        {
            try
            {
                var success = await _safety.AcknowledgeAsync(safetyContentId, companyId, personId);
                return success ? Ok() : NotFound();
            }
            catch (Exception)
            {
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Verifies the admin password for kiosk location changes.
        /// First checks company settings, falls back to appsettings if not configured.
        /// </summary>
        /// <param name="companyId">The company ID to check settings for.</param>
        /// <param name="request">The password verification request.</param>
        /// <returns>True if password is correct, false otherwise.</returns>
        [HttpPost("{companyId}/verify-admin-password")]
        [Authorize(Policy = "kiosk.admin")]
        [ProducesResponseType(typeof(object), 200)]
        [ProducesResponseType(400)]
        public async Task<IActionResult> VerifyAdminPassword(string companyId, [FromBody] AdminPasswordVerificationRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new { verified = false, message = "Password is required." });
            }

            // Try to get company settings first
            var companySettings = await _companySettingsService.GetSettingsByCompanyId(companyId);
            
            bool verified = false;
            
            if (companySettings != null && !string.IsNullOrWhiteSpace(companySettings.KioskAdminPasswordHash))
            {
                // Verify against hashed password in database
                verified = BCrypt.Net.BCrypt.Verify(request.Password, companySettings.KioskAdminPasswordHash);
            }
            else
            {
                // Fallback to appsettings if not configured in database
                var configuredPassword = _configuration["KioskSettings:AdminPassword"] ?? "admin123";
                verified = request.Password == configuredPassword;
            }

            return Ok(new { verified });
        }
    }
}
