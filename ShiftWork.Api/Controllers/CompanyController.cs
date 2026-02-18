using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
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

        /// <summary>
        /// Initializes a new instance of the <see cref="CompanyController"/> class.
        /// </summary>
        public CompanyController(ICompanyService companyService, ILogger<CompanyController> logger)
        {
            _companyService = companyService ?? throw new ArgumentNullException(nameof(companyService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Retrieves all companies.
        /// </summary>
        [HttpGet]
        [Authorize(Policy = "companies.read")]
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
    }
}