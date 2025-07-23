using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
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
    /// API controller for managing roles.
    /// </summary>
    [ApiController]
    [Route("api/companies/{companyId}/[controller]")]
    public class RolesController : ControllerBase
    {
        private readonly IRoleService _roleService;
        private readonly IMapper _mapper;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<RolesController> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="RolesController"/> class.
        /// </summary>
        public RolesController(IRoleService roleService, IMapper mapper, IMemoryCache memoryCache, ILogger<RolesController> logger)
        {
            _roleService = roleService ?? throw new ArgumentNullException(nameof(roleService));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _memoryCache = memoryCache ?? throw new ArgumentNullException(nameof(memoryCache));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Retrieves all roles for a company.
        /// </summary>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<RoleDto>), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<RoleDto>>> GetRoles(string companyId)
        {
            try
            {
                var cacheKey = $"roles_{companyId}";
                if (!_memoryCache.TryGetValue(cacheKey, out IEnumerable<Role> roles))
                {
                    _logger.LogInformation("Cache miss for roles in company {CompanyId}", companyId);
                    roles = await _roleService.GetAll(companyId);

                    if (roles == null || !roles.Any())
                    {
                        return NotFound($"No roles found for company {companyId}.");
                    }

                    var cacheEntryOptions = new MemoryCacheEntryOptions().SetSlidingExpiration(TimeSpan.FromMinutes(5));
                    _memoryCache.Set(cacheKey, roles, cacheEntryOptions);
                }
                else
                {
                    _logger.LogInformation("Cache hit for roles in company {CompanyId}", companyId);
                }

                return Ok(_mapper.Map<IEnumerable<RoleDto>>(roles));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving roles for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Retrieves a specific role by its ID.
        /// </summary>
        [HttpGet("{roleId}")]
        [ProducesResponseType(typeof(RoleDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<RoleDto>> GetRole(string companyId, int roleId)
        {
            try
            {
                var cacheKey = $"role_{companyId}_{roleId}";
                if (!_memoryCache.TryGetValue(cacheKey, out Role role))
                {
                    _logger.LogInformation("Cache miss for role {RoleId} in company {CompanyId}", roleId, companyId);
                    role = await _roleService.Get(companyId, roleId);

                    if (role == null)
                    {
                        return NotFound($"Role with ID {roleId} not found.");
                    }

                    var cacheEntryOptions = new MemoryCacheEntryOptions().SetSlidingExpiration(TimeSpan.FromMinutes(5));
                    _memoryCache.Set(cacheKey, role, cacheEntryOptions);
                }
                else
                {
                    _logger.LogInformation("Cache hit for role {RoleId} in company {CompanyId}", roleId, companyId);
                }

                return Ok(_mapper.Map<RoleDto>(role));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving role {RoleId} for company {CompanyId}.", roleId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Creates a new role.
        /// </summary>
        [HttpPost]
        [ProducesResponseType(typeof(RoleDto), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<RoleDto>> PostRole(string companyId, [FromBody] RoleDto roleDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var role = _mapper.Map<Role>(roleDto);
                var createdRole = await _roleService.Add(role);

                if (createdRole == null)
                {
                    return BadRequest("Failed to create role.");
                }

                _memoryCache.Remove($"roles_{companyId}");
                var createdRoleDto = _mapper.Map<RoleDto>(createdRole);

                return CreatedAtAction(nameof(GetRole), new { companyId, roleId = createdRole.RoleId }, createdRoleDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating role for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Updates an existing role.
        /// </summary>
        [HttpPut("{roleId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> PutRole(string companyId, int roleId, [FromBody] RoleDto roleDto)
        {
            if (roleId != roleDto.RoleId)
            {
                return BadRequest("Role ID mismatch.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var role = _mapper.Map<Role>(roleDto);
                var updatedRole = await _roleService.Update(role);

                if (updatedRole == null)
                {
                    return NotFound($"Role with ID {roleId} not found.");
                }
                _mapper.Map(roleDto, updatedRole);
                _memoryCache.Remove($"roles_{companyId}");
                _memoryCache.Remove($"role_{companyId}_{roleId}");

                return ok(_mapper.Map<RoleDto>(updatedRole));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating role {RoleId} for company {CompanyId}.", roleId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Deletes a role by its ID.
        /// </summary>
        [HttpDelete("{roleId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> DeleteRole(string companyId, int roleId)
        {
            try
            {
                var isDeleted = await _roleService.Delete(companyId, roleId);
                if (!isDeleted)
                {
                    return NotFound($"Role with ID {roleId} not found.");
                }

                _memoryCache.Remove($"roles_{companyId}");
                _memoryCache.Remove($"role_{companyId}_{roleId}");

                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Attempted to delete a role that is in use for company {CompanyId}.", companyId);
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting role {RoleId} for company {CompanyId}.", roleId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}