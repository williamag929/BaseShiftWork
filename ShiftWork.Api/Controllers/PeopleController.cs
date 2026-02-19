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
        private readonly ICompanyUserService _companyUserService;
        private readonly ICompanyUserProfileService _profileService;
        private readonly IMapper _mapper;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<PeopleController> _logger;
        private readonly IWebhookService _webhookService;
        private readonly INotificationService _notificationService;

        /// <summary>
        /// Initializes a new instance of the <see cref="PeopleController"/> class.
        /// </summary>
        public PeopleController(
            IPeopleService peopleService, 
            IShiftEventService shiftEventService, 
            ICompanyUserService companyUserService,
            ICompanyUserProfileService profileService,
            IMapper mapper, 
            IMemoryCache memoryCache, 
            ILogger<PeopleController> logger, 
            IWebhookService webhookService,
            INotificationService notificationService)
        {
            _peopleService = peopleService ?? throw new ArgumentNullException(nameof(peopleService));
            _shiftEventService = shiftEventService ?? throw new ArgumentNullException(nameof(shiftEventService));
            _companyUserService = companyUserService ?? throw new ArgumentNullException(nameof(companyUserService));
            _profileService = profileService ?? throw new ArgumentNullException(nameof(profileService));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _memoryCache = memoryCache ?? throw new ArgumentNullException(nameof(memoryCache));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _webhookService = webhookService ?? throw new ArgumentNullException(nameof(webhookService));
            _notificationService = notificationService ?? throw new ArgumentNullException(nameof(notificationService));
        }

        /// <summary>
        /// Retrieves all people for a company.
        /// </summary>
        [HttpGet]
        [Authorize(Policy = "people.read")]
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
        [Authorize(Policy = "people.read")]
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
        [Authorize(Policy = "people.read")]
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
        [Authorize(Policy = "people.create")]
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
        [Authorize(Policy = "people.update")]
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
        [Authorize(Policy = "people.delete")]
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
        [Authorize(Policy = "people.update")]
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
        [Authorize(Policy = "people.read")]
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
        [Authorize(Policy = "people.update")]
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
        [Authorize(Policy = "people.read")]
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

        /// <summary>
        /// Sends app invite to an existing employee. Creates pending CompanyUser.
        /// </summary>
        [HttpPost("{personId}/send-invite")]
        [ProducesResponseType(typeof(SendInviteResponse), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<SendInviteResponse>> SendInvite(string companyId, int personId, [FromBody] SendInviteRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                // Get existing Person
                var person = await _peopleService.Get(companyId, personId);
                if (person == null || person.CompanyId != companyId)
                {
                    return NotFound($"Person with ID {personId} not found.");
                }

                if (string.IsNullOrEmpty(person.Email))
                {
                    return BadRequest("Employee must have an email address to receive app invite.");
                }

                // Check if already has CompanyUser
                var existingUsers = await _companyUserService.GetAllByCompanyIdAsync(companyId);
                var existingUser = existingUsers?.FirstOrDefault(u => u.Email == person.Email);
                
                if (existingUser != null && !existingUser.Uid.StartsWith("invite_"))
                {
                    return BadRequest("Employee already has app access.");
                }

                // Generate invite token
                var inviteToken = $"invite_{Guid.NewGuid():N}";
                var inviteUrl = request.InviteUrl ?? "https://app.joblogsmart.com/accept-invite";
                
                // URL encode parameters for safety
                var encodedEmail = System.Web.HttpUtility.UrlEncode(person.Email);
                var encodedName = System.Web.HttpUtility.UrlEncode(person.Name);
                var encodedCompany = System.Web.HttpUtility.UrlEncode(companyId); // TODO: Get actual company name
                
                var fullInviteUrl = $"{inviteUrl}?token={inviteToken}&companyId={companyId}&personId={personId}&email={encodedEmail}&name={encodedName}";

                // Create or update CompanyUser with invite token as temporary UID
                CompanyUser companyUser;
                if (existingUser != null)
                {
                    // Update existing pending invite
                    existingUser.Uid = inviteToken;
                    existingUser.UpdatedAt = DateTime.UtcNow;
                    companyUser = await _companyUserService.UpdateAsync(existingUser.Uid, existingUser);
                }
                else
                {
                    // Create new CompanyUser with invite token
                    companyUser = new CompanyUser
                    {
                        CompanyUserId = Guid.NewGuid().ToString(),
                        Uid = inviteToken, // Temporary UID = invite token
                        Email = person.Email,
                        DisplayName = person.Name,
                        CompanyId = companyId,
                        EmailVerified = false
                    };
                    companyUser = await _companyUserService.CreateAsync(companyUser);
                }

                // Store pending roles in CompanyUserProfiles
                var assignedBy = User?.Identity?.Name ?? "Admin";
                foreach (var roleId in request.RoleIds)
                {
                    await _profileService.AssignRoleToUser(
                        companyId,
                        companyUser.CompanyUserId,
                        roleId,
                        personId,
                        assignedBy
                    );
                }

                // Send email invitation
                var emailSubject = "You've been invited to JobLogSmart";
                var emailBody = $@"
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                            .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }}
                            .button {{ display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                            .footer {{ text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }}
                        </style>
                    </head>
                    <body>
                        <div class='container'>
                            <div class='header'>
                                <h1>Welcome to JobLogSmart!</h1>
                            </div>
                            <div class='content'>
                                <p>Hi {person.Name},</p>
                                <p>You've been invited to join your team on JobLogSmart. Accept your invitation to start managing your shifts and time tracking.</p>
                                <p style='text-align: center;'>
                                    <a href='{fullInviteUrl}' class='button'>Accept Invitation</a>
                                </p>
                                <p>Or copy and paste this link into your browser:</p>
                                <p style='word-break: break-all; color: #667eea;'>{fullInviteUrl}</p>
                                <p><strong>This invitation will expire in 7 days.</strong></p>
                                <p>If you have any questions, please contact us at support@joblogsmart.com</p>
                            </div>
                            <div class='footer'>
                                <p>&copy; 2026 JobLogSmart. All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                ";

                await _notificationService.SendEmailAsync(person.Email, emailSubject, emailBody);

                var response = new SendInviteResponse
                {
                    InviteToken = inviteToken,
                    InviteUrl = fullInviteUrl,
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                    PendingUser = _mapper.Map<CompanyUserDto>(companyUser)
                };

                _logger.LogInformation("Invite sent to PersonId={PersonId}, Email={Email}, Token={Token}", 
                    personId, person.Email, inviteToken);

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending invite to person {PersonId}.", personId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Completes invite after employee creates Firebase account.
        /// Updates CompanyUser with real Firebase UID.
        /// Requires Firebase JWT token in Authorization header.
        /// </summary>
        [HttpPost("complete-invite")]
        [ProducesResponseType(typeof(EmployeeUserResponse), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(401)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<EmployeeUserResponse>> CompleteInvite(string companyId, [FromBody] CompleteInviteRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                // Extract Firebase UID from JWT token
                var firebaseUid = User?.FindFirst("user_id")?.Value;
                var userEmail = User?.FindFirst("email")?.Value;

                if (string.IsNullOrEmpty(firebaseUid))
                {
                    return Unauthorized("Valid Firebase authentication required.");
                }

                // Find CompanyUser with invite token
                var existingUsers = await _companyUserService.GetAllByCompanyIdAsync(companyId);
                var pendingUser = existingUsers?.FirstOrDefault(u => u.Uid == request.InviteToken);

                if (pendingUser == null)
                {
                    return NotFound("Invalid or expired invite token.");
                }

                // Verify email matches
                if (pendingUser.Email != userEmail)
                {
                    return BadRequest("Email address does not match invite.");
                }

                // Get the Person record
                var person = await _peopleService.Get(companyId, request.PersonId);
                if (person == null || person.CompanyId != companyId)
                {
                    return NotFound($"Person with ID {request.PersonId} not found.");
                }

                // Update CompanyUser with real Firebase UID
                pendingUser.Uid = firebaseUid;
                pendingUser.EmailVerified = true;
                pendingUser.UpdatedAt = DateTime.UtcNow;
                var updatedUser = await _companyUserService.UpdateAsync(request.InviteToken, pendingUser);

                // Get all profiles for this user
                var profiles = await _profileService.GetProfiles(companyId, updatedUser.CompanyUserId);

                // Clear cache
                _memoryCache.Remove($"people_{companyId}");

                var response = new EmployeeUserResponse
                {
                    Person = _mapper.Map<PersonDto>(person),
                    CompanyUser = _mapper.Map<CompanyUserDto>(updatedUser),
                    Profiles = _mapper.Map<List<CompanyUserProfileDto>>(profiles.ToList())
                };

                _logger.LogInformation("Invite completed: PersonId={PersonId}, UID={Uid}, CompanyId={CompanyId}", 
                    request.PersonId, firebaseUid, companyId);

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error completing invite for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Gets invite/app access status for an employee
        /// </summary>
        [HttpGet("{personId}/invite-status")]
        [ProducesResponseType(typeof(InviteStatusResponse), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<InviteStatusResponse>> GetInviteStatus(string companyId, int personId)
        {
            try
            {
                var person = await _peopleService.Get(companyId, personId);
                if (person == null || person.CompanyId != companyId)
                {
                    return NotFound($"Person with ID {personId} not found.");
                }

                var response = new InviteStatusResponse
                {
                    HasAppAccess = false,
                    Status = "None"
                };

                if (string.IsNullOrEmpty(person.Email))
                {
                    return Ok(response);
                }

                // Check for CompanyUser
                var existingUsers = await _companyUserService.GetAllByCompanyIdAsync(companyId);
                var companyUser = existingUsers?.FirstOrDefault(u => u.Email == person.Email);

                if (companyUser != null)
                {
                    response.CompanyUser = _mapper.Map<CompanyUserDto>(companyUser);
                    
                    if (companyUser.Uid.StartsWith("invite_"))
                    {
                        response.Status = "Pending";
                        response.HasAppAccess = false;
                    }
                    else
                    {
                        response.Status = "Active";
                        response.HasAppAccess = true;
                        
                        // Get profiles
                        var profiles = await _profileService.GetProfiles(companyId, companyUser.CompanyUserId);
                        response.Profiles = _mapper.Map<List<CompanyUserProfileDto>>(profiles.ToList());
                    }
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invite status for person {PersonId}.", personId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// DEPRECATED: Use send-invite -> complete-invite flow instead.
        /// Registers a new user with employee profile. Creates Person, CompanyUser, and CompanyUserProfiles.
        /// Requires Firebase JWT token in Authorization header.
        /// </summary>
        [HttpPost("register-user")]
        [ProducesResponseType(typeof(EmployeeUserResponse), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(401)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<EmployeeUserResponse>> RegisterUser(string companyId, [FromBody] RegisterUserRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                // Extract Firebase UID from JWT token
                var firebaseUid = User?.FindFirst("user_id")?.Value;
                var userEmail = User?.FindFirst("email")?.Value ?? request.Email;
                var displayName = User?.FindFirst("name")?.Value ?? request.Name;

                if (string.IsNullOrEmpty(firebaseUid))
                {
                    return Unauthorized("Valid Firebase authentication required.");
                }

                // Check if CompanyUser already exists
                var existingUser = await _companyUserService.GetByUidAsync(firebaseUid);
                if (existingUser != null && existingUser.CompanyId == companyId)
                {
                    return BadRequest("User already registered for this company.");
                }

                // Create Person entity
                var person = new Person
                {
                    Name = request.Name,
                    Email = request.Email,
                    CompanyId = companyId,
                    PhoneNumber = request.PhoneNumber,
                    Status = "Active"
                };

                if (!string.IsNullOrEmpty(request.Pin))
                {
                    person.Pin = BCrypt.Net.BCrypt.HashPassword(request.Pin);
                }

                var createdPerson = await _peopleService.Add(person);

                // Create CompanyUser
                var companyUser = new CompanyUser
                {
                    CompanyUserId = Guid.NewGuid().ToString(),
                    Uid = firebaseUid,
                    Email = userEmail,
                    DisplayName = displayName,
                    CompanyId = companyId,
                    EmailVerified = true
                };

                var createdUser = await _companyUserService.CreateAsync(companyUser);

                // Create CompanyUserProfiles for each role
                var profiles = new List<CompanyUserProfile>();
                var assignedBy = User?.Identity?.Name ?? "System";

                foreach (var roleId in request.RoleIds)
                {
                    var profile = await _profileService.AssignRoleToUser(
                        companyId,
                        createdUser.CompanyUserId,
                        roleId,
                        createdPerson.PersonId,
                        assignedBy
                    );
                    profiles.Add(profile);
                }

                // Clear relevant caches
                _memoryCache.Remove($"people_{companyId}");

                // Map to response
                var response = new EmployeeUserResponse
                {
                    Person = _mapper.Map<PersonDto>(createdPerson),
                    CompanyUser = _mapper.Map<CompanyUserDto>(createdUser),
                    Profiles = _mapper.Map<List<CompanyUserProfileDto>>(profiles)
                };

                _logger.LogInformation("User registered: UID={Uid}, PersonId={PersonId}, CompanyId={CompanyId}", 
                    firebaseUid, createdPerson.PersonId, companyId);

                return CreatedAtAction(nameof(GetPerson), new { companyId, personId = createdPerson.PersonId }, response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error registering user for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Links an existing Person to a Firebase user account.
        /// Requires Firebase JWT token in Authorization header.
        /// </summary>
        [HttpPost("{personId}/link-user")]
        [ProducesResponseType(typeof(EmployeeUserResponse), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(401)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<EmployeeUserResponse>> LinkUserToPerson(string companyId, int personId, [FromBody] LinkUserToPersonRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                // Extract Firebase UID from JWT token
                var firebaseUid = User?.FindFirst("user_id")?.Value;
                var userEmail = User?.FindFirst("email")?.Value;
                var displayName = User?.FindFirst("name")?.Value;

                if (string.IsNullOrEmpty(firebaseUid))
                {
                    return Unauthorized("Valid Firebase authentication required.");
                }

                // Get existing Person
                var person = await _peopleService.Get(companyId, personId);
                if (person == null || person.CompanyId != companyId)
                {
                    return NotFound($"Person with ID {personId} not found.");
                }

                // Check if CompanyUser already exists
                var companyUser = await _companyUserService.GetByUidAsync(firebaseUid);
                if (companyUser == null)
                {
                    // Create new CompanyUser
                    companyUser = new CompanyUser
                    {
                        CompanyUserId = Guid.NewGuid().ToString(),
                        Uid = firebaseUid,
                        Email = userEmail ?? person.Email,
                        DisplayName = displayName ?? person.Name,
                        CompanyId = companyId,
                        EmailVerified = true
                    };
                    companyUser = await _companyUserService.CreateAsync(companyUser);
                }

                // Create CompanyUserProfiles linking to Person
                var profiles = new List<CompanyUserProfile>();
                var assignedBy = User?.Identity?.Name ?? "System";

                foreach (var roleId in request.RoleIds)
                {
                    var profile = await _profileService.AssignRoleToUser(
                        companyId,
                        companyUser.CompanyUserId,
                        roleId,
                        personId,
                        assignedBy
                    );
                    profiles.Add(profile);
                }

                var response = new EmployeeUserResponse
                {
                    Person = _mapper.Map<PersonDto>(person),
                    CompanyUser = _mapper.Map<CompanyUserDto>(companyUser),
                    Profiles = _mapper.Map<List<CompanyUserProfileDto>>(profiles)
                };

                _logger.LogInformation("Person linked to user: PersonId={PersonId}, UID={Uid}, CompanyId={CompanyId}", 
                    personId, firebaseUid, companyId);

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error linking person {PersonId} to user account.", personId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Admin endpoint: Creates employee with optional user account in one step.
        /// Does not require Firebase token - admin can pre-create accounts.
        /// </summary>
        [HttpPost("create-with-user")]
        [ProducesResponseType(typeof(EmployeeUserResponse), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<EmployeeUserResponse>> CreateEmployeeWithUser(string companyId, [FromBody] CreateEmployeeWithUserRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                // Create Person entity
                var person = new Person
                {
                    Name = request.Name,
                    Email = request.Email,
                    CompanyId = companyId,
                    PhoneNumber = request.PhoneNumber,
                    Status = "Active"
                };

                if (!string.IsNullOrEmpty(request.Pin))
                {
                    person.Pin = BCrypt.Net.BCrypt.HashPassword(request.Pin);
                }

                var createdPerson = await _peopleService.Add(person);

                CompanyUser? createdUser = null;
                var profiles = new List<CompanyUserProfile>();

                if (request.CreateUserAccount)
                {
                    // Create CompanyUser with temporary UID (will be replaced when user completes Firebase registration)
                    var tempUid = $"temp_{Guid.NewGuid()}";
                    var companyUser = new CompanyUser
                    {
                        CompanyUserId = Guid.NewGuid().ToString(),
                        Uid = tempUid,
                        Email = request.Email,
                        DisplayName = request.Name,
                        CompanyId = companyId,
                        EmailVerified = false
                    };

                    createdUser = await _companyUserService.CreateAsync(companyUser);

                    // Create CompanyUserProfiles for each role
                    var assignedBy = User?.Identity?.Name ?? "Admin";

                    foreach (var roleId in request.RoleIds)
                    {
                        var profile = await _profileService.AssignRoleToUser(
                            companyId,
                            createdUser.CompanyUserId,
                            roleId,
                            createdPerson.PersonId,
                            assignedBy
                        );
                        profiles.Add(profile);
                    }

                    // TODO: If request.SendInvite is true, send Firebase invite email
                    // This would require Firebase Admin SDK integration
                }

                // Clear relevant caches
                _memoryCache.Remove($"people_{companyId}");

                var response = new EmployeeUserResponse
                {
                    Person = _mapper.Map<PersonDto>(createdPerson),
                    CompanyUser = createdUser != null ? _mapper.Map<CompanyUserDto>(createdUser) : null,
                    Profiles = _mapper.Map<List<CompanyUserProfileDto>>(profiles)
                };

                // Trigger webhook for employee.created event
                try
                {
                    await _webhookService.SendWebhookAsync(WebhookEventType.EmployeeCreated, response.Person);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send webhook for employee.created event. PersonId: {PersonId}", createdPerson.PersonId);
                }

                _logger.LogInformation("Employee created with user account: PersonId={PersonId}, HasUser={HasUser}, CompanyId={CompanyId}", 
                    createdPerson.PersonId, request.CreateUserAccount, companyId);

                return CreatedAtAction(nameof(GetPerson), new { companyId, personId = createdPerson.PersonId }, response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating employee with user for company {CompanyId}.", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}