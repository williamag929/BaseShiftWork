using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/[controller]")]
    public class ShiftSummaryApprovalsController : ControllerBase
    {
        private readonly ShiftWorkContext _context;

        public ShiftSummaryApprovalsController(ShiftWorkContext context)
        {
            _context = context;
        }

        [HttpPut]
        [Authorize(Policy = "shift-summary-approvals.update")]
        public async Task<IActionResult> Upsert(int companyId, [FromBody] UpdateShiftSummaryApprovalRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Status))
                return BadRequest("Invalid request");

            var companyKey = companyId.ToString();
            var existing = await _context.ShiftSummaryApprovals.FirstOrDefaultAsync(a =>
                a.CompanyId == companyKey && a.PersonId == request.PersonId && a.Day == request.Day.Date);

            if (existing == null)
            {
                existing = new ShiftSummaryApproval
                {
                    CompanyId = companyKey,
                    PersonId = request.PersonId,
                    Day = request.Day.Date,
                };
                _context.ShiftSummaryApprovals.Add(existing);
            }

            existing.Status = request.Status;
            existing.ApprovedBy = request.ApprovedBy;
            existing.ApprovedAt = request.Status == "approved" ? DateTime.UtcNow : null;
            existing.Notes = request.Notes;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Saved", existing.PersonId, existing.Day, existing.Status });
        }
    }
}
