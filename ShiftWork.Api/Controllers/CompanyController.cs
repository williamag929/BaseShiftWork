using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// API controller for managing companies.
    /// </summary>
    [ApiController]
    [Authorize]
    [Route("api/companies")]
    public class CompanyController : ControllerBase
    {
        private readonly ICompanyService _companyService;
        private readonly ILogger<CompanyController> _logger;
        private readonly IPlanService _planService;
        private readonly ShiftWorkContext _context;

        /// <summary>
        /// Initializes a new instance of the <see cref="CompanyController"/> class.
        /// </summary>
        public CompanyController(
            ICompanyService companyService,
            ILogger<CompanyController> logger,
            IPlanService planService,
            ShiftWorkContext context)
        {
            _companyService = companyService ?? throw new ArgumentNullException(nameof(companyService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _planService = planService ?? throw new ArgumentNullException(nameof(planService));
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        /// <summary>
        /// Retrieves all companies.
        /// </summary>
        [HttpGet]
        [AllowAnonymous]
        [ProducesResponseType(typeof(IEnumerable<Company>), 200)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<Company>>> GetCompanies()
        {
            try
            {
                var companies = await _companyService.GetAllCompanies();
                return Ok(companies);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while retrieving all companies.");
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Retrieves a company by its ID.
        /// </summary>
        [HttpGet("{id}")]
        [Authorize(Policy = "companies.read")]
        [ProducesResponseType(typeof(Company), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<Company>> GetCompany(string id)
        {
            try
            {
                var company = await _companyService.GetCompanyByIdAsync(id);
                if (company == null)
                {
                    return NotFound($"Company with ID {id} not found.");
                }
                return Ok(company);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while retrieving company with ID {CompanyId}.", id);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Creates a new company.
        /// </summary>
        [HttpPost]
        [Authorize(Policy = "companies.create")]
        [ProducesResponseType(typeof(Company), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<Company>> CreateCompany([FromBody] Company company)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                await _companyService.CreateCompanyAsync(company);
                return CreatedAtAction(nameof(GetCompany), new { id = company.CompanyId }, company);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while creating a new company.");
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Updates an existing company.
        /// </summary>
        [HttpPut("{id}")]
        [Authorize(Policy = "companies.update")]
        [ProducesResponseType(204)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> UpdateCompany(string id, [FromBody] Company company)
        {
            if (id != company.CompanyId)
            {
                return BadRequest("Company ID mismatch.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var updated = await _companyService.UpdateCompanyAsync(company);
                if (!updated)
                {
                    return NotFound($"Company with ID {id} not found.");
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while updating company with ID {CompanyId}.", id);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Deletes a company by its ID.
        /// </summary>
        [HttpDelete("{id}")]
        [Authorize(Policy = "companies.delete")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> DeleteCompany(string id)
        {
            try
            {
                var deleted = await _companyService.DeleteCompanyAsync(id);
                if (!deleted)
                {
                    return NotFound($"Company with ID {id} not found.");
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while deleting company with ID {CompanyId}.", id);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Upgrades the company plan (e.g. Free -> Pro).
        /// Integrates Stripe when configured; falls back to simulation when STRIPE_SECRET_KEY is absent.
        /// </summary>
        [HttpPost("{companyId}/plan/upgrade")]
        [Authorize]
        [ProducesResponseType(typeof(PlanUpgradeResponse), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<PlanUpgradeResponse>> UpgradePlan(
            string companyId,
            [FromBody] PlanUpgradeRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (string.IsNullOrWhiteSpace(request.TargetPlan))
                return BadRequest("TargetPlan is required.");

            try
            {
                _logger.LogInformation("{EventName} {CompanyId} {TargetPlan}",
                    "plan_upgrade_attempt", companyId, request.TargetPlan);

                var success = await _planService.UpgradePlanAsync(
                    companyId,
                    request.StripePaymentMethodId,
                    request.TargetPlan);

                if (!success)
                    return NotFound($"Company {companyId} not found.");

                _logger.LogInformation("{EventName} {CompanyId} {TargetPlan}",
                    "plan_upgrade_success", companyId, request.TargetPlan);

                return Ok(new PlanUpgradeResponse
                {
                    Success = true,
                    Plan = request.TargetPlan,
                    Message = $"Plan upgraded to {request.TargetPlan} successfully."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "{EventName} {CompanyId} {TargetPlan}",
                    "plan_upgrade_failed", companyId, request.TargetPlan);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Updates the OnboardingStatus of a company ("Pending" | "Verified" | "Complete").
        /// Called by the client after Firebase email verification is confirmed.
        /// </summary>
        [HttpPatch("{companyId}/onboarding-status")]
        [Authorize]
        [ProducesResponseType(204)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> PatchOnboardingStatus(
            string companyId,
            [FromBody] PatchOnboardingStatusRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var allowedStatuses = new[] { "Pending", "Verified", "Complete" };
            if (!Array.Exists(allowedStatuses, s => s == request.Status))
                return BadRequest($"Status must be one of: {string.Join(", ", allowedStatuses)}");

            try
            {
                var company = await _context.Companies.FindAsync(companyId);
                if (company == null)
                    return NotFound($"Company {companyId} not found.");

                company.OnboardingStatus = request.Status;
                await _context.SaveChangesAsync();

                _logger.LogInformation("{EventName} {CompanyId} {Status}",
                    "onboarding_status_updated", companyId, request.Status);

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update OnboardingStatus for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}