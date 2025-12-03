using Microsoft.AspNetCore.Mvc;
using ShiftWork.Api.Services;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
     [Route("api/companies/{companyId}/[controller]")]
    public class ScheduleShiftSummariesController : ControllerBase
    {
        private readonly IScheduleShiftSummaryService _scheduleShiftSummaryService;

        public ScheduleShiftSummariesController(IScheduleShiftSummaryService scheduleShiftSummaryService)
        {
            _scheduleShiftSummaryService = scheduleShiftSummaryService;
        }

        [HttpGet]
        public async Task<IActionResult> Get(int companyId, [FromQuery] DateTime startDate, [FromQuery] DateTime endDate, [FromQuery] int? locationId, [FromQuery] int? personId)
        {
            var summary = await _scheduleShiftSummaryService.GetScheduleShiftSummary(companyId, startDate, endDate, locationId, personId);
            return Ok(summary);
        }
    }
}
