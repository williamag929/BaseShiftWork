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
    /// API controller for managing areas within a company.
    /// </summary>
    [ApiController]
    [Route("api/companies/{companyId}/[controller]")]
    public class AreasController : ControllerBase
    {
        private readonly IAreaService _areaService;
        private readonly IMapper _mapper;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<AreasController> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="AreasController"/> class.
        /// </summary>
        public AreasController(IAreaService areaService, IMapper mapper, IMemoryCache memoryCache, ILogger<AreasController> logger)
        {
            _areaService = areaService ?? throw new ArgumentNullException(nameof(areaService));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _memoryCache = memoryCache ?? throw new ArgumentNullException(nameof(memoryCache));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Retrieves all areas for a given company.
        /// </summary>
        /// <param name="companyId">The unique identifier of the company.</param>
        /// <returns>A list of areas.</returns>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<AreaDto>), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<AreaDto>>> GetAreas(string companyId)
        {
            try
            {
                var cacheKey = $"areas_{companyId}";
                if (!_memoryCache.TryGetValue(cacheKey, out IEnumerable<Area>? areas))
                {
                    _logger.LogInformation("Cache miss for areas in company {CompanyId}", companyId);
                    areas = await _areaService.Get(companyId, Array.Empty<int>());

                    // Return empty list instead of 404 to simplify clients
                    if (areas == null || !areas.Any())
                    {
                        return Ok(Enumerable.Empty<AreaDto>());
                    }

                    var cacheEntryOptions = new MemoryCacheEntryOptions()
                        .SetSlidingExpiration(TimeSpan.FromMinutes(5));
                    _memoryCache.Set(cacheKey, areas, cacheEntryOptions);
                }
                else
                {
                    _logger.LogInformation("Cache hit for areas in company {CompanyId}", companyId);
                }

                return Ok(_mapper.Map<IEnumerable<AreaDto>>(areas));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while retrieving areas for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Retrieves a specific area by its ID.
        /// </summary>
        /// <param name="companyId">The unique identifier of the company.</param>
        /// <param name="areaId">The unique identifier of the area.</param>
        /// <returns>The requested area.</returns>
        [HttpGet("{areaId}")]
        [ProducesResponseType(typeof(AreaDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<AreaDto>> GetArea(string companyId, int areaId)
        {
            try
            {
                var cacheKey = $"area_{companyId}_{areaId}";
                if (!_memoryCache.TryGetValue(cacheKey, out Area? area))
                {
                    _logger.LogInformation("Cache miss for area {AreaId} in company {CompanyId}", areaId, companyId);
                    var areas = await _areaService.Get(companyId, new[] { areaId });
                    area = areas.FirstOrDefault();

                    if (area == null)
                    {
                        return NotFound($"Area with ID {areaId} not found in company {companyId}.");
                    }

                    var cacheEntryOptions = new MemoryCacheEntryOptions()
                        .SetSlidingExpiration(TimeSpan.FromMinutes(5));
                    _memoryCache.Set(cacheKey, area, cacheEntryOptions);
                }
                else
                {
                    _logger.LogInformation("Cache hit for area {AreaId} in company {CompanyId}", areaId, companyId);
                }

                return Ok(_mapper.Map<AreaDto>(area));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while retrieving area {AreaId} for company {CompanyId}.", areaId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Creates a new area.
        /// </summary>
        /// <param name="companyId">The unique identifier of the company.</param>
        /// <param name="areaDto">The area data to create.</param>
        /// <returns>The newly created area.</returns>
        [HttpPost]
        [ProducesResponseType(typeof(AreaDto), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<AreaDto>> PostArea(string companyId, [FromBody] AreaDto areaDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var area = _mapper.Map<Area>(areaDto);
                var createdArea = await _areaService.Add(area);

                if (createdArea == null)
                {
                    return BadRequest("Failed to create the area.");
                }

                _memoryCache.Remove($"areas_{companyId}");
                var createdAreaDto = _mapper.Map<AreaDto>(createdArea);

                return CreatedAtAction(nameof(GetArea), new { companyId = companyId, areaId = createdArea.AreaId }, createdAreaDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while creating an area for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Updates an existing area.
        /// </summary>
        /// <param name="companyId">The unique identifier of the company.</param>
        /// <param name="areaId">The ID of the area to update.</param>
        /// <param name="areaDto">The updated area data.</param>
        /// <returns>The updated area.</returns>
        [HttpPut("{areaId}")]
        [ProducesResponseType(typeof(AreaDto), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<AreaDto>> PutArea(string companyId, int areaId, [FromBody] AreaDto areaDto)
        {
            if (areaId != areaDto.AreaId)
            {
                return BadRequest("Area ID mismatch.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var areas = await _areaService.Get(companyId, new[] { areaId });
                var areaToUpdate = areas.FirstOrDefault();

                if (areaToUpdate == null)
                {
                    return NotFound($"Area with ID {areaId} not found in company {companyId}.");
                }

                _mapper.Map(areaDto, areaToUpdate);

                var updatedArea = await _areaService.Update(areaToUpdate);

                _memoryCache.Remove($"areas_{companyId}");
                _memoryCache.Remove($"area_{companyId}_{areaId}");

                return Ok(_mapper.Map<AreaDto>(updatedArea));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while updating area {AreaId} for company {CompanyId}.", areaId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Deletes an area.
        /// </summary>
        /// <param name="companyId">The unique identifier of the company.</param>
        /// <param name="areaId">The ID of the area to delete.</param>
        /// <returns>An action result indicating success or failure.</returns>
        [HttpDelete("{areaId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> DeleteArea(string companyId, int areaId)
        {
            try
            {
                var areas = await _areaService.Get(companyId, new[] { areaId });
                var area = areas.FirstOrDefault();

                if (area == null)
                {
                    return NotFound($"Area with ID {areaId} not found.");
                }

                var isDeleted = await _areaService.Delete(area);

                if (!isDeleted)
                {
                    return BadRequest("Failed to delete the area.");
                }

                _memoryCache.Remove($"areas_{companyId}");
                _memoryCache.Remove($"area_{companyId}_{areaId}");

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while deleting area {AreaId} for company {CompanyId}.", areaId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}