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
    /// API controller for managing people.
    /// </summary>
    [ApiController]
    [Route("api/companies/{companyId}/[controller]")]
    public class PeopleController : ControllerBase
    {
        private readonly IPeopleService _peopleService;
        private readonly IMapper _mapper;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<PeopleController> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="PeopleController"/> class.
        /// </summary>
        public PeopleController(IPeopleService peopleService, IMapper mapper, IMemoryCache memoryCache, ILogger<PeopleController> logger)
        {
            _peopleService = peopleService ?? throw new ArgumentNullException(nameof(peopleService));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _memoryCache = memoryCache ?? throw new ArgumentNullException(nameof(memoryCache));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Retrieves all people for a company.
        /// </summary>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<PersonDto>), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<PersonDto>>> GetPeople(string companyId, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] string searchQuery = null)
        {
            //pagination added
            //filtering added
            try
            {
                var people = await _peopleService.GetAll(companyId, pageNumber, pageSize, searchQuery);

                if (people == null || !people.Any())
                {
                    return NotFound($"No people found for company {companyId}.");
                }

                return Ok(_mapper.Map<IEnumerable<PersonDto>>(people));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving people for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Retrieves a specific person by their ID.
        /// </summary>
        [HttpGet("{personId}")]
        [ProducesResponseType(typeof(PersonDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<PersonDto>> GetPerson(string companyId, int personId)
        {
            try
            {
                var cacheKey = $"person_{companyId}_{personId}";
                if (!_memoryCache.TryGetValue(cacheKey, out Person person))
                {
                    _logger.LogInformation("Cache miss for person {PersonId} in company {CompanyId}", personId, companyId);
                    person = await _peopleService.Get(companyId, personId);

                    if (person == null)
                    {
                        return NotFound($"Person with ID {personId} not found.");
                    }

                    var cacheEntryOptions = new MemoryCacheEntryOptions().SetSlidingExpiration(TimeSpan.FromMinutes(5));
                    _memoryCache.Set(cacheKey, person, cacheEntryOptions);
                }
                else
                {
                    _logger.LogInformation("Cache hit for person {PersonId} in company {CompanyId}", personId, companyId);
                }

                return Ok(_mapper.Map<PersonDto>(person));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving person {PersonId} for company {CompanyId}.", personId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Creates a new person.
        /// </summary>
        [HttpPost]
        [ProducesResponseType(typeof(PersonDto), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<PersonDto>> PostPerson(string companyId, [FromBody] PersonDto personDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var person = _mapper.Map<Person>(personDto);
                var createdPerson = await _peopleService.Add(person);

                if (createdPerson == null)
                {
                    return BadRequest("Failed to create person.");
                }

                _memoryCache.Remove($"people_{companyId}");
                var createdPersonDto = _mapper.Map<PersonDto>(createdPerson);

                return CreatedAtAction(nameof(GetPerson), new { companyId, personId = createdPerson.PersonId }, createdPersonDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating person for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Updates an existing person.
        /// </summary>
        [HttpPut("{personId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> PutPerson(string companyId, int personId, [FromBody] PersonDto personDto)
        {
            if (personId != personDto.PersonId)
            {
                return BadRequest("Person ID mismatch.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var person = _mapper.Map<Person>(personDto);
                var updatedPerson = await _peopleService.Update(person);

                if (updatedPerson == null)
                {
                    return NotFound($"Person with ID {personId} not found.");
                }

                _mapper.Map(personDto, updatedPerson);

                _memoryCache.Remove($"people_{companyId}");
                _memoryCache.Remove($"person_{companyId}_{personId}");

                return Ok(_mapper.Map<PersonDto>(updatedPerson));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating person {PersonId} for company {CompanyId}.", personId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Deletes a person by their ID.
        /// </summary>
        [HttpDelete("{personId}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> DeletePerson(string companyId, int personId)
        {
            try
            {
                var isDeleted = await _peopleService.Delete(companyId, personId);
                if (!isDeleted)
                {
                    return NotFound($"Person with ID {personId} not found.");
                }

                _memoryCache.Remove($"people_{companyId}");
                _memoryCache.Remove($"person_{companyId}_{personId}");

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting person {PersonId} for company {CompanyId}.", personId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Updates the status of a person.
        /// </summary>
        [HttpPut("{personId}/status")]
        [ProducesResponseType(typeof(PersonDto), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<PersonDto>> UpdatePersonStatus(string companyId, int personId, [FromBody] string status)
        {
            if (string.IsNullOrEmpty(status))
            {
                return BadRequest("Status cannot be empty.");
            }

            try
            {
                var person = await _peopleService.Get(companyId, personId);
                if (person == null)
                {
                    return NotFound($"Person with ID {personId} not found.");
                }

                var updatedPerson = await _peopleService.UpdatePersonStatus(personId, status);
                if (updatedPerson == null)
                {
                    return NotFound($"Person with ID {personId} not found.");
                }

                _memoryCache.Remove($"person_{companyId}_{personId}");
                var updatedPersonDto = _mapper.Map<PersonDto>(updatedPerson);

                return Ok(updatedPersonDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating status for person {PersonId} in company {CompanyId}.", personId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Retrieves the status of a person.
        /// </summary>
        [HttpGet("{personId}/status")]
        [ProducesResponseType(typeof(string), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<string>> GetPersonStatus(string companyId, int personId)
        {
            try
            {
                var status = await _peopleService.GetPersonStatus(personId);
                if (status == null)
                {
                    return NotFound($"Person with ID {personId} not found or status is not set.");
                }
                return Ok(status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving status for person {PersonId} in company {CompanyId}.", personId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}