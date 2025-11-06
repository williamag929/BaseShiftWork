using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/kiosk")]
    public class KioskController : ControllerBase
    {
        private readonly IKioskService _kioskService;

        public KioskController(IKioskService kioskService)
        {
            _kioskService = kioskService;
        }

        [HttpGet("{companyId}/questions")]
        public async Task<ActionResult<IEnumerable<KioskQuestion>>> GetKioskQuestions(int companyId)
        {
            return await _kioskService.GetActiveQuestionsAsync(companyId);
        }

        [HttpPost("answers")]
        public async Task<IActionResult> PostKioskAnswers([FromBody] List<KioskAnswer> answers)
        {
            if (answers == null || !answers.Any())
            {
                return BadRequest("Answers cannot be null or empty.");
            }

            await _kioskService.PostAnswersAsync(answers);

            return Ok();
        }
    }
}
