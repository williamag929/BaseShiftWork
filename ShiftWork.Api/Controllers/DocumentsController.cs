using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
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
    [Route("api/companies/{companyId}/documents")]
    [Authorize]
    public class DocumentsController : ControllerBase
    {
        private readonly IDocumentService _documents;
        private readonly ILogger<DocumentsController> _logger;

        public DocumentsController(IDocumentService documents, ILogger<DocumentsController> logger)
        {
            _documents = documents;
            _logger = logger;
        }

        [HttpGet]
        [Authorize(Policy = "documents.read")]
        public async Task<ActionResult<IEnumerable<DocumentDto>>> GetDocuments(
            string companyId,
            [FromQuery] int? locationId = null,
            [FromQuery] string? type = null,
            [FromQuery] string? search = null)
        {
            try
            {
                var personId = GetPersonId();
                var docs = await _documents.GetDocumentsAsync(companyId, personId, locationId, type, search);
                return Ok(docs.Select(ToDto));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting documents for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("{documentId:guid}")]
        [Authorize(Policy = "documents.read")]
        public async Task<ActionResult<DocumentDetailDto>> GetDocument(string companyId, Guid documentId)
        {
            try
            {
                var personId = GetPersonId();
                var result = await _documents.GetByIdAsync(documentId, companyId, personId);
                if (result == null) return NotFound();

                var (doc, presignedUrl) = result.Value;
                var dto = ToDetailDto(doc, presignedUrl);
                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting document {DocumentId}", documentId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPost("initiate-upload")]
        [Authorize(Policy = "documents.upload")]
        public async Task<ActionResult<InitiateUploadResponseDto>> InitiateUpload(
            string companyId,
            [FromBody] UploadDocumentDto dto)
        {
            try
            {
                var personId = GetPersonId();
                var document = new Document
                {
                    Title = dto.Title,
                    Description = dto.Description,
                    Type = dto.Type,
                    LocationId = dto.LocationId,
                    Version = dto.Version,
                    Tags = dto.Tags != null ? JsonSerializer.Serialize(dto.Tags) : null,
                    AccessLevel = dto.AccessLevel,
                    AllowedRoleIds = dto.AllowedRoleIds != null ? JsonSerializer.Serialize(dto.AllowedRoleIds) : null,
                    MimeType = dto.MimeType,
                    FileSize = dto.FileSize,
                    UploadedByPersonId = personId
                };

                var result = await _documents.InitiateUploadAsync(companyId, document);
                return Ok(new InitiateUploadResponseDto
                {
                    DocumentId = result.DocumentId,
                    PresignedUploadUrl = result.PresignedUploadUrl,
                    S3Key = result.S3Key
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initiating upload for {CompanyId}", companyId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPost("{documentId:guid}/confirm-upload")]
        [Authorize(Policy = "documents.upload")]
        public async Task<ActionResult<DocumentDto>> ConfirmUpload(string companyId, Guid documentId)
        {
            try
            {
                var confirmed = await _documents.ConfirmUploadAsync(documentId, companyId);
                if (confirmed == null) return NotFound();

                return Ok(ToDto(confirmed));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error confirming upload for document {DocumentId}", documentId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPut("{documentId:guid}")]
        [Authorize(Policy = "documents.upload")]
        public async Task<ActionResult<DocumentDto>> UpdateDocument(
            string companyId,
            Guid documentId,
            [FromBody] UpdateDocumentDto dto)
        {
            try
            {
                var updates = new Document
                {
                    Title = dto.Title,
                    Description = dto.Description,
                    Type = dto.Type,
                    LocationId = dto.LocationId,
                    Version = dto.Version,
                    Tags = dto.Tags != null ? JsonSerializer.Serialize(dto.Tags) : null,
                    AccessLevel = dto.AccessLevel,
                    AllowedRoleIds = dto.AllowedRoleIds != null ? JsonSerializer.Serialize(dto.AllowedRoleIds) : null
                };

                var updated = await _documents.UpdateAsync(documentId, companyId, updates);
                if (updated == null) return NotFound();

                return Ok(ToDto(updated));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating document {DocumentId}", documentId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpDelete("{documentId:guid}")]
        [Authorize(Policy = "documents.delete")]
        public async Task<IActionResult> ArchiveDocument(string companyId, Guid documentId)
        {
            try
            {
                var archived = await _documents.ArchiveAsync(documentId, companyId);
                return archived ? NoContent() : NotFound();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error archiving document {DocumentId}", documentId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("{documentId:guid}/reads")]
        [Authorize(Policy = "documents.manage")]
        public async Task<ActionResult<IEnumerable<DocumentReadLogDto>>> GetReadLogs(string companyId, Guid documentId)
        {
            try
            {
                var logs = await _documents.GetReadLogsAsync(documentId, companyId);
                return Ok(logs.Select(l => new DocumentReadLogDto
                {
                    PersonId = l.PersonId,
                    PersonName = l.Person?.Name ?? "",
                    ReadAt = l.ReadAt
                }));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting read logs for document {DocumentId}", documentId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        private int GetPersonId()
        {
            var value = User.FindFirstValue("personId");
            return int.TryParse(value, out var id) ? id : 0;
        }

        private static DocumentDto ToDto(Document d)
        {
            return new DocumentDto
            {
                DocumentId = d.DocumentId,
                CompanyId = d.CompanyId,
                LocationId = d.LocationId,
                Title = d.Title,
                Description = d.Description,
                Type = d.Type,
                MimeType = d.MimeType,
                FileSize = d.FileSize,
                Version = d.Version,
                Tags = DeserializeStringList(d.Tags),
                AccessLevel = d.AccessLevel,
                Status = d.Status,
                UploadedByName = d.UploadedBy?.Name ?? "",
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt
            };
        }

        private static DocumentDetailDto ToDetailDto(Document d, string presignedUrl)
        {
            return new DocumentDetailDto
            {
                DocumentId = d.DocumentId,
                CompanyId = d.CompanyId,
                LocationId = d.LocationId,
                Title = d.Title,
                Description = d.Description,
                Type = d.Type,
                MimeType = d.MimeType,
                FileSize = d.FileSize,
                Version = d.Version,
                Tags = DeserializeStringList(d.Tags),
                AccessLevel = d.AccessLevel,
                Status = d.Status,
                UploadedByName = d.UploadedBy?.Name ?? "",
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt,
                PresignedUrl = presignedUrl,
                TotalReads = d.ReadLogs?.Count ?? 0
            };
        }

        private static List<string>? DeserializeStringList(string? json)
        {
            if (string.IsNullOrEmpty(json)) return null;
            try { return JsonSerializer.Deserialize<List<string>>(json); }
            catch { return null; }
        }
    }
}
