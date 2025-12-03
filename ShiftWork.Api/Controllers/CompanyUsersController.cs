using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.DTOs;
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
        private readonly IMapper _mapper;

        public CompanyUsersController(ICompanyUserService companyUserService, ILogger<CompanyUsersController> logger, IMapper mapper)
        {
            _companyUserService = companyUserService ?? throw new ArgumentNullException(nameof(companyUserService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
        }

        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<CompanyUserDto>), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<CompanyUserDto>>> GetCompanyUsers(string companyId)
        {
            try
            {
                var users = await _companyUserService.GetAllByCompanyIdAsync(companyId);
                if (users == null)
                {
                    return NotFound($"No users found for company {companyId}");
                }
                return Ok(_mapper.Map<IEnumerable<CompanyUserDto>>(users));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving users for company {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("{uid}")]
        [ProducesResponseType(typeof(CompanyUserDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<CompanyUserDto>> GetCompanyUser(string uid)
        {
            try
            {
                var user = await _companyUserService.GetByUidAsync(uid);
                if (user == null)
                {
                    return NotFound($"User with UID {uid} not found.");
                }
                return Ok(_mapper.Map<CompanyUserDto>(user));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving user with UID {Uid}", uid);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPost]
        [ProducesResponseType(typeof(CompanyUserDto), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<CompanyUserDto>> CreateCompanyUser(string companyId, [FromBody] CompanyUserDto companyUserDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var companyUser = _mapper.Map<CompanyUser>(companyUserDto);
                companyUser.CompanyId = companyId;

                var createdUser = await _companyUserService.CreateAsync(companyUser);

                var createdUserDto = _mapper.Map<CompanyUserDto>(createdUser);

                return CreatedAtAction(nameof(GetCompanyUser), new { companyId = createdUser.CompanyId, uid = createdUserDto.Uid }, createdUserDto);
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
        public async Task<IActionResult> UpdateCompanyUser(string uid, [FromBody] CompanyUserDto companyUserDto)
        {
            if (!ModelState.IsValid || uid != companyUserDto.Uid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var companyUser = _mapper.Map<CompanyUser>(companyUserDto);
                var updatedUser = await _companyUserService.UpdateAsync(uid, companyUser);
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

        [HttpDelete("{uid}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> DeleteCompanyUser(string uid)
        {
            try
            {
                var user = await _companyUserService.GetByUidAsync(uid);
                if (user == null)
                {
                    return NotFound($"User with UID {uid} not found.");
                }

                await _companyUserService.DeleteAsync(uid);

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting user with UID {Uid}", uid);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}