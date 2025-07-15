using System.Collections.Generic;
using ShiftWork.Api.Data;
using AuditInterceptor = ShiftWork.Api.Data.AuditInterceptor;

namespace ShiftWork.Api.Models
{
    public class Person : BaseEntity
    {
        public int PersonId { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public string CompanyId { get; set; }
        public string PhoneNumber { get; set; }
        public string Address { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string Region { get; set; }
        public string Street { get; set; }
        public string Building { get; set; }
        public string Floor { get; set; }   
        public string Status { get; set; }
        public string PhotoUrl { get; set; }
        public string ExternalCode { get; set; }
        public Company Company { get; set; }
        public ICollection<PersonCrew> PersonCrews { get; set; }
    }
}