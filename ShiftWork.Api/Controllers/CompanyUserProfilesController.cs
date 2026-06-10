using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// API controller for managing company user profiles (role assignments).
    /// </summary>
    [ApiController]
    [Route("api/companies/{companyId}/[controller]")]
    public class CompanyUserProfilesController : ControllerBase
    {
        private readonly ICompanyUserProfileService _profileService;
        private readonly IMapper _mapper;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<CompanyUserProfilesController> _logger;
        private readonly ShiftWorkContext _context;

        public CompanyUserProfilesController(
            ICompanyUserProfileService profileService,
            IMapper mapper,
            IMemoryCache memoryCache,
            ILogger<CompanyUserProfilesController> logger,
            ShiftWorkContext context)
        {
            _profileService = profileService ?? throw new ArgumentNullException(nameof(profileService));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _memoryCache = memoryCache ?? throw new ArgumentNullException(nameof(memoryCache));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        /// <summary>
        /// Get all profiles (role assignments) for a specific user in a company.
        /// </summary>
        [HttpGet("user/{companyUserId}")]
        [ProducesResponseType(typeof(IEnumerable<CompanyUserProfileDto>), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<CompanyUserProfileDto>>> GetUserProfiles(string companyId, string companyUserId)
        {
            try
            {
                var profiles = await _profileService.GetProfiles(companyId, companyUserId);
                return Ok(_mapper.Map<IEnumerable<CompanyUserProfileDto>>(profiles));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving profiles for user {CompanyUserId} in company {CompanyId}", companyUserId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Get all users assigned to a specific role.
        /// </summary>
        [HttpGet("role/{roleId}")]
        [ProducesResponseType(typeof(IEnumerable<CompanyUserProfileDto>), 200)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<CompanyUserProfileDto>>> GetRoleProfiles(string companyId, int roleId)
        {
            try
            {
                var profiles = await _profileService.GetProfilesByRole(companyId, roleId);
                return Ok(_mapper.Map<IEnumerable<CompanyUserProfileDto>>(profiles));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving profiles for role {RoleId} in company {CompanyId}", roleId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Get all roles assigned to a specific person.
        /// </summary>
        [HttpGet("person/{personId}")]
        [ProducesResponseType(typeof(IEnumerable<CompanyUserProfileDto>), 200)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<CompanyUserProfileDto>>> GetPersonProfiles(string companyId, int personId)
        {
            try
            {
                var profiles = await _profileService.GetProfilesByPerson(companyId, personId);
                return Ok(_mapper.Map<IEnumerable<CompanyUserProfileDto>>(profiles));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving profiles for person {PersonId} in company {CompanyId}", personId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Assign a role to a user.
        /// </summary>
        [HttpPost("assign")]
        [ProducesResponseType(typeof(CompanyUserProfileDto), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<CompanyUserProfileDto>> AssignRole(string companyId, [FromBody] AssignRoleRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrEmpty(request.CompanyUserId) || request.RoleId <= 0)
                {
                    return BadRequest("Invalid request data.");
                }

                var assignedBy = User?.Identity?.Name ?? "System";
                var profile = await _profileService.AssignRoleToUser(
                    companyId,
                    request.CompanyUserId,
                    request.RoleId,
                    request.PersonId,
                    assignedBy);

                var profileDto = _mapper.Map<CompanyUserProfileDto>(profile);
                return CreatedAtAction(nameof(GetProfile), new { companyId, profileId = profile.ProfileId },profileDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning role {RoleId} to user {CompanyUserId} in company {CompanyId}", request.RoleId, request.CompanyUserId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Assign a role to a person (convenience endpoint).
        /// </summary>
        [HttpPost("assign-to-person")]
        [ProducesResponseType(typeof(CompanyUserProfileDto), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<CompanyUserProfileDto>> AssignRoleToPerson(string companyId, [FromBody] AssignRoleToPersonRequest request)
        {
            try
            {
                if (request == null || request.PersonId <= 0 || request.RoleId <= 0)
                {
                    return BadRequest("Invalid request data.");
                }

                var person = await _context.Persons
                    .FirstOrDefaultAsync(p => p.PersonId == request.PersonId && p.CompanyId == companyId);

                if (person == null)
                    return BadRequest("Person not found in this company.");

                var companyUser = await _context.CompanyUsers
                    .FirstOrDefaultAsync(cu => cu.CompanyId == companyId && cu.Email == person.Email);

                if (companyUser == null)
                    return BadRequest("This person has not accepted their invitation yet. They must log in before a role can be assigned.");

                var assignedBy = User?.Identity?.Name ?? "System";

                var profile = await _profileService.AssignRoleToUser(
                    companyId,
                    companyUser.CompanyUserId,
                    request.RoleId,
                    request.PersonId,
                    assignedBy);

                // Upsert UserRole so the permission system recognizes this assignment
                var existingUserRole = await _context.UserRoles
                    .FirstOrDefaultAsync(ur => ur.CompanyUserId == companyUser.CompanyUserId && ur.RoleId == request.RoleId && ur.CompanyId == companyId);

                if (existingUserRole == null)
                {
                    _context.UserRoles.Add(new UserRole
                    {
                        CompanyUserId = companyUser.CompanyUserId,
                        RoleId = request.RoleId,
                        CompanyId = companyId,
                        CreatedAt = DateTime.UtcNow
                    });
                    await _context.SaveChangesAsync();
                }

                var profileDto = _mapper.Map<CompanyUserProfileDto>(profile);
                return CreatedAtAction(nameof(GetProfile), new { companyId, profileId = profile.ProfileId }, profileDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning role {RoleId} to person {PersonId} in company {CompanyId}", request.RoleId, request.PersonId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Get a specific profile by ID.
        /// </summary>
        [HttpGet("{profileId}")]
        [ProducesResponseType(typeof(CompanyUserProfileDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<CompanyUserProfileDto>> GetProfile(string companyId, int profileId)
        {
            try
            {
                var profile = await _profileService.GetProfile(profileId);
                if (profile == null || profile.CompanyId != companyId)
                {
                    return NotFound($"Profile with ID {profileId} not found.");
                }

                return Ok(_mapper.Map<CompanyUserProfileDto>(profile));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving profile {ProfileId}", profileId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Remove a role assignment (deactivate profile).
        /// </summary>
        [HttpDelete("{profileId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> RemoveRoleAssignment(string companyId, int profileId)
        {
            try
            {
                var result = await _profileService.RemoveRoleFromUser(profileId);
                if (!result)
                {
                    return NotFound($"Profile with ID {profileId} not found.");
                }

                // Invalidate cache for this company
                _memoryCache.Remove($"profiles_{companyId}");

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing profile {ProfileId}", profileId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Remove all role assignments for a user.
        /// </summary>
        [HttpDelete("user/{companyUserId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> RemoveAllUserRoles(string companyId, string companyUserId)
        {
            try
            {
                await _profileService.RemoveAllRolesFromUser(companyId, companyUserId);
                
                // Invalidate cache
                _memoryCache.Remove($"profiles_{companyId}");
                _memoryCache.Remove($"profiles_{companyId}_{companyUserId}");

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing all roles for user {CompanyUserId} in company {CompanyId}", companyUserId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}
