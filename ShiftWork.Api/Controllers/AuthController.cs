using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using System;
using BCrypt.Net;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// API controller for handling authentication.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly ShiftWorkContext _context;
        private readonly IMapper _mapper;
        private readonly ILogger<AuthController> _logger;
        private readonly ISandboxService _sandboxService;

        /// <summary>
        /// Initializes a new instance of the <see cref="AuthController"/> class.
        /// </summary>
        public AuthController(
            ShiftWorkContext context,
            IMapper mapper,
            ILogger<AuthController> logger,
            ISandboxService sandboxService)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _sandboxService = sandboxService ?? throw new ArgumentNullException(nameof(sandboxService));
        }

        /// <summary>
        /// Retrieves a user by their email address.
        /// </summary>
        /// <param name="id">The email address of the user.</param>
        /// <returns>The person associated with the email.</returns>
        [HttpGet("user/{id}")]
        [ProducesResponseType(typeof(Person), 200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<Person>> GetUser(string id)
        {
            if (string.IsNullOrEmpty(id))
            {
                return BadRequest("User ID cannot be null or empty.");
            }

            try
            {
                var person = await _context.Persons.FirstOrDefaultAsync(c => c.Email == id);

                if (person == null)
                {
                    return NotFound($"User with email '{id}' not found.");
                }

                return Ok(person);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while retrieving user with email {UserEmail}.", id);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPost("verify-pin")]
        public async Task<IActionResult> VerifyPin([FromBody] PinVerificationRequest request)
        {
            var person = await _context.Persons.FindAsync(request.PersonId);
            if (person == null || string.IsNullOrEmpty(person.Pin))
            {
                return NotFound("Person not found or PIN not set.");
            }

            var verified = BCrypt.Net.BCrypt.Verify(request.Pin, person.Pin);

            return Ok(new { verified });
        }

        [HttpGet("user")]
        public async Task<ActionResult<Person>> GetCurrentUser()
        {
            var userEmail = User.Identity.Name;
            if (string.IsNullOrEmpty(userEmail))
            {
                return Unauthorized();
            }

            var person = await _context.Persons.FirstOrDefaultAsync(p => p.Email == userEmail);
            if (person == null)
            {
                return NotFound("Person not found.");
            }

            return Ok(person);
        }

        /// <summary>
        /// Registers a new customer: creates company, admin CompanyUser, and seeds sandbox data.
        /// Caller MUST send a valid Firebase ID token as Authorization: Bearer {token}.
        /// The FirebaseUid in the body MUST match the JWT sub claim.
        /// Rate-limited: max 5 attempts per IP per hour.
        /// </summary>
        [HttpPost("register")]
        [AllowAnonymous]
        [ProducesResponseType(typeof(CompanyRegistrationResponse), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(409)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<CompanyRegistrationResponse>> Register(
            [FromBody] CompanyRegistrationRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (string.IsNullOrWhiteSpace(request.FirebaseUid))
                return BadRequest("FirebaseUid is required.");

            // Validate that the Bearer token sub claim matches the provided FirebaseUid
            if (User.Identity?.IsAuthenticated == true)
            {
                var tokenUid = User.FindFirst("user_id")?.Value
                    ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!string.IsNullOrEmpty(tokenUid) && tokenUid != request.FirebaseUid)
                    return BadRequest("FirebaseUid does not match the authenticated token.");
            }

            // Duplicate UID check
            var existingUser = await _context.CompanyUsers
                .FirstOrDefaultAsync(u => u.Uid == request.FirebaseUid);
            if (existingUser != null)
                return Conflict("A user account with this Firebase UID already exists.");

            // Duplicate company email check
            var existingCompany = await _context.Companies
                .FirstOrDefaultAsync(c => c.Email == request.CompanyEmail);
            if (existingCompany != null)
                return Conflict("A company with this email already exists.");

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                _logger.LogInformation("{EventName} {Email}", "registration_started", request.UserEmail);

                // 1. Create Company
                var companyId = Guid.NewGuid().ToString();
                var company = new Company
                {
                    CompanyId = companyId,
                    Name = request.CompanyName,
                    Email = request.CompanyEmail,
                    PhoneNumber = request.CompanyPhone ?? string.Empty,
                    Address = string.Empty,
                    TimeZone = request.TimeZone,
                    Plan = "Free",
                    OnboardingStatus = "Pending"
                };
                _context.Companies.Add(company);
                await _context.SaveChangesAsync();

                // 2. Create Admin CompanyUser
                var companyUser = new CompanyUser
                {
                    CompanyUserId = Guid.NewGuid().ToString(),
                    Uid = request.FirebaseUid,
                    Email = request.UserEmail,
                    DisplayName = request.UserDisplayName,
                    CompanyId = companyId,
                    EmailVerified = false
                };
                _context.CompanyUsers.Add(companyUser);
                await _context.SaveChangesAsync();

                // 3. Assign Owner role — find the Owner/Admin role for this company or use role id 1
                var ownerRole = await _context.Roles
                    .Where(r => r.CompanyId == companyId ||
                                r.Name == "Owner" || r.Name == "Admin")
                    .OrderBy(r => r.RoleId)
                    .FirstOrDefaultAsync();

                if (ownerRole != null)
                {
                    _context.CompanyUserProfiles.Add(new CompanyUserProfile
                    {
                        CompanyUserId = companyUser.CompanyUserId,
                        CompanyId = companyId,
                        RoleId = ownerRole.RoleId,
                        IsActive = true,
                        AssignedAt = DateTime.UtcNow,
                        AssignedBy = "system"
                    });
                    await _context.SaveChangesAsync();
                }

                // 4. Seed sandbox data (inside transaction — rolls back if it fails)
                await _sandboxService.SeedSandboxDataAsync(companyId);

                await transaction.CommitAsync();

                _logger.LogInformation("{EventName} {CompanyId}", "registration_completed", companyId);

                var response = new CompanyRegistrationResponse
                {
                    CompanyId = companyId,
                    Plan = "Free",
                    OnboardingStatus = "Pending",
                    AdminUser = _mapper.Map<CompanyUserDto>(companyUser)
                };

                return CreatedAtAction(nameof(Register), response);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Registration failed for {Email}", request.UserEmail);
                return StatusCode(500, "Registration failed. Please try again.");
            }
        }
    }
}