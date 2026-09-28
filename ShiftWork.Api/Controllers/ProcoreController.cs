using System;
using System.Threading.Tasks;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// Manages the company's Procore connection and manual daily-log manpower syncs.
    /// </summary>
    [ApiController]
    [Route("api/companies/{companyId}/[controller]")]
    public class ProcoreController : ControllerBase
    {
        private readonly IProcoreService _procoreService;
        private readonly IMapper _mapper;
        private readonly ILogger<ProcoreController> _logger;

        public ProcoreController(IProcoreService procoreService, IMapper mapper, ILogger<ProcoreController> logger)
        {
            _procoreService = procoreService ?? throw new ArgumentNullException(nameof(procoreService));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Returns the company's Procore connection (secrets masked). 200 with null body if none configured.
        /// </summary>
        [HttpGet("connection")]
        [Authorize(Policy = "procore.read")]
        [ProducesResponseType(typeof(ProcoreConnectionDto), 200)]
        public async Task<ActionResult<ProcoreConnectionDto>> GetConnection(string companyId)
        {
            var connection = await _procoreService.GetConnectionAsync(companyId);
            if (connection == null)
            {
                return Ok(null);
            }
            return Ok(_mapper.Map<ProcoreConnectionDto>(connection));
        }

        /// <summary>
        /// Creates or updates the company's Procore connection.
        /// </summary>
        [HttpPut("connection")]
        [Authorize(Policy = "procore.manage")]
        [ProducesResponseType(typeof(ProcoreConnectionDto), 200)]
        [ProducesResponseType(400)]
        public async Task<ActionResult<ProcoreConnectionDto>> SaveConnection(string companyId, [FromBody] ProcoreConnectionInputDto input)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var connection = await _procoreService.SaveConnectionAsync(companyId, input);
            return Ok(_mapper.Map<ProcoreConnectionDto>(connection));
        }

        /// <summary>
        /// Verifies the stored credentials can authenticate with Procore.
        /// </summary>
        [HttpPost("test")]
        [Authorize(Policy = "procore.manage")]
        [ProducesResponseType(typeof(ProcoreSyncResultDto), 200)]
        public async Task<ActionResult<ProcoreSyncResultDto>> Test(string companyId)
        {
            var result = await _procoreService.TestConnectionAsync(companyId);
            return Ok(result);
        }

        /// <summary>
        /// Manually pushes a daily report's manpower (workers + hours) to Procore.
        /// </summary>
        [HttpPost("sync/daily-report/{reportId}")]
        [Authorize(Policy = "procore.sync")]
        [ProducesResponseType(typeof(ProcoreSyncResultDto), 200)]
        public async Task<ActionResult<ProcoreSyncResultDto>> SyncDailyReport(string companyId, Guid reportId)
        {
            var result = await _procoreService.PushDailyReportManpowerAsync(companyId, reportId);
            return Ok(result);
        }

        /// <summary>
        /// Manually pushes a daily report's per-employee hours to Procore Timesheets (timecard entries).
        /// </summary>
        [HttpPost("sync/daily-report/{reportId}/timesheets")]
        [Authorize(Policy = "procore.sync")]
        [ProducesResponseType(typeof(ProcoreSyncResultDto), 200)]
        public async Task<ActionResult<ProcoreSyncResultDto>> SyncDailyReportTimesheets(string companyId, Guid reportId)
        {
            var result = await _procoreService.PushDailyReportTimesheetsAsync(companyId, reportId);
            return Ok(result);
        }
    }
}
