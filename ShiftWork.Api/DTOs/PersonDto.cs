namespace ShiftWork.Api.DTOs
{
    public class PersonDto
    {
        public int PersonId { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public string CompanyId { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? Region { get; set; }
        public string? Street { get; set; }
        public string? Building { get; set; }
        public string? Floor { get; set; }
        public string Status { get; set; } = "Active"; // e.g., Active, Inactive, Scheduled, ShiftEarly, ShiftLate,
        public string? PhotoUrl { get; set; }
        public int? RoleId { get; set; } // Foreign key to Role
        public string? ExternalCode { get; set; }
        // Consider if you need related entities like PersonCrews in the DTO.  If so, add them.
        // public ICollection<PersonCrew> PersonCrews { get; set; } 
    }
}