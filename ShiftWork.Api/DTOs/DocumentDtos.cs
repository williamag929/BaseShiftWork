using System;
using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    public class DocumentDto
    {
        public Guid DocumentId { get; set; }
        public string CompanyId { get; set; }
        public int? LocationId { get; set; }
        public string Title { get; set; }
        public string? Description { get; set; }
        public string Type { get; set; }
        public string MimeType { get; set; }
        public long FileSize { get; set; }
        public string Version { get; set; }
        public List<string>? Tags { get; set; }
        public string AccessLevel { get; set; }
        public string Status { get; set; }
        public string UploadedByName { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class DocumentDetailDto : DocumentDto
    {
        public string PresignedUrl { get; set; }
        public int TotalReads { get; set; }
    }

    public class DocumentReadLogDto
    {
        public int PersonId { get; set; }
        public string PersonName { get; set; }
        public DateTime ReadAt { get; set; }
    }

    public class UploadDocumentDto
    {
        public string Title { get; set; }
        public string? Description { get; set; }
        public string Type { get; set; } = "Other";
        public int? LocationId { get; set; }
        public string Version { get; set; } = "1.0";
        public List<string>? Tags { get; set; }
        public string AccessLevel { get; set; } = "Public";
        public List<int>? AllowedRoleIds { get; set; }
        public string MimeType { get; set; }
        public long FileSize { get; set; }
    }

    public class InitiateUploadResponseDto
    {
        public Guid DocumentId { get; set; }
        public string PresignedUploadUrl { get; set; }
        public string S3Key { get; set; }
    }

    public class UpdateDocumentDto
    {
        public string Title { get; set; }
        public string? Description { get; set; }
        public string Type { get; set; }
        public int? LocationId { get; set; }
        public string Version { get; set; }
        public List<string>? Tags { get; set; }
        public string AccessLevel { get; set; }
        public List<int>? AllowedRoleIds { get; set; }
    }
}
