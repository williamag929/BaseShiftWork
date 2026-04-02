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

        public KioskController(IKioskService kioskService, IConfiguration configuration, ICompanySettingsService companySettingsService)
        {
            _kioskService = kioskService;
            _configuration = configuration;
            _companySettingsService = companySettingsService;
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
