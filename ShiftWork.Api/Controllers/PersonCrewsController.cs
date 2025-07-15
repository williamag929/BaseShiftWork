using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// API controller for managing the association between people and crews.
    /// </summary>
    [ApiController]
    [Route("api/companies/{companyId}/people/{personId}/crews")]
    public class PersonCrewsController : ControllerBase
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<PersonCrewsController> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="PersonCrewsController"/> class.
        /// </summary>
        public PersonCrewsController(ShiftWorkContext context, ILogger<PersonCrewsController> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Retrieves all crews a person belongs to.
        /// </summary>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<Crew>), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<Crew>>> GetPersonCrews(string companyId, int personId)
        {
            try
            {
                if (!await _context.Persons.AnyAsync(p => p.PersonId == personId && p.CompanyId == companyId))
                    return NotFound($"Person with ID {personId} not found in company {companyId}.");

                var crews = await _context.PersonCrews
                    .Where(pc => pc.PersonId == personId)
                    .Select(pc => pc.Crew)
                    .ToListAsync();

                return Ok(crews);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving crews for person {PersonId} in company {CompanyId}.", personId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Removes a person from a crew.
        /// </summary>
        [HttpDelete("{crewId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> DeletePersonCrew(string companyId, int personId, int crewId)
        {
            try
            {
                if (!await _context.Crews.AnyAsync(c => c.CrewId == crewId && c.CompanyId == companyId))
                    return NotFound($"Crew with ID {crewId} not found in company {companyId}.");
                if (!await _context.Persons.AnyAsync(p => p.PersonId == personId && p.CompanyId == companyId))
                    return NotFound($"Person with ID {personId} not found in company {companyId}.");

                var personCrew = await _context.PersonCrews
                    .FirstOrDefaultAsync(pc => pc.PersonId == personId && pc.CrewId == crewId);
                if (personCrew == null) return NotFound($"Person {personId} is not assigned to crew {crewId}.");

                _context.PersonCrews.Remove(personCrew);
                await _context.SaveChangesAsync();
                return NoContent();
            } catch (Exception ex) {
                _logger.LogError(ex, "Error removing person {PersonId} from crew {CrewId} for company {CompanyId}.", personId, crewId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}