using System.Collections.Generic;

namespace ShiftWork.Api.Models
{
    public class Crew
    {
        public int CrewId { get; set; }
        public string Name { get; set; }
        public string CompanyId { get; set; }
        public Company Company { get; set; }
        public ICollection<PersonCrew> PersonCrews { get; set; }
    }
}