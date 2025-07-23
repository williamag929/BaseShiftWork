using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// API controller for managing crews.
    /// </summary>
    [ApiController]
    [Route("api/companies/{companyId}/[controller]")]
    public class CrewsController : ControllerBase
    {
        private readonly ShiftWorkContext _context;
        private readonly IMapper _mapper;
        private readonly ILogger<CrewsController> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="CrewsController"/> class.
        /// </summary>
        public CrewsController(ShiftWorkContext context, IMapper mapper, ILogger<CrewsController> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Retrieves all crews for a company.
        /// </summary>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<CrewDto>), 200)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<CrewDto>>> GetCrews(string companyId)
        {
            try
            {
                var crews = await _context.Crews
                    .Where(c => c.CompanyId == companyId)
                    .ToListAsync();
                return Ok(_mapper.Map<IEnumerable<CrewDto>>(crews));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving crews for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Retrieves a specific crew by its ID.
        /// </summary>
        [HttpGet("{crewId}")]
        [ProducesResponseType(typeof(CrewDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<CrewDto>> GetCrew(string companyId, int crewId)
        {
            try
            {
                var crew = await _context.Crews.FindAsync(crewId);
                if (crew == null || crew.CompanyId != companyId)
                {
                    return NotFound($"Crew with ID {crewId} not found.");
                }
                return Ok(_mapper.Map<CrewDto>(crew));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving crew {CrewId} for company {CompanyId}.", crewId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Creates a new crew.
        /// </summary>
        [HttpPost]
        [ProducesResponseType(typeof(CrewDto), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<CrewDto>> PostCrew(string companyId, [FromBody] CrewDto crewDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var crew = _mapper.Map<Crew>(crewDto);
                crew.CompanyId = companyId;
                _context.Crews.Add(crew);
                await _context.SaveChangesAsync();
                var createdCrewDto = _mapper.Map<CrewDto>(crew);
                return CreatedAtAction(nameof(GetCrew), new { companyId, crewId = crew.CrewId }, createdCrewDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating crew for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Updates an existing crew.
        /// </summary>
        [HttpPut("{crewId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> PutCrew(string companyId, int crewId, [FromBody] CrewDto crewDto)
        {
            if (crewId != crewDto.CrewId)
            {
                return BadRequest("Crew ID mismatch.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var crew = await _context.Crews.FindAsync(crewId);
                if (crew == null || crew.CompanyId != companyId)
                {
                    return NotFound($"Crew with ID {crewId} not found.");
                }

                _mapper.Map(crewDto, crew);
                _context.Entry(crew).State = EntityState.Modified;
                await _context.SaveChangesAsync();
                return Ok(_mapper.Map<CrewDto>(crew));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating crew {CrewId} for company {CompanyId}.", crewId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Deletes a crew by its ID.
        /// </summary>
        [HttpDelete("{crewId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> DeleteCrew(string companyId, int crewId)
        {
            try
            {
                var crew = await _context.Crews.FindAsync(crewId);
                if (crew == null || crew.CompanyId != companyId)
                {
                    return NotFound($"Crew with ID {crewId} not found.");
                }

                _context.Crews.Remove(crew);
                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting crew {CrewId} for company {CompanyId}.", crewId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Adds a person to a crew.
        /// </summary>
        [HttpPost("{crewId}/people/{personId}")]
        [ProducesResponseType(201)]
        [ProducesResponseType(404)]
        [ProducesResponseType(409)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> AddPersonToCrew(string companyId, int crewId, int personId)
        {
            try
            {
                var crewExistsTask = _context.Crews.AnyAsync(c => c.CrewId == crewId && c.CompanyId == companyId);
                var personExistsTask = _context.Persons.AnyAsync(p => p.PersonId == personId && p.CompanyId == companyId);
                var associationExistsTask = _context.PersonCrews.AnyAsync(pc => pc.CrewId == crewId && pc.PersonId == personId);

                await Task.WhenAll(crewExistsTask, personExistsTask, associationExistsTask);

                if (!crewExistsTask.Result)
                    return NotFound($"Crew with ID {crewId} not found in company {companyId}.");
                if (!personExistsTask.Result)
                    return NotFound($"Person with ID {personId} not found in company {companyId}.");
                if (associationExistsTask.Result)
                    return Conflict($"Person {personId} is already assigned to crew {crewId}.");

                _context.PersonCrews.Add(new PersonCrew { CrewId = crewId, PersonId = personId });
                await _context.SaveChangesAsync();
                return CreatedAtAction(nameof(PersonCrewsController.GetPersonCrews), "PersonCrews", new { companyId, personId }, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding person {PersonId} to crew {CrewId} for company {CompanyId}.", personId, crewId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}