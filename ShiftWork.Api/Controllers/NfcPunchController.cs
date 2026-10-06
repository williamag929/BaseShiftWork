using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;
using System;
using System.Security.Claims;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/nfc-punch")]
    public class NfcPunchController : ControllerBase
    {
        private readonly INfcPunchService _nfcPunchService;
        private readonly ILogger<NfcPunchController> _logger;

        public NfcPunchController(INfcPunchService nfcPunchService, ILogger<NfcPunchController> logger)
        {
            _nfcPunchService = nfcPunchService;
            _logger = logger;
        }

        /// <summary>Clocks the signed-in employee in or out at the site whose NFC tag they tapped.</summary>
        [HttpPost]
        [Authorize(Policy = "shift-events.create")]
        [ProducesResponseType(typeof(NfcPunchResponse), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(403)]
        [ProducesResponseType(404)]
        [ProducesResponseType(409)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<NfcPunchResponse>> Punch(string companyId, [FromBody] NfcPunchRequest request)
        {
            // Only the Mobile app's API JWT identifies an employee (personId claim).
            if (!int.TryParse(User.FindFirstValue("personId"), out var personId))
            {
                return StatusCode(403, new { code = "NOT_AN_EMPLOYEE", message = "Sign in with the Loqzen app to use NFC tags." });
            }

            try
            {
                var result = await _nfcPunchService.PunchAsync(companyId, personId, request);
                _logger.LogInformation(
                    "NFC punch {EventLogId} PersonId={PersonId} LocationId={LocationId} Type={EventType} Geofence={GeofenceStatus} Repeated={Repeated}",
                    result.EventLogId, personId, result.LocationId, result.EventType, result.GeofenceStatus, result.Repeated);
                return Ok(result);
            }
            catch (NfcPunchRejectedException ex)
            {
                return StatusCode(ex.StatusCode, new { code = ex.Code, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error recording NFC punch for person {PersonId}", personId);
                return StatusCode(500, new { code = "SERVER_ERROR", message = "An internal server error occurred." });
            }
        }
    }
}
