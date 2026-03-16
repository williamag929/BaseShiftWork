using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
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
        private readonly IConfiguration _configuration;
        private readonly INotificationService _notificationService;

        /// <summary>
        /// Initializes a new instance of the <see cref="AuthController"/> class.
        /// </summary>
        public AuthController(
            ShiftWorkContext context,
            IMapper mapper,
            ILogger<AuthController> logger,
            ISandboxService sandboxService,
            IConfiguration configuration,
            INotificationService notificationService)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _sandboxService = sandboxService ?? throw new ArgumentNullException(nameof(sandboxService));
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
            _notificationService = notificationService ?? throw new ArgumentNullException(nameof(notificationService));
        }

        /// <summary>
        /// DEV ONLY — sends a test email to verify SMTP configuration.
        /// Requires a valid admin JWT.
        /// </summary>
        [HttpPost("test-email")]
        [Authorize]
        public async Task<IActionResult> TestEmail([FromBody] TestEmailRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.To))
                return BadRequest(new { message = "'to' email address is required." });

            var smtpHost = _configuration["Smtp:Host"];
            var smtpPort = _configuration["Smtp:Port"];
            var smtpUser = _configuration["Smtp:Username"];
            var smtpFrom = _configuration["Smtp:From"] ?? _configuration["Email:From"];

            _logger.LogInformation(
                "[test-email] SMTP config — Host={Host} Port={Port} User={User} From={From}",
                smtpHost ?? "(not set)", smtpPort ?? "(not set)",
                smtpUser ?? "(not set)", smtpFrom ?? "(not set)");

            await _notificationService.SendEmailAsync(
                request.To,
                request.Subject ?? "ShiftWork SMTP Test",
                $"<p>This is a test email sent at <strong>{DateTime.UtcNow:u}</strong>.</p>" +
                $"<p>SMTP Host: <code>{smtpHost}</code> | Port: <code>{smtpPort}</code></p>");

            return Ok(new
            {
                message = $"Test email dispatched to {request.To}. Check the API logs for any SMTP errors.",
                smtpHost,
                smtpPort,
                smtpFrom
            });
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
        /// 
        /// DISABLED: Self-registration is no longer allowed. Users must be invited by a company admin.
        /// </summary>
        [HttpPost("register")]
        [Authorize]
        [EnableRateLimiting("registration-limit")]
        [ProducesResponseType(typeof(CompanyRegistrationResponse), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(401)]
        [ProducesResponseType(403)]
        [ProducesResponseType(409)]
        [ProducesResponseType(429)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<CompanyRegistrationResponse>> Register(
            [FromBody] CompanyRegistrationRequest request)
        {
            // Self-registration is disabled. Users must be invited by a company admin.
            return StatusCode(403, new { message = "Self-registration is disabled. Please contact a company administrator to receive an invitation." });

            /* Original registration logic preserved for reference:
            if (string.IsNullOrEmpty(tokenUid))
                return Unauthorized("A valid Firebase Bearer token is required.");
            if (tokenUid != request.FirebaseUid)
                return BadRequest("FirebaseUid does not match the authenticated token.");

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
                _logger.LogInformation("{EventName} {Email}", FunnelEventNames.RegistrationStarted, request.UserEmail);

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
                    PhotoURL = string.Empty,
                    CompanyId = companyId,
                    EmailVerified = false
                };
                _context.CompanyUsers.Add(companyUser);
                await _context.SaveChangesAsync();

                // 3. Assign Owner role
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
                        AssignedBy = "system",
                        LastUpdatedBy = "system",
                        LastUpdatedAt = DateTime.UtcNow
                    });
                    await _context.SaveChangesAsync();
                }

                // 4. Seed sandbox data
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
            */
        }

        // ── API-based authentication (Firebase auth disabled for mobile) ──────────

        /// <summary>
        /// Authenticates a Person with email and password, returns a signed JWT.
        /// Firebase is NOT involved; use this from the mobile app when Firebase is disabled.
        /// </summary>
        [HttpPost("login")]
        [AllowAnonymous]
        [ProducesResponseType(200)]
        [ProducesResponseType(401)]
        public async Task<IActionResult> Login([FromBody] ApiLoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
                return BadRequest("Email and password are required.");

            var person = await _context.Persons.FirstOrDefaultAsync(p => p.Email == request.Email);
            if (person == null || string.IsNullOrEmpty(person.PasswordHash))
                return Unauthorized(new { message = "Invalid email or password." });

            var valid = BCrypt.Net.BCrypt.Verify(request.Password, person.PasswordHash);
            if (!valid)
                return Unauthorized(new { message = "Invalid email or password." });

            // Look up CompanyUser.Uid so the JWT subject matches what PermissionAuthorizationHandler
            // and UserRoleService use for role/permission lookups.
            var companyUser = await _context.CompanyUsers
                .FirstOrDefaultAsync(cu => cu.Email == person.Email && cu.CompanyId == person.CompanyId);

            // Auto-sync: if CompanyUserProfiles has roles but UserRoles doesn't, populate UserRoles
            if (companyUser != null)
            {
                var hasUserRoles = await _context.UserRoles
                    .AnyAsync(ur => ur.CompanyUserId == companyUser.CompanyUserId && ur.CompanyId == person.CompanyId);

                if (!hasUserRoles)
                {
                    var profileRoles = await _context.CompanyUserProfiles
                        .Where(p => p.CompanyUserId == companyUser.CompanyUserId
                                 && p.CompanyId == person.CompanyId
                                 && p.IsActive)
                        .Select(p => p.RoleId)
                        .ToListAsync();

                    if (profileRoles.Count > 0)
                    {
                        foreach (var roleId in profileRoles)
                        {
                            _context.UserRoles.Add(new UserRole
                            {
                                CompanyUserId = companyUser.CompanyUserId,
                                RoleId = roleId,
                                CompanyId = person.CompanyId
                            });
                        }
                        await _context.SaveChangesAsync();
                        _logger.LogInformation("Auto-synced {Count} role(s) to UserRoles for {Email} on login",
                            profileRoles.Count, person.Email);
                    }
                }
            }

            var token = GenerateApiJwt(person, companyUser?.Uid);
            _logger.LogInformation("API login successful for {Email}", person.Email);

            return Ok(new
            {
                token,
                personId = person.PersonId,
                companyId = person.CompanyId,
                email = person.Email,
                name = person.Name,
                photoUrl = person.PhotoUrl,
            });
        }

        /// <summary>
        /// Sets or updates the API password for a Person (BCrypt hashed).
        /// Requires an authenticated session (Firebase or API JWT).
        /// </summary>
        [HttpPost("set-password")]
        [Authorize]
        public async Task<IActionResult> SetPassword([FromBody] SetPasswordRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
                return BadRequest("Password must be at least 6 characters.");

            var person = await _context.Persons.FindAsync(request.PersonId);
            if (person == null)
                return NotFound("Person not found.");

            person.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }

        // ── Helpers ──────────────────────────────────────────────────────────

        /// <summary>
        /// Activates an employee invite and sets their mobile login password.
        /// Replaces the Firebase-based complete-invite flow.
        /// Called by the mobile app when the employee taps the invite link.
        /// Anonymous — no existing auth session required.
        /// </summary>
        [HttpPost("accept-invite")]
        [AllowAnonymous]
        [ProducesResponseType(200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        public async Task<IActionResult> AcceptInvite([FromBody] AcceptInviteRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Token) ||
                string.IsNullOrWhiteSpace(request.Password) ||
                request.Password.Length < 6)
                return BadRequest("A valid invite token and a password of at least 6 characters are required.");

            // Find the pending CompanyUser by token (Uid = "invite_{guid}")
            var companyUser = await _context.CompanyUsers
                .FirstOrDefaultAsync(u => u.Uid == request.Token && u.CompanyId == request.CompanyId);

            if (companyUser == null)
                return NotFound(new { message = "Invalid or expired invite token." });

            // Email must match what was on the invite
            if (!string.Equals(companyUser.Email, request.Email, StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Email address does not match the invite." });

            // Find the Person record
            var person = await _context.Persons
                .FirstOrDefaultAsync(p => p.PersonId == request.PersonId && p.CompanyId == request.CompanyId);

            if (person == null)
                return NotFound(new { message = "Employee record not found." });

            // Set password and activate CompanyUser
            person.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            companyUser.Uid = $"api_{Guid.NewGuid():N}";   // stable non-invite UID
            companyUser.EmailVerified = true;
            companyUser.UpdatedAt = DateTime.UtcNow;

            // Sync roles from CompanyUserProfiles → UserRoles so permissions work immediately
            var profileRoles = await _context.CompanyUserProfiles
                .Where(p => p.CompanyUserId == companyUser.CompanyUserId
                         && p.CompanyId == request.CompanyId
                         && p.IsActive)
                .Select(p => p.RoleId)
                .ToListAsync();

            if (profileRoles.Count > 0)
            {
                // Remove any stale UserRoles for this CompanyUser
                var existingRoles = await _context.UserRoles
                    .Where(ur => ur.CompanyUserId == companyUser.CompanyUserId && ur.CompanyId == request.CompanyId)
                    .ToListAsync();
                if (existingRoles.Count > 0)
                    _context.UserRoles.RemoveRange(existingRoles);

                foreach (var roleId in profileRoles)
                {
                    _context.UserRoles.Add(new UserRole
                    {
                        CompanyUserId = companyUser.CompanyUserId,
                        RoleId = roleId,
                        CompanyId = request.CompanyId
                    });
                }
            }

            await _context.SaveChangesAsync();

            // Issue a JWT so the user is immediately logged in after accepting.
            // Pass the new CompanyUser.Uid as subject so all Uid-based auth lookups work.
            var token = GenerateApiJwt(person, companyUser.Uid);
            _logger.LogInformation("Invite accepted: PersonId={PersonId}, CompanyId={CompanyId}, Roles={Roles}",
                person.PersonId, person.CompanyId, string.Join(",", profileRoles));

            return Ok(new
            {
                token,
                personId = person.PersonId,
                companyId = person.CompanyId,
                email = person.Email,
                name = person.Name,
                photoUrl = person.PhotoUrl,
            });
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        /// <summary>
        /// Generates an API JWT. Pass <paramref name="companyUserUid"/> so the token subject
        /// matches <c>CompanyUser.Uid</c>, which is required by PermissionAuthorizationHandler
        /// and UserRoleService. Falls back to personId when no CompanyUser record exists.
        /// </summary>
        private string GenerateApiJwt(Person person, string? companyUserUid = null)
        {
            var jwtSecret = _configuration["JwtSettings:SecretKey"]
                ?? Environment.GetEnvironmentVariable("JWT_SECRET_KEY")
                ?? "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_KEY_AT_LEAST_32_CHARS_LONG";

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            int expirationDays = int.TryParse(_configuration["JwtSettings:ExpirationDays"], out var d) ? d : 30;

            // Use CompanyUser.Uid as subject so PermissionAuthorizationHandler and
            // UserRoleService can resolve the CompanyUser record from the JWT.
            var subject = companyUserUid ?? person.PersonId.ToString();

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, subject),
                new Claim(ClaimTypes.Email, person.Email),
                new Claim(ClaimTypes.Name, person.Email),
                new Claim("companyId", person.CompanyId),
                new Claim("personId", person.PersonId.ToString()),
            };

            var token = new JwtSecurityToken(
                issuer: "shiftwork-api",
                audience: "shiftwork-mobile",
                claims: claims,
                expires: DateTime.UtcNow.AddDays(expirationDays),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }

        // ── Request DTOs (local to avoid cluttering the DTOs folder) ─────────────────

    public record ApiLoginRequest(string Email, string Password);
    public record SetPasswordRequest(int PersonId, string Password);
    public record TestEmailRequest(string To, string? Subject);

    /// <summary>
    /// Payload for the accept-invite endpoint (no Firebase required).
    /// The token + companyId + personId come from the invite URL query params.
    /// </summary>
    public record AcceptInviteRequest(
        string Token,
        string CompanyId,
        int PersonId,
        string Email,
        string Password
    );
}