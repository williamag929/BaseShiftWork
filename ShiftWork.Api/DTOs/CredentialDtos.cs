using System;
using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    public class CredentialDto
    {
        public Guid CredentialId { get; set; }
        public string CompanyId { get; set; }
        public int PersonId { get; set; }
        public string PersonName { get; set; } = "";
        public string Name { get; set; }
        public string? Type { get; set; }
        public string? IssuingAuthority { get; set; }
        public string? CredentialNumber { get; set; }
        public DateTime? IssueDate { get; set; }
        public DateTime ExpiryDate { get; set; }
        /// <summary>"Valid" | "ExpiringSoon" (within 30 days) | "Expired" — computed on read.</summary>
        public string ExpiryStatus { get; set; } = "Valid";
        public bool HasDocument { get; set; }
        /// <summary>Presigned GET URL, populated only when a document is attached and the caller fetched detail.</summary>
        public string? DocumentViewUrl { get; set; }
        public string Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class CreateCredentialDto
    {
        public int PersonId { get; set; }
        public string Name { get; set; }
        public string? Type { get; set; }
        public string? IssuingAuthority { get; set; }
        public string? CredentialNumber { get; set; }
        public DateTime? IssueDate { get; set; }
        public DateTime ExpiryDate { get; set; }
        /// <summary>Set when the credential has an attached document to upload; omit for a document-less entry.</summary>
        public string? MimeType { get; set; }
    }

    public class UpdateCredentialDto
    {
        public string Name { get; set; }
        public string? Type { get; set; }
        public string? IssuingAuthority { get; set; }
        public string? CredentialNumber { get; set; }
        public DateTime? IssueDate { get; set; }
        public DateTime ExpiryDate { get; set; }
    }

    public class InitiateCredentialUploadResponseDto
    {
        public Guid CredentialId { get; set; }
        public string PresignedUploadUrl { get; set; }
        public string S3Key { get; set; }
    }

    public class ExpiringCredentialsSummaryDto
    {
        public int ExpiredCount { get; set; }
        public int ExpiringSoonCount { get; set; }
        public List<CredentialDto> Items { get; set; } = new();
    }
}
