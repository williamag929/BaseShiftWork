using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/permissions")]
    public class PermissionsController : ControllerBase
    {
        private readonly IPermissionService _permissionService;
        private readonly IMapper _mapper;
        private readonly ILogger<PermissionsController> _logger;

        public PermissionsController(IPermissionService permissionService, IMapper mapper, ILogger<PermissionsController> logger)
        {
            _permissionService = permissionService ?? throw new ArgumentNullException(nameof(permissionService));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        [Authorize(Policy = "permissions.read")]
        [ProducesResponseType(typeof(IEnumerable<PermissionDto>), 200)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<PermissionDto>>> GetPermissions(string companyId)
        {
            try
            {
                var permissions = await _permissionService.GetAllAsync(companyId);
                return Ok(_mapper.Map<IEnumerable<PermissionDto>>(permissions));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving permissions for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}
