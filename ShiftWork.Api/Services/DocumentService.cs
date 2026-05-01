using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public record InitiateUploadResult(Guid DocumentId, string PresignedUploadUrl, string S3Key);

    public interface IDocumentService
    {
        Task<List<Document>> GetDocumentsAsync(string companyId, int requestingPersonId, int? locationId = null, string? type = null, string? search = null);
        Task<(Document doc, string presignedUrl)?> GetByIdAsync(Guid documentId, string companyId, int requestingPersonId);
        Task<InitiateUploadResult> InitiateUploadAsync(string companyId, Document document);
        Task<Document?> ConfirmUploadAsync(Guid documentId, string companyId);
        Task<Document?> UpdateAsync(Guid documentId, string companyId, Document updates);
        Task<bool> ArchiveAsync(Guid documentId, string companyId);
        Task<List<DocumentReadLog>> GetReadLogsAsync(Guid documentId, string companyId);
    }

    public class DocumentService : IDocumentService
    {
        private readonly ShiftWorkContext _context;
        private readonly IAmazonS3 _s3;
        private readonly IConfiguration _configuration;
        private readonly ILogger<DocumentService> _logger;

        private string BucketName => _configuration["AWS_S3_BUCKET_NAME"] ?? "shiftwork-documents";

        public DocumentService(ShiftWorkContext context, IAmazonS3 s3, IConfiguration configuration, ILogger<DocumentService> logger)
        {
            _context = context;
            _s3 = s3;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<List<Document>> GetDocumentsAsync(string companyId, int requestingPersonId, int? locationId = null, string? type = null, string? search = null)
        {
            // Resolve caller's roles and current location assignments for access filtering
            var callerRoleIds = await GetPersonRoleIdsAsync(companyId, requestingPersonId);
            var callerLocationIds = await GetPersonLocationIdsAsync(companyId, requestingPersonId);

            // IsRoleAllowed deserializes JSON and cannot be translated to SQL.
            // Include all Restricted rows in the SQL query, then filter by role in memory.
            var query = _context.Documents
                .Where(d => d.CompanyId == companyId && d.Status == "Active")
                .Where(d =>
                    d.AccessLevel == "Public"
                    || (d.AccessLevel == "LocationOnly" && (d.LocationId == null || callerLocationIds.Contains(d.LocationId.Value)))
                    || d.AccessLevel == "Restricted");

            if (locationId.HasValue)
                query = query.Where(d => d.LocationId == null || d.LocationId == locationId.Value);

            if (!string.IsNullOrEmpty(type))
                query = query.Where(d => d.Type == type);

            if (!string.IsNullOrEmpty(search))
                query = query.Where(d => d.Title.Contains(search) || (d.Description != null && d.Description.Contains(search)));

            var docs = await query.OrderByDescending(d => d.UpdatedAt).ToListAsync();

            return docs
                .Where(d => d.AccessLevel != "Restricted" || IsRoleAllowed(d.AllowedRoleIds, callerRoleIds))
                .ToList();
        }

        public async Task<(Document doc, string presignedUrl)?> GetByIdAsync(Guid documentId, string companyId, int requestingPersonId)
        {
            var callerRoleIds = await GetPersonRoleIdsAsync(companyId, requestingPersonId);
            var callerLocationIds = await GetPersonLocationIdsAsync(companyId, requestingPersonId);

            var doc = await _context.Documents
                .FirstOrDefaultAsync(d => d.DocumentId == documentId && d.CompanyId == companyId && d.Status == "Active");

            if (doc == null) return null;

            if (!CanAccess(doc, callerRoleIds, callerLocationIds)) return null;

            var presignedUrl = GeneratePresignedGetUrl(doc.FileUrl);

            // Log read (one entry per person per document per day — lightweight)
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var alreadyLogged = await _context.DocumentReadLogs
                .AnyAsync(l => l.DocumentId == documentId && l.PersonId == requestingPersonId
                    && l.ReadAt.Date == DateTime.UtcNow.Date);

            if (!alreadyLogged)
            {
                _context.DocumentReadLogs.Add(new DocumentReadLog
                {
                    DocumentId = documentId,
                    PersonId = requestingPersonId,
                    ReadAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
                _logger.LogInformation("Document {DocumentId} opened by Person {PersonId} at Company {CompanyId}", documentId, requestingPersonId, companyId);
            }

            return (doc, presignedUrl);
        }

        public async Task<InitiateUploadResult> InitiateUploadAsync(string companyId, Document document)
        {
            var s3Key = $"documents/{companyId}/{Guid.NewGuid()}/{document.Title.Replace(" ", "_")}";

            document.CompanyId = companyId;
            document.FileUrl = s3Key;
            document.Status = "Draft";
            document.CreatedAt = DateTime.UtcNow;
            document.UpdatedAt = DateTime.UtcNow;

            _context.Documents.Add(document);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Document upload initiated: '{Title}' ({DocumentId}) type={Type} at Company {CompanyId}", document.Title, document.DocumentId, document.Type, companyId);

            var presignedUrl = GeneratePresignedPutUrl(s3Key, document.MimeType);

            return new InitiateUploadResult(document.DocumentId, presignedUrl, s3Key);
        }

        public async Task<Document?> ConfirmUploadAsync(Guid documentId, string companyId)
        {
            var doc = await _context.Documents
                .FirstOrDefaultAsync(d => d.DocumentId == documentId && d.CompanyId == companyId && d.Status == "Draft");

            if (doc == null) return null;

            doc.Status = "Active";
            doc.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Document {DocumentId} confirmed active at Company {CompanyId}", documentId, companyId);
            return doc;
        }

        public async Task<Document?> UpdateAsync(Guid documentId, string companyId, Document updates)
        {
            var doc = await _context.Documents
                .FirstOrDefaultAsync(d => d.DocumentId == documentId && d.CompanyId == companyId);

            if (doc == null) return null;

            doc.Title = updates.Title;
            doc.Description = updates.Description;
            doc.Type = updates.Type;
            doc.Version = updates.Version;
            doc.Tags = updates.Tags;
            doc.AccessLevel = updates.AccessLevel;
            doc.AllowedRoleIds = updates.AllowedRoleIds;
            doc.LocationId = updates.LocationId;
            doc.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return doc;
        }

        public async Task<bool> ArchiveAsync(Guid documentId, string companyId)
        {
            var doc = await _context.Documents
                .FirstOrDefaultAsync(d => d.DocumentId == documentId && d.CompanyId == companyId);

            if (doc == null) return false;

            doc.Status = "Archived";
            doc.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Document {DocumentId} archived at Company {CompanyId}", documentId, companyId);
            return true;
        }

        public async Task<List<DocumentReadLog>> GetReadLogsAsync(Guid documentId, string companyId)
        {
            var exists = await _context.Documents
                .AnyAsync(d => d.DocumentId == documentId && d.CompanyId == companyId);

            if (!exists) return new List<DocumentReadLog>();

            return await _context.DocumentReadLogs
                .Include(l => l.Person)
                .Where(l => l.DocumentId == documentId)
                .OrderByDescending(l => l.ReadAt)
                .ToListAsync();
        }

        private string GeneratePresignedGetUrl(string s3Key)
        {
            try
            {
                return _s3.GetPreSignedURL(new GetPreSignedUrlRequest
                {
                    BucketName = BucketName,
                    Key = s3Key,
                    Expires = DateTime.UtcNow.AddMinutes(15),
                    Verb = HttpVerb.GET
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to generate presigned GET URL for key {Key}", s3Key);
                return string.Empty;
            }
        }

        private string GeneratePresignedPutUrl(string s3Key, string contentType)
        {
            try
            {
                return _s3.GetPreSignedURL(new GetPreSignedUrlRequest
                {
                    BucketName = BucketName,
                    Key = s3Key,
                    Expires = DateTime.UtcNow.AddMinutes(15),
                    Verb = HttpVerb.PUT,
                    ContentType = contentType
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to generate presigned PUT URL for key {Key}", s3Key);
                return string.Empty;
            }
        }

        private static bool CanAccess(Document doc, List<int> callerRoleIds, List<int> callerLocationIds)
        {
            return doc.AccessLevel switch
            {
                "Public" => true,
                "LocationOnly" => doc.LocationId == null || callerLocationIds.Contains(doc.LocationId.Value),
                "Restricted" => IsRoleAllowed(doc.AllowedRoleIds, callerRoleIds),
                _ => false
            };
        }

        private static bool IsRoleAllowed(string? allowedRoleIdsJson, List<int> callerRoleIds)
        {
            if (string.IsNullOrEmpty(allowedRoleIdsJson)) return false;
            try
            {
                var allowed = JsonSerializer.Deserialize<List<int>>(allowedRoleIdsJson);
                return allowed != null && allowed.Any(id => callerRoleIds.Contains(id));
            }
            catch { return false; }
        }

        private async Task<List<int>> GetPersonRoleIdsAsync(string companyId, int personId)
        {
            return await _context.CompanyUserProfiles
                .Where(p => p.CompanyId == companyId && p.PersonId == personId)
                .Select(p => p.RoleId)
                .ToListAsync();
        }

        private async Task<List<int>> GetPersonLocationIdsAsync(string companyId, int personId)
        {
            return await _context.ScheduleShifts
                .Where(ss => ss.PersonId == personId
                    && _context.Schedules.Any(s => s.ScheduleId == ss.ScheduleId && s.CompanyId == companyId))
                .Select(ss => ss.LocationId)
                .Distinct()
                .ToListAsync();
        }
    }
}
