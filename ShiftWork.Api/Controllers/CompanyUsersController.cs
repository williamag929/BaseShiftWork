using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/users")] // Adjusted the route to be more RESTful
    public class CompanyUsersController : ControllerBase
    {
        private readonly ICompanyUserService _companyUserService;
        private readonly IUserRoleService _userRoleService;
        private readonly ICompanyUserProfileService _companyUserProfileService;
        private readonly ILogger<CompanyUsersController> _logger;
        private readonly IMapper _mapper;

        public CompanyUsersController(ICompanyUserService companyUserService, IUserRoleService userRoleService, ICompanyUserProfileService companyUserProfileService, ILogger<CompanyUsersController> logger, IMapper mapper)
        {
            _companyUserService = companyUserService ?? throw new ArgumentNullException(nameof(companyUserService));
            _userRoleService = userRoleService ?? throw new ArgumentNullException(nameof(userRoleService));
            _companyUserProfileService = companyUserProfileService ?? throw new ArgumentNullException(nameof(companyUserProfileService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
        }

        [HttpGet]
        [Authorize(Policy = "company-users.read")]
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
        [Authorize(Policy = "company-users.read")]
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
        [Authorize(Policy = "company-users.update")]
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
        [Authorize(Policy = "company-users.update")]
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
        [Authorize(Policy = "company-users.update")]
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

        [HttpGet("{uid}/roles")]
        [Authorize(Policy = "company-users.read")]
        [ProducesResponseType(typeof(IEnumerable<RoleDto>), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<RoleDto>>> GetUserRoles(string companyId, string uid)
        {
            try
            {
                var roles = await _userRoleService.GetUserRolesAsync(companyId, uid);
                if (roles == null)
                {
                    return NotFound($"User with UID {uid} not found.");
                }

                return Ok(_mapper.Map<IEnumerable<RoleDto>>(roles));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving roles for user {Uid} in company {CompanyId}.", uid, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPut("{uid}/roles")]
        [Authorize(Policy = "company-users.roles.update")]
        [ProducesResponseType(typeof(IEnumerable<RoleDto>), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<RoleDto>>> UpdateUserRoles(string companyId, string uid, [FromBody] UserRolesUpdateDto updateDto)
        {
            try
            {
                var roles = await _userRoleService.UpdateUserRolesAsync(companyId, uid, updateDto.RoleIds);
                if (roles == null)
                {
                    return NotFound($"User with UID {uid} not found.");
                }

                return Ok(_mapper.Map<IEnumerable<RoleDto>>(roles));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating roles for user {Uid} in company {CompanyId}.", uid, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPut("{uid}/profile")]
        [Authorize(Policy = "company-users.profile.update")]
        [ProducesResponseType(typeof(CompanyUserProfileDto), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<CompanyUserProfileDto>> UpsertCompanyUserProfile(string companyId, string uid, [FromBody] CompanyUserProfileDto profileDto)
        {
            if (string.IsNullOrWhiteSpace(profileDto.CompanyId) || profileDto.CompanyId != companyId)
            {
                return BadRequest("Company ID mismatch.");
            }

            try
            {
                var link = await _companyUserProfileService.UpsertAsync(companyId, uid, profileDto.PersonId);
                if (link == null)
                {
                    return NotFound("User or person not found.");
                }

                return Ok(_mapper.Map<CompanyUserProfileDto>(link));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error linking user {Uid} to person {PersonId} in company {CompanyId}.", uid, profileDto.PersonId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPost("{uid}/bootstrap-admin")]
        [Authorize]
        [ProducesResponseType(typeof(IEnumerable<RoleDto>), 200)]
        [ProducesResponseType(403)]
        [ProducesResponseType(409)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<RoleDto>>> BootstrapAdmin(string companyId, string uid)
        {
            var requesterUid = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("user_id")
                ?? User.FindFirstValue("uid")
                ?? User.FindFirstValue(ClaimTypes.Name)
                ?? User.FindFirstValue("sub");

            if (string.IsNullOrWhiteSpace(requesterUid) || !string.Equals(requesterUid, uid, StringComparison.Ordinal))
            {
                return Forbid();
            }

            try
            {
                var roles = await _userRoleService.BootstrapAdminAsync(companyId, uid);
                if (roles == null)
                {
                    return NotFound($"User with UID {uid} not found.");
                }

                return Ok(_mapper.Map<IEnumerable<RoleDto>>(roles));
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error bootstrapping admin role for user {Uid} in company {CompanyId}.", uid, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}