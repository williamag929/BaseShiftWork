namespace ShiftWork.Api.Models
{
    public class PersonCrew
    {
        public int PersonId { get; set; }
        public Person Person { get; set; }

        public int CrewId { get; set; }
        public Crew Crew { get; set; }
    }
}