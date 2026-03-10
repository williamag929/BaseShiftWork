namespace ShiftWork.Api.DTOs
{
    public class CrewDto
    {
        public int CrewId { get; set; }
        public string Name { get; set; }
        public string CompanyId { get; set; }
    }

    /// <summary>
    /// A slim view of a person who is a member of a crew.
    /// </summary>
    public class CrewMemberDto
    {
        public int PersonId { get; set; }
        public string Name { get; set; }
        public string PhotoUrl { get; set; }
    }

    /// <summary>
    /// Availability status for one crew member for a requested time window.
    /// </summary>
    public class CrewMemberAvailabilityDto
    {
        public int PersonId { get; set; }
        public string Name { get; set; }
        public string PhotoUrl { get; set; }
        /// <summary>true = no conflict for the requested period.</summary>
        public bool Available { get; set; }
        /// <summary>"conflict" | "time-off" | null</summary>
        public string Reason { get; set; }
    }
}