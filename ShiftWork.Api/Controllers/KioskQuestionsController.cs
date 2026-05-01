using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// Manager-facing CRUD for kiosk clock-out survey questions.
    /// Route: /api/companies/{companyId}/kiosk-questions
    /// </summary>
    [ApiController]
    [Authorize]
    [Route("api/companies/{companyId}/kiosk-questions")]
    public class KioskQuestionsController : ControllerBase
    {
        private readonly IKioskService _kioskService;

        public KioskQuestionsController(IKioskService kioskService)
        {
            _kioskService = kioskService;
        }

        /// <summary>List all questions (active and inactive) for management view.</summary>
        [HttpGet]
        [Authorize(Policy = "kiosk.questions.manage")]
        public async Task<ActionResult<IEnumerable<KioskQuestionDto>>> GetAll(int companyId)
        {
            var questions = await _kioskService.GetAllQuestionsAsync(companyId);
            return Ok(questions);
        }

        /// <summary>Get a single question by ID.</summary>
        [HttpGet("{id:int}")]
        [Authorize(Policy = "kiosk.questions.manage")]
        public async Task<ActionResult<KioskQuestionDto>> GetById(int companyId, int id)
        {
            try
            {
                var question = await _kioskService.GetQuestionAsync(companyId, id);
                return Ok(question);
            }
            catch (KeyNotFoundException)
            {
                return NotFound();
            }
        }

        /// <summary>Create a new kiosk question.</summary>
        [HttpPost]
        [Authorize(Policy = "kiosk.questions.manage")]
        public async Task<ActionResult<KioskQuestionDto>> Create(int companyId, [FromBody] CreateKioskQuestionDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var created = await _kioskService.CreateQuestionAsync(companyId, dto);
            return CreatedAtAction(nameof(GetById), new { companyId, id = created.QuestionId }, created);
        }

        /// <summary>Update an existing kiosk question.</summary>
        [HttpPut("{id:int}")]
        [Authorize(Policy = "kiosk.questions.manage")]
        public async Task<ActionResult<KioskQuestionDto>> Update(int companyId, int id, [FromBody] UpdateKioskQuestionDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var updated = await _kioskService.UpdateQuestionAsync(companyId, id, dto);
                return Ok(updated);
            }
            catch (KeyNotFoundException)
            {
                return NotFound();
            }
        }

        /// <summary>Delete a kiosk question. Answers already recorded are preserved (the FK allows orphans).</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Policy = "kiosk.questions.manage")]
        public async Task<IActionResult> Delete(int companyId, int id)
        {
            try
            {
                await _kioskService.DeleteQuestionAsync(companyId, id);
                return NoContent();
            }
            catch (KeyNotFoundException)
            {
                return NotFound();
            }
        }
    }
}
