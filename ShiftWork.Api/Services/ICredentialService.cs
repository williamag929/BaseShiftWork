using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public record InitiateCredentialUploadResult(Guid CredentialId, string PresignedUploadUrl, string S3Key);

    public interface ICredentialService
    {
        Task<List<Credential>> GetByCompanyAsync(string companyId, int? personId = null, string? status = null);
        Task<List<Credential>> GetByPersonAsync(string companyId, int personId);
        Task<(List<Credential> Expired, List<Credential> ExpiringSoon)> GetExpiringAsync(string companyId, int withinDays = 30);
        Task<(Credential Credential, string? PresignedUrl)?> GetByIdAsync(Guid credentialId, string companyId);
        Task<Credential> CreateAsync(string companyId, Credential credential);
        Task<InitiateCredentialUploadResult> InitiateUploadAsync(string companyId, Credential credential, string? mimeType);
        Task<Credential?> ConfirmUploadAsync(Guid credentialId, string companyId);
        Task<Credential?> UpdateAsync(Guid credentialId, string companyId, Credential updates);
        Task<bool> ArchiveAsync(Guid credentialId, string companyId);
    }
}
