using System.Collections.Generic;

namespace ShiftWork.Api.Models
{
    public class Company
    {
        public string CompanyId { get; set; }
        public string Name { get; set; }
        public string Address { get; set; }
        public string PhoneNumber { get; set; }
        public string Email { get; set; }
        public string Website { get; set; }
        public string ExternalCode { get; set; }
        public string TimeZone { get; set; }
        public string Currency { get; set; }
        public string LogoUrl { get; set; }
        public string Settings { get; set; }
        public ICollection<Location> Locations { get; set; }
        public ICollection<Person> People { get; set; }
        public ICollection<Role> Roles { get; set; }
        public ICollection<Schedule> Schedules { get; set; }
        public ICollection<TaskShift> TaskShifts { get; set; }
        public ICollection<Crew> Crews { get; set; }
    }
}