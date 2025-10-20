using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
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

        /// <summary>
        /// Initializes a new instance of the <see cref="AuthController"/> class.
        /// </summary>
        public AuthController(ShiftWorkContext context, IMapper mapper, ILogger<AuthController> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
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
    }
}