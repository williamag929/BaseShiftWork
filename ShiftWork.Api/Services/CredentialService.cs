using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Amazon.S3;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public class CredentialService : ICredentialService
    {
        private readonly ShiftWorkContext _context;
        private readonly IAmazonS3 _s3;
        private readonly IConfiguration _configuration;
        private readonly ILogger<CredentialService> _logger;

        private string BucketName => _configuration["AWS_S3_BUCKET_NAME"] ?? "shiftwork-documents";

        public CredentialService(ShiftWorkContext context, IAmazonS3 s3, IConfiguration configuration, ILogger<CredentialService> logger)
        {
            _context = context;
            _s3 = s3;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<List<Credential>> GetByCompanyAsync(string companyId, int? personId = null, string? status = null)
        {
            var query = _context.Credentials
                .Include(c => c.Person)
                .Where(c => c.CompanyId == companyId);

            if (personId.HasValue)
            {
                query = query.Where(c => c.PersonId == personId.Value);
            }

            query = string.IsNullOrEmpty(status)
                ? query.Where(c => c.Status != "Archived")
                : query.Where(c => c.Status == status);

            return await query.OrderBy(c => c.ExpiryDate).ToListAsync();
        }

        public async Task<List<Credential>> GetByPersonAsync(string companyId, int personId)
        {
            return await _context.Credentials
                .Include(c => c.Person)
                .Where(c => c.CompanyId == companyId && c.PersonId == personId && c.Status != "Archived")
                .OrderBy(c => c.ExpiryDate)
                .ToListAsync();
        }

        public async Task<(List<Credential> Expired, List<Credential> ExpiringSoon)> GetExpiringAsync(string companyId, int withinDays = 30)
        {
            var today = DateTime.UtcNow.Date;
            var threshold = today.AddDays(withinDays);

            var candidates = await _context.Credentials
                .Include(c => c.Person)
                .Where(c => c.CompanyId == companyId && c.Status == "Active" && c.ExpiryDate <= threshold)
                .OrderBy(c => c.ExpiryDate)
                .ToListAsync();

            var expired = candidates.Where(c => c.ExpiryDate.Date < today).ToList();
            var expiringSoon = candidates.Where(c => c.ExpiryDate.Date >= today).ToList();

            return (expired, expiringSoon);
        }

        public async Task<(Credential Credential, string? PresignedUrl)?> GetByIdAsync(Guid credentialId, string companyId)
        {
            var credential = await _context.Credentials
                .Include(c => c.Person)
                .FirstOrDefaultAsync(c => c.CredentialId == credentialId && c.CompanyId == companyId);

            if (credential == null)
            {
                return null;
            }

            string? presignedUrl = null;
            if (!string.IsNullOrEmpty(credential.DocumentUrl))
            {
                presignedUrl = S3PresignHelper.GeneratePresignedGetUrl(_s3, _logger, BucketName, credential.DocumentUrl, TimeSpan.FromMinutes(15));
            }

            return (credential, presignedUrl);
        }

        public async Task<Credential> CreateAsync(string companyId, Credential credential)
        {
            credential.CompanyId = companyId;
            credential.Status = "Active";
            credential.CreatedAt = DateTime.UtcNow;

            _context.Credentials.Add(credential);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Credential created: '{Name}' ({CredentialId}) for Person {PersonId} at Company {CompanyId}",
                credential.Name, credential.CredentialId, credential.PersonId, companyId);

            return credential;
        }

        public async Task<InitiateCredentialUploadResult> InitiateUploadAsync(string companyId, Credential credential, string? mimeType)
        {
            var s3Key = $"credentials/{companyId}/{credential.PersonId}/{Guid.NewGuid()}/{credential.Name.Replace(" ", "_")}";

            credential.CompanyId = companyId;
            credential.DocumentUrl = s3Key;
            credential.Status = "Draft";
            credential.CreatedAt = DateTime.UtcNow;

            _context.Credentials.Add(credential);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Credential document upload initiated: '{Name}' ({CredentialId}) for Person {PersonId} at Company {CompanyId}",
                credential.Name, credential.CredentialId, credential.PersonId, companyId);

            var presignedUrl = S3PresignHelper.GeneratePresignedPutUrl(_s3, _logger, BucketName, s3Key, mimeType, TimeSpan.FromMinutes(15));

            return new InitiateCredentialUploadResult(credential.CredentialId, presignedUrl, s3Key);
        }

        public async Task<Credential?> ConfirmUploadAsync(Guid credentialId, string companyId)
        {
            var credential = await _context.Credentials
                .FirstOrDefaultAsync(c => c.CredentialId == credentialId && c.CompanyId == companyId && c.Status == "Draft");

            if (credential == null)
            {
                return null;
            }

            credential.Status = "Active";
            credential.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Credential {CredentialId} confirmed active at Company {CompanyId}", credentialId, companyId);
            return credential;
        }

        public async Task<Credential?> UpdateAsync(Guid credentialId, string companyId, Credential updates)
        {
            var credential = await _context.Credentials
                .FirstOrDefaultAsync(c => c.CredentialId == credentialId && c.CompanyId == companyId);

            if (credential == null)
            {
                return null;
            }

            credential.Name = updates.Name;
            credential.Type = updates.Type;
            credential.IssuingAuthority = updates.IssuingAuthority;
            credential.CredentialNumber = updates.CredentialNumber;
            credential.IssueDate = updates.IssueDate;
            credential.ExpiryDate = updates.ExpiryDate;
            credential.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return credential;
        }

        public async Task<bool> ArchiveAsync(Guid credentialId, string companyId)
        {
            var credential = await _context.Credentials
                .FirstOrDefaultAsync(c => c.CredentialId == credentialId && c.CompanyId == companyId);

            if (credential == null)
            {
                return false;
            }

            credential.Status = "Archived";
            credential.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Credential {CredentialId} archived at Company {CompanyId}", credentialId, companyId);
            return true;
        }
    }
}
