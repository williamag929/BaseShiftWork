using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Services;
using System;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/pto")]
    public class PtoController : ControllerBase
    {
        private readonly IPtoService _ptoService;
        private readonly ILogger<PtoController> _logger;

        public PtoController(IPtoService ptoService, ILogger<PtoController> logger)
        {
            _ptoService = ptoService;
            _logger = logger;
        }

        /// <summary>
        /// Get current PTO balance for a person
        /// </summary>
        [HttpGet("balance/{personId}")]
        [Authorize(Policy = "pto.read")]
        [ProducesResponseType(typeof(PtoBalanceDto), 200)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<PtoBalanceDto>> GetBalance(
            string companyId, 
            int personId,
            [FromQuery] DateTime? asOf = null)
        {
            try
            {
                var balance = await _ptoService.GetBalance(companyId, personId, asOf);
                return Ok(new PtoBalanceDto
                {
                    PersonId = personId,
                    Balance = balance,
                    AsOf = asOf ?? DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving PTO balance for person {PersonId}", personId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Configure PTO settings for a person
        /// </summary>
        [HttpPut("config/{personId}")]
        [Authorize(Policy = "pto.update")]
        [ProducesResponseType(204)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> ConfigurePto(
            string companyId,
            int personId,
            [FromBody] ConfigurePtoDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                await _ptoService.ConfigurePersonPto(
                    companyId,
                    personId,
                    dto.AccrualRatePerMonth,
                    dto.StartingBalance,
                    dto.StartDate);

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error configuring PTO for person {PersonId}", personId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }

    public class PtoBalanceDto
    {
        public int PersonId { get; set; }
        public decimal Balance { get; set; }
        public DateTime AsOf { get; set; }
    }

    public class ConfigurePtoDto
    {
        public decimal? AccrualRatePerMonth { get; set; }
        public decimal? StartingBalance { get; set; }
        public DateTime? StartDate { get; set; }
    }
}
