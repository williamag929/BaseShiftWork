using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/analytics")]
    public class AnalyticsController : ControllerBase
    {
        private readonly IAnalyticsService _analytics;

        public AnalyticsController(IAnalyticsService analytics)
        {
            _analytics = analytics;
        }

        [HttpGet("hours-summary")]
        [Authorize(Policy = "analytics.view")]
        public async Task<ActionResult<AnalyticsResponseDto>> HoursSummary(
            int companyId, [FromQuery] DateTime from, [FromQuery] DateTime to,
            [FromQuery] int? locationId, [FromQuery] int? areaId, [FromQuery] int? personId,
            [FromQuery] string groupBy = "day")
            => Ok(await _analytics.GetHoursSummaryAsync(companyId, BuildQuery(from, to, locationId, areaId, personId, groupBy)));

        [HttpGet("schedule-coverage")]
        [Authorize(Policy = "analytics.view")]
        public async Task<ActionResult<AnalyticsResponseDto>> ScheduleCoverage(
            int companyId, [FromQuery] DateTime from, [FromQuery] DateTime to,
            [FromQuery] int? locationId, [FromQuery] int? areaId, [FromQuery] int? personId,
            [FromQuery] string groupBy = "day")
            => Ok(await _analytics.GetScheduleCoverageAsync(companyId, BuildQuery(from, to, locationId, areaId, personId, groupBy)));

        [HttpGet("attendance")]
        [Authorize(Policy = "analytics.view")]
        public async Task<ActionResult<AnalyticsResponseDto>> Attendance(
            int companyId, [FromQuery] DateTime from, [FromQuery] DateTime to,
            [FromQuery] int? locationId, [FromQuery] int? areaId, [FromQuery] int? personId,
            [FromQuery] string groupBy = "day")
            => Ok(await _analytics.GetAttendanceAsync(companyId, BuildQuery(from, to, locationId, areaId, personId, groupBy)));

        [HttpGet("variance")]
        [Authorize(Policy = "analytics.view")]
        public async Task<ActionResult<AnalyticsResponseDto>> Variance(
            int companyId, [FromQuery] DateTime from, [FromQuery] DateTime to,
            [FromQuery] int? locationId, [FromQuery] int? areaId, [FromQuery] int? personId,
            [FromQuery] string groupBy = "person")
            => Ok(await _analytics.GetVarianceAsync(companyId, BuildQuery(from, to, locationId, areaId, personId, groupBy)));

        [HttpGet("kpis")]
        [Authorize(Policy = "analytics.view")]
        public async Task<ActionResult<AnalyticsKpisDto>> Kpis(
            int companyId, [FromQuery] DateTime from, [FromQuery] DateTime to,
            [FromQuery] int? locationId, [FromQuery] int? areaId, [FromQuery] int? personId)
            => Ok(await _analytics.GetKpisAsync(companyId, BuildQuery(from, to, locationId, areaId, personId, "day")));

        [HttpGet("drilldown")]
        [Authorize(Policy = "analytics.view")]
        public async Task<ActionResult<AnalyticsDrilldownResultDto>> Drilldown(
            int companyId, [FromQuery] DateTime from, [FromQuery] DateTime to,
            [FromQuery] int? locationId, [FromQuery] int? areaId, [FromQuery] int? personId,
            [FromQuery] string groupBy = "day", [FromQuery] string? bucket = null,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
        {
            page = page < 1 ? 1 : page;
            pageSize = pageSize is < 1 or > 200 ? 25 : pageSize;
            return Ok(await _analytics.GetDrilldownAsync(companyId, BuildQuery(from, to, locationId, areaId, personId, groupBy), bucket, page, pageSize));
        }

        private static AnalyticsQueryDto BuildQuery(DateTime from, DateTime to, int? locationId, int? areaId, int? personId, string groupBy)
            => new()
            {
                From = from,
                To = to,
                LocationId = locationId,
                AreaId = areaId,
                PersonId = personId,
                GroupBy = groupBy,
            };
    }
}
