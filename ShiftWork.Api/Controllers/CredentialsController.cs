using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/credentials")]
    [Authorize]
    public class CredentialsController : ControllerBase
    {
        private readonly ICredentialService _credentials;
        private readonly ILogger<CredentialsController> _logger;

        public CredentialsController(ICredentialService credentials, ILogger<CredentialsController> logger)
        {
            _credentials = credentials;
            _logger = logger;
        }

        [HttpGet]
        [Authorize(Policy = "credentials.read")]
        public async Task<ActionResult<IEnumerable<CredentialDto>>> GetCredentials(
            string companyId,
            [FromQuery] int? personId = null,
            [FromQuery] string? status = null)
        {
            try
            {
                var credentials = await _credentials.GetByCompanyAsync(companyId, personId, status);
                return Ok(credentials.Select(ToDto));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting credentials for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>Employee's own credentials — mobile calls with its own personId, same convention as GET shiftevents/person/{personId}.</summary>
        [HttpGet("person/{personId}")]
        [Authorize(Policy = "credentials.read")]
        public async Task<ActionResult<IEnumerable<CredentialDto>>> GetCredentialsByPerson(string companyId, int personId)
        {
            try
            {
                var credentials = await _credentials.GetByPersonAsync(companyId, personId);
                return Ok(credentials.Select(ToDto));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting credentials for person {PersonId}", personId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("expiring")]
        [Authorize(Policy = "credentials.track")]
        public async Task<ActionResult<ExpiringCredentialsSummaryDto>> GetExpiring(string companyId, [FromQuery] int withinDays = 30)
        {
            try
            {
                withinDays = Math.Clamp(withinDays, 1, 365);
                var (expired, expiringSoon) = await _credentials.GetExpiringAsync(companyId, withinDays);

                return Ok(new ExpiringCredentialsSummaryDto
                {
                    ExpiredCount = expired.Count,
                    ExpiringSoonCount = expiringSoon.Count,
                    Items = expired.Concat(expiringSoon).Select(ToDto).ToList()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting expiring credentials for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("{credentialId:guid}")]
        [Authorize(Policy = "credentials.read")]
        public async Task<ActionResult<CredentialDto>> GetCredential(string companyId, Guid credentialId)
        {
            try
            {
                var result = await _credentials.GetByIdAsync(credentialId, companyId);
                if (result == null) return NotFound();

                var (credential, presignedUrl) = result.Value;
                var dto = ToDto(credential);
                dto.DocumentViewUrl = presignedUrl;
                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting credential {CredentialId}", credentialId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPost]
        [Authorize(Policy = "credentials.create")]
        public async Task<ActionResult<CredentialDto>> CreateCredential(string companyId, [FromBody] CreateCredentialDto dto)
        {
            try
            {
                var credential = ToModel(dto);
                credential.CreatedByPersonId = GetPersonId();

                var created = await _credentials.CreateAsync(companyId, credential);
                return CreatedAtAction(nameof(GetCredential), new { companyId, credentialId = created.CredentialId }, ToDto(created));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating credential for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPost("initiate-upload")]
        [Authorize(Policy = "credentials.create")]
        public async Task<ActionResult<InitiateCredentialUploadResponseDto>> InitiateUpload(string companyId, [FromBody] CreateCredentialDto dto)
        {
            try
            {
                var credential = ToModel(dto);
                credential.CreatedByPersonId = GetPersonId();

                var result = await _credentials.InitiateUploadAsync(companyId, credential, dto.MimeType);
                return Ok(new InitiateCredentialUploadResponseDto
                {
                    CredentialId = result.CredentialId,
                    PresignedUploadUrl = result.PresignedUploadUrl,
                    S3Key = result.S3Key
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initiating credential upload for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPost("{credentialId:guid}/confirm-upload")]
        [Authorize(Policy = "credentials.create")]
        public async Task<ActionResult<CredentialDto>> ConfirmUpload(string companyId, Guid credentialId)
        {
            try
            {
                var confirmed = await _credentials.ConfirmUploadAsync(credentialId, companyId);
                if (confirmed == null) return NotFound();

                return Ok(ToDto(confirmed));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error confirming credential upload {CredentialId}", credentialId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPut("{credentialId:guid}")]
        [Authorize(Policy = "credentials.update")]
        public async Task<ActionResult<CredentialDto>> UpdateCredential(string companyId, Guid credentialId, [FromBody] UpdateCredentialDto dto)
        {
            try
            {
                var updates = new Credential
                {
                    Name = dto.Name,
                    Type = dto.Type,
                    IssuingAuthority = dto.IssuingAuthority,
                    CredentialNumber = dto.CredentialNumber,
                    IssueDate = dto.IssueDate,
                    ExpiryDate = dto.ExpiryDate,
                };

                var updated = await _credentials.UpdateAsync(credentialId, companyId, updates);
                if (updated == null) return NotFound();

                return Ok(ToDto(updated));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating credential {CredentialId}", credentialId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpDelete("{credentialId:guid}")]
        [Authorize(Policy = "credentials.delete")]
        public async Task<IActionResult> ArchiveCredential(string companyId, Guid credentialId)
        {
            try
            {
                var archived = await _credentials.ArchiveAsync(credentialId, companyId);
                return archived ? NoContent() : NotFound();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error archiving credential {CredentialId}", credentialId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        private int GetPersonId()
        {
            var value = User.FindFirstValue("personId");
            return int.TryParse(value, out var id) ? id : 0;
        }

        private static Credential ToModel(CreateCredentialDto dto) => new()
        {
            PersonId = dto.PersonId,
            Name = dto.Name,
            Type = dto.Type,
            IssuingAuthority = dto.IssuingAuthority,
            CredentialNumber = dto.CredentialNumber,
            IssueDate = dto.IssueDate,
            ExpiryDate = dto.ExpiryDate,
        };

        private static CredentialDto ToDto(Credential c)
        {
            return new CredentialDto
            {
                CredentialId = c.CredentialId,
                CompanyId = c.CompanyId,
                PersonId = c.PersonId,
                PersonName = c.Person?.Name ?? "",
                Name = c.Name,
                Type = c.Type,
                IssuingAuthority = c.IssuingAuthority,
                CredentialNumber = c.CredentialNumber,
                IssueDate = c.IssueDate,
                ExpiryDate = c.ExpiryDate,
                ExpiryStatus = ClassifyExpiry(c.ExpiryDate),
                HasDocument = !string.IsNullOrEmpty(c.DocumentUrl),
                Status = c.Status,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt,
            };
        }

        private static string ClassifyExpiry(DateTime expiryDate, int expiringSoonWithinDays = 30)
        {
            var today = DateTime.UtcNow.Date;
            if (expiryDate.Date < today) return "Expired";
            if (expiryDate.Date <= today.AddDays(expiringSoonWithinDays)) return "ExpiringSoon";
            return "Valid";
        }
    }
}
