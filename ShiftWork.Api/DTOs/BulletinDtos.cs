using System;
using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    public class BulletinDto
    {
        public Guid BulletinId { get; set; }
        public string CompanyId { get; set; }
        public int? LocationId { get; set; }
        public string Title { get; set; }
        public string Content { get; set; }
        public string Type { get; set; }
        public string Priority { get; set; }
        public List<string>? AttachmentUrls { get; set; }
        public DateTime PublishedAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public string Status { get; set; }
        public string CreatedByName { get; set; }
        public bool IsReadByCurrentUser { get; set; }
        public int TotalReads { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class BulletinReadDto
    {
        public int PersonId { get; set; }
        public string PersonName { get; set; }
        public DateTime ReadAt { get; set; }
    }

    public class CreateBulletinDto
    {
        public string Title { get; set; }
        public string Content { get; set; }
        public string Type { get; set; } = "General";
        public string Priority { get; set; } = "Normal";
        public int? LocationId { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public List<string>? AttachmentUrls { get; set; }
        public string Status { get; set; } = "Draft";
    }

    public class UpdateBulletinDto : CreateBulletinDto { }
}
