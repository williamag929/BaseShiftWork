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
using BCrypt.Net;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// API controller for managing people.
    /// </summary>
    [ApiController]
    [Route("api/companies/{companyId}/[controller]")]
    public class PeopleController : ControllerBase
    {
        public class UpdateStatusRequest { public string? Status { get; set; } }
        private readonly IPeopleService _peopleService;
        private readonly IShiftEventService _shiftEventService;
        private readonly IMapper _mapper;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<PeopleController> _logger;
        private readonly IWebhookService _webhookService;

        /// <summary>
        /// Initializes a new instance of the <see cref="PeopleController"/> class.
        /// </summary>
        public PeopleController(IPeopleService peopleService, IShiftEventService shiftEventService, IMapper mapper, IMemoryCache memoryCache, ILogger<PeopleController> logger, IWebhookService webhookService)
        {
            _peopleService = peopleService ?? throw new ArgumentNullException(nameof(peopleService));
            _shiftEventService = shiftEventService ?? throw new ArgumentNullException(nameof(shiftEventService));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _memoryCache = memoryCache ?? throw new ArgumentNullException(nameof(memoryCache));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _webhookService = webhookService ?? throw new ArgumentNullException(nameof(webhookService));
        }

        /// <summary>
        /// Retrieves all people for a company.
        /// </summary>
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<PersonDto>), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
    public async Task<ActionResult<IEnumerable<PersonDto>>> GetPeople(string companyId, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] string? searchQuery = null)
        {
            //pagination added
            //filtering added
            try
            {
                var people = await _peopleService.GetAll(companyId, pageNumber, pageSize, searchQuery ?? string.Empty);

                if (people == null || !people.Any())
                {
                    return NotFound($"No people found for company {companyId}.");
                }

                var autoClockOutTasks = people.Select(async person =>
                {
                    try
                    {
                        var didAutoClockOut = await _shiftEventService.EnsureAutoClockOutForPersonAsync(companyId, person.PersonId);
                        if (didAutoClockOut)
                        {
                            person.StatusShiftWork = "OffShift";
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Auto clock-out failed for person {PersonId} in company {CompanyId}.", person.PersonId, companyId);
                    }
                });
                await Task.WhenAll(autoClockOutTasks);

                return Ok(_mapper.Map<IEnumerable<PersonDto>>(people));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving people for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Retrieves people who have unpublished schedules in the given date range.
        /// </summary>
        [HttpGet("unpublished-schedules")]
        [ProducesResponseType(typeof(IEnumerable<UnpublishedSchedulePersonDto>), 200)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<IEnumerable<UnpublishedSchedulePersonDto>>> GetPeopleWithUnpublishedSchedules(
            string companyId,
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate)
        {
            try
            {
                var results = await _peopleService.GetPeopleWithUnpublishedSchedules(companyId, startDate, endDate);
                return Ok(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving people with unpublished schedules for company {CompanyId}.", companyId);
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
                if (!_memoryCache.TryGetValue(cacheKey, out Person? person))
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
                if (!string.IsNullOrEmpty(personDto.Pin))
                {
                    person.Pin = BCrypt.Net.BCrypt.HashPassword(personDto.Pin);
                }
                var createdPerson = await _peopleService.Add(person);

                if (createdPerson == null)
                {
                    return BadRequest("Failed to create person.");
                }

                _memoryCache.Remove($"people_{companyId}");
                var createdPersonDto = _mapper.Map<PersonDto>(createdPerson);

                // Trigger webhook for employee.created event (non-blocking with timeout)
                try
                {
                    await _webhookService.SendWebhookAsync(WebhookEventType.EmployeeCreated, createdPersonDto);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send webhook for employee.created event. PersonId: {PersonId}", createdPerson.PersonId);
                }

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
                if (!string.IsNullOrEmpty(personDto.Pin))
                {
                    person.Pin = BCrypt.Net.BCrypt.HashPassword(personDto.Pin);
                }
                var updatedPerson = await _peopleService.Update(person);

                if (updatedPerson == null)
                {
                    return NotFound($"Person with ID {personId} not found.");
                }

                _mapper.Map(personDto, updatedPerson);

                _memoryCache.Remove($"people_{companyId}");
                _memoryCache.Remove($"person_{companyId}_{personId}");

                var updatedPersonDto = _mapper.Map<PersonDto>(updatedPerson);

                // Trigger webhook for employee.updated event (non-blocking with timeout)
                try
                {
                    await _webhookService.SendWebhookAsync(WebhookEventType.EmployeeUpdated, updatedPersonDto);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send webhook for employee.updated event. PersonId: {PersonId}", personId);
                }

                return Ok(updatedPersonDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating person {PersonId} for company {CompanyId}.", personId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Partially updates a person (e.g., just photoUrl).
        /// </summary>
        [HttpPatch("{personId}")]
        [ProducesResponseType(typeof(PersonDto), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<PersonDto>> PatchPerson(string companyId, int personId, [FromBody] Dictionary<string, object> updates)
        {
            try
            {
                var person = await _peopleService.Get(companyId, personId);
                if (person == null)
                {
                    return NotFound($"Person with ID {personId} not found.");
                }

                // Apply only the fields that were sent
                foreach (var update in updates)
                {
                    var property = typeof(Person).GetProperty(update.Key, System.Reflection.BindingFlags.IgnoreCase | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                    if (property != null && property.CanWrite)
                    {
                        var value = update.Value?.ToString();
                        if (property.PropertyType == typeof(string))
                        {
                            property.SetValue(person, value);
                        }
                        else if (property.PropertyType == typeof(int) || property.PropertyType == typeof(int?))
                        {
                            if (int.TryParse(value, out int intValue))
                            {
                                property.SetValue(person, intValue);
                            }
                        }
                    }
                }

                var updatedPerson = await _peopleService.Update(person);
                if (updatedPerson == null)
                {
                    return NotFound($"Person with ID {personId} not found.");
                }

                _memoryCache.Remove($"people_{companyId}");
                _memoryCache.Remove($"person_{companyId}_{personId}");

                return Ok(_mapper.Map<PersonDto>(updatedPerson));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error partially updating person {PersonId} for company {CompanyId}.", personId, companyId);
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
        public async Task<ActionResult<PersonDto>> UpdatePersonStatus(string companyId, int personId, [FromBody] UpdateStatusRequest request)
        {
            var status = request?.Status;
            if (string.IsNullOrWhiteSpace(status))
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
                
                _memoryCache.Remove($"people_{companyId}");
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
                    // Return 204 No Content when no status is set, instead of 404
                    return NoContent();
                }
                return Ok(status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving status for person {PersonId} in company {CompanyId}.", personId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Updates the kiosk (ShiftWork) status of a person (OnShift/OffShift).
        /// </summary>
        [HttpPut("{personId}/status-shiftwork")]
        [ProducesResponseType(typeof(PersonDto), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<PersonDto>> UpdatePersonStatusShiftWork(string companyId, int personId, [FromBody] UpdateStatusRequest request)
        {
            var status = request?.Status;
            if (string.IsNullOrWhiteSpace(status))
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

                var updatedPerson = await _peopleService.UpdatePersonStatusShiftWork(personId, status);
                if (updatedPerson == null)
                {
                    return NotFound($"Person with ID {personId} not found.");
                }

                _memoryCache.Remove($"people_{companyId}");
                _memoryCache.Remove($"person_{companyId}_{personId}");
                var updatedPersonDto = _mapper.Map<PersonDto>(updatedPerson);

                return Ok(updatedPersonDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating ShiftWork status for person {PersonId} in company {CompanyId}.", personId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Retrieves the kiosk (ShiftWork) status of a person.
        /// </summary>
        [HttpGet("{personId}/status-shiftwork")]
        [ProducesResponseType(typeof(string), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<string>> GetPersonStatusShiftWork(string companyId, int personId)
        {
            try
            {
                await _shiftEventService.EnsureAutoClockOutForPersonAsync(companyId, personId);
                var status = await _peopleService.GetPersonStatusShiftWork(personId);
                if (status == null)
                {
                    // Return 204 No Content when no ShiftWork status is set, instead of 404
                    return NoContent();
                }
                return Ok(status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ShiftWork status for person {PersonId} in company {CompanyId}.", personId, companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}