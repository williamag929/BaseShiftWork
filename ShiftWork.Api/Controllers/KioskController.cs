using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/kiosk")]
    public class KioskController : ControllerBase
    {
        private readonly ShiftWorkContext _context;

        public KioskController(ShiftWorkContext context)
        {
            _context = context;
        }

        [HttpGet("{companyId}/questions")]
        public async Task<ActionResult<IEnumerable<KioskQuestion>>> GetKioskQuestions(int companyId)
        {
            return await _context.KioskQuestions
                .Where(q => q.CompanyId == companyId && q.IsActive)
                .ToListAsync();
        }

        [HttpPost("answers")]
        public async Task<IActionResult> PostKioskAnswers([FromBody] List<KioskAnswer> answers)
        {
            if (answers == null || !answers.Any())
            {
                return BadRequest("Answers cannot be null or empty.");
            }

            _context.KioskAnswers.AddRange(answers);
            await _context.SaveChangesAsync();

            return Ok();
        }
    }
}
