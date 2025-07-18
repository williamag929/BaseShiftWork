using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/users")] // Adjusted the route to be more RESTful
    public class CompanyUsersController : ControllerBase
    {
        private readonly ICompanyUserService _companyUserService;
        private readonly ILogger<CompanyUsersController> _logger;

        public CompanyUsersController(ICompanyUserService companyUserService, ILogger<CompanyUsersController> logger)
        {
            _companyUserService = companyUserService ?? throw new ArgumentNullException(nameof(companyUserService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<CompanyUser>), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<CompanyUser>>> GetCompanyUsers(string companyId)
        {
            try
            {
                var users = await _companyUserService.GetAllByCompanyIdAsync(companyId);
                if (users == null)
                {
                    return NotFound($"No users found for company {companyId}");
                }
                return Ok(users);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving users for company {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("{uid}")]
        [ProducesResponseType(typeof(CompanyUser), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<CompanyUser>> GetCompanyUser(string uid)
        {
            try
            {
                var user = await _companyUserService.GetByUidAsync(uid);
                if (user == null)
                {
                    return NotFound($"User with UID {uid} not found.");
                }
                return Ok(user);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving user with UID {Uid}", uid);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPost]
        [ProducesResponseType(typeof(CompanyUser), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<CompanyUser>> CreateCompanyUser(string companyId, [FromBody] CompanyUser companyUser)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                companyUser.CompanyId = companyId; // Ensure CompanyId is set from the route
                var createdUser = await _companyUserService.CreateAsync(companyUser);
                return CreatedAtAction(nameof(GetCompanyUser), new { uid = createdUser.Uid }, createdUser);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating user for company {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPut("{uid}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> UpdateCompanyUser(string uid, [FromBody] CompanyUser companyUser)
        {
            if (!ModelState.IsValid || uid != companyUser.Uid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var updatedUser = await _companyUserService.UpdateAsync(uid,companyUser);
                if (updatedUser == null)
                {
                    return NotFound($"User with UID {uid} not found.");
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user with UID {Uid}", uid);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}