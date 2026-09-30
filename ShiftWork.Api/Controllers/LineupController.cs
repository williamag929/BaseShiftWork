using System;
using System.Globalization;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/lineup")]
    public class LineupController : ControllerBase
    {
        private readonly ILineupAccessService _access;
        private readonly ILineupQueryService _query;
        private readonly ILineupCommitService _commit;
        private readonly ILogger<LineupController> _logger;

        public LineupController(ILineupAccessService access, ILineupQueryService query, ILineupCommitService commit, ILogger<LineupController> logger)
        {
            _access = access;
            _query = query;
            _commit = commit;
            _logger = logger;
        }

        [HttpGet]
        [Authorize(Policy = "lineup.view")]
        [ProducesResponseType(typeof(LineupDto), 200)]
        public async Task<IActionResult> Get(string companyId, [FromQuery] string? date)
        {
            if (!TryDate(date, out var day)) return BadRequest("date must be YYYY-MM-DD.");
            var access = await _access.ResolveAsync(User, companyId);
            if (access == null) return Forbid();
            return Ok(await _query.GetAsync(companyId, day, access));
        }

        [HttpPost("commit")]
        [Authorize(Policy = "lineup.edit")]
        [ProducesResponseType(typeof(LineupCommitResponse), 200)]
        public async Task<IActionResult> Commit(string companyId, [FromBody] LineupCommitRequest request)
        {
            if (!TryDate(request?.Date, out var day)) return BadRequest("date must be YYYY-MM-DD.");
            var access = await _access.ResolveAsync(User, companyId);
            if (access == null || !access.CanEdit) return Forbid();
            return Ok(await _commit.CommitAsync(companyId, day, request!, access));
        }

        private static bool TryDate(string? text, out DateOnly date) =>
            DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
    }
}
