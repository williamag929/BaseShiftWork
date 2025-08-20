using Microsoft.AspNetCore.Mvc;
using ShiftWork.Api.Services;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ScheduleShiftSummariesController : ControllerBase
    {
        private readonly IScheduleShiftSummaryService _scheduleShiftSummaryService;

        public ScheduleShiftSummariesController(IScheduleShiftSummaryService scheduleShiftSummaryService)
        {
            _scheduleShiftSummaryService = scheduleShiftSummaryService;
        }

        [HttpGet("{companyId}")]
        public async Task<IActionResult> Get(int companyId)
        {
            var summary = await _scheduleShiftSummaryService.GetScheduleShiftSummary(companyId);
            return Ok(summary);
        }
    }
}
