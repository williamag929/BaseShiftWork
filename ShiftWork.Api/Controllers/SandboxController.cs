using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Services;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// Manages sandbox/demo data for a company during and after onboarding.
    /// </summary>
    [ApiController]
    [Authorize]
    [Route("api/companies/{companyId}/sandbox")]
    public class SandboxController : ControllerBase
    {
        private readonly ISandboxService _sandboxService;
        private readonly IPlanService _planService;
        private readonly ILogger<SandboxController> _logger;

        public SandboxController(
            ISandboxService sandboxService,
            IPlanService planService,
            ILogger<SandboxController> logger)
        {
            _sandboxService = sandboxService ?? throw new ArgumentNullException(nameof(sandboxService));
            _planService = planService ?? throw new ArgumentNullException(nameof(planService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Returns the count of remaining sandbox records for the company.
        /// </summary>
        [HttpGet("status")]
        [ProducesResponseType(typeof(SandboxStatusResponse), 200)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<SandboxStatusResponse>> GetStatus(string companyId)
        {
            try
            {
                var status = await _sandboxService.GetSandboxStatusAsync(companyId);
                return Ok(status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get sandbox status for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Hides sandbox records by setting their Status to "Sandbox".
        /// Existing Active queries automatically exclude them — no other query changes needed.
        /// EntityTypes: "Person", "Area", "Location", or "All".
        /// </summary>
        [HttpPost("hide")]
        [ProducesResponseType(204)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> HideSandboxData(string companyId, [FromBody] SandboxHideRequest request)
        {
            if (request?.EntityTypes == null || !request.EntityTypes.Any())
                return BadRequest("At least one entity type must be specified.");

            try
            {
                await _sandboxService.HideSandboxDataAsync(companyId, request.EntityTypes);
                _logger.LogInformation("{EventName} {CompanyId} {Types}",
                    FunnelEventNames.SandboxHideViaApi, companyId, string.Join(",", request.EntityTypes));
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to hide sandbox data for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Deletes all sandbox records and re-seeds fresh defaults.
        /// </summary>
        [HttpPost("reset")]
        [ProducesResponseType(204)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> ResetSandboxData(string companyId)
        {
            try
            {
                await _sandboxService.ResetSandboxDataAsync(companyId);
                _logger.LogInformation("{EventName} {CompanyId}", FunnelEventNames.SandboxResetViaApi, companyId);
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to reset sandbox data for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Permanently deletes all sandbox records. No re-seed.
        /// Requires Pro or Trial plan — Free plan users should use Hide instead.
        /// </summary>
        [HttpPost("delete")]
        [ProducesResponseType(204)]
        [ProducesResponseType(403)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> DeleteSandboxData(string companyId)
        {
            // Plan gate: only Pro/Trial may permanently delete sandbox data
            if (!await _planService.IsFeatureEnabledAsync(companyId, "sandbox.delete"))
            {
                _logger.LogWarning("{EventName} {CompanyId} plan=Free", FunnelEventNames.SandboxDeleteDenied, companyId);
                return StatusCode(403,
                    "Permanently deleting sandbox data requires a Pro or Trial plan. " +
                    "Use POST /sandbox/hide to hide demo data on the Free plan.");
            }

            try
            {
                await _sandboxService.DeleteSandboxDataAsync(companyId);
                // sandbox_delete_via_api marks the permanent removal; onboarding_completed
                // marks end of the customer onboarding funnel (Phase 6.1)
                _logger.LogInformation("{EventName} {CompanyId}", FunnelEventNames.SandboxDeleteViaApi, companyId);
                _logger.LogInformation("{EventName} {CompanyId}", FunnelEventNames.OnboardingCompleted, companyId);
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete sandbox data for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}
