using AutoMapper;
using Microsoft.AspNetCore.Authorization;
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
    /// API controller for managing cost codes within a company.
    /// </summary>
    [ApiController]
    [Route("api/companies/{companyId}/[controller]")]
    public class CostCodesController : ControllerBase
    {
        private readonly ICostCodeService _costCodeService;
        private readonly IMapper _mapper;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<CostCodesController> _logger;

        public CostCodesController(ICostCodeService costCodeService, IMapper mapper, IMemoryCache memoryCache, ILogger<CostCodesController> logger)
        {
            _costCodeService = costCodeService ?? throw new ArgumentNullException(nameof(costCodeService));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _memoryCache = memoryCache ?? throw new ArgumentNullException(nameof(memoryCache));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Retrieves all cost codes for a given company.
        /// </summary>
        [HttpGet]
        [Authorize(Policy = "costcodes.read")]
        [ProducesResponseType(typeof(IEnumerable<CostCodeDto>), 200)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<CostCodeDto>>> GetCostCodes(string companyId)
        {
            try
            {
                var cacheKey = $"costcodes_{companyId}";
                if (!_memoryCache.TryGetValue(cacheKey, out IEnumerable<CostCode>? costCodes))
                {
                    _logger.LogInformation("Cache miss for cost codes in company {CompanyId}", companyId);
                    costCodes = await _costCodeService.Get(companyId, Array.Empty<int>());

                    if (costCodes == null || !costCodes.Any())
                    {
                        return Ok(Enumerable.Empty<CostCodeDto>());
                    }

                    var cacheEntryOptions = new MemoryCacheEntryOptions()
                        .SetSlidingExpiration(TimeSpan.FromMinutes(5));
                    _memoryCache.Set(cacheKey, costCodes, cacheEntryOptions);
                }
                else
                {
                    _logger.LogInformation("Cache hit for cost codes in company {CompanyId}", companyId);
                }

                return Ok(_mapper.Map<IEnumerable<CostCodeDto>>(costCodes));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while retrieving cost codes for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Retrieves a specific cost code by its ID.
        /// </summary>
        [HttpGet("{costCodeId}")]
        [Authorize(Policy = "costcodes.read")]
        [ProducesResponseType(typeof(CostCodeDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<CostCodeDto>> GetCostCode(string companyId, int costCodeId)
        {
            try
            {
                var costCodes = await _costCodeService.Get(companyId, new[] { costCodeId });
                var costCode = costCodes.FirstOrDefault();

                if (costCode == null)
                {
                    return NotFound($"Cost code with ID {costCodeId} not found in company {companyId}.");
                }

                return Ok(_mapper.Map<CostCodeDto>(costCode));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while retrieving cost code {CostCodeId} for company {CompanyId}.", costCodeId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Creates a new cost code.
        /// </summary>
        [HttpPost]
        [Authorize(Policy = "costcodes.create")]
        [ProducesResponseType(typeof(CostCodeDto), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<CostCodeDto>> PostCostCode(string companyId, [FromBody] CostCodeDto costCodeDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var costCode = _mapper.Map<CostCode>(costCodeDto);
                costCode.CompanyId = companyId;

                var createdCostCode = await _costCodeService.Add(costCode);
                if (createdCostCode == null)
                {
                    return BadRequest("Failed to create the cost code.");
                }

                _memoryCache.Remove($"costcodes_{companyId}");
                var createdDto = _mapper.Map<CostCodeDto>(createdCostCode);

                return CreatedAtAction(nameof(GetCostCode), new { companyId = companyId, costCodeId = createdCostCode.CostCodeId }, createdDto);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while creating a cost code for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Updates an existing cost code.
        /// </summary>
        [HttpPut("{costCodeId}")]
        [Authorize(Policy = "costcodes.update")]
        [ProducesResponseType(typeof(CostCodeDto), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<CostCodeDto>> PutCostCode(string companyId, int costCodeId, [FromBody] CostCodeDto costCodeDto)
        {
            if (costCodeId != costCodeDto.CostCodeId)
            {
                return BadRequest("Cost code ID mismatch.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var costCodes = await _costCodeService.Get(companyId, new[] { costCodeId });
                var costCodeToUpdate = costCodes.FirstOrDefault();

                if (costCodeToUpdate == null)
                {
                    return NotFound($"Cost code with ID {costCodeId} not found in company {companyId}.");
                }

                _mapper.Map(costCodeDto, costCodeToUpdate);
                costCodeToUpdate.CompanyId = companyId;

                var updated = await _costCodeService.Update(costCodeToUpdate);

                _memoryCache.Remove($"costcodes_{companyId}");

                return Ok(_mapper.Map<CostCodeDto>(updated));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while updating cost code {CostCodeId} for company {CompanyId}.", costCodeId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Deletes a cost code.
        /// </summary>
        [HttpDelete("{costCodeId}")]
        [Authorize(Policy = "costcodes.delete")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> DeleteCostCode(string companyId, int costCodeId)
        {
            try
            {
                var costCodes = await _costCodeService.Get(companyId, new[] { costCodeId });
                var costCode = costCodes.FirstOrDefault();

                if (costCode == null)
                {
                    return NotFound($"Cost code with ID {costCodeId} not found.");
                }

                var isDeleted = await _costCodeService.Delete(costCode);
                if (!isDeleted)
                {
                    return BadRequest("Failed to delete the cost code.");
                }

                _memoryCache.Remove($"costcodes_{companyId}");

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while deleting cost code {CostCodeId} for company {CompanyId}.", costCodeId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}
