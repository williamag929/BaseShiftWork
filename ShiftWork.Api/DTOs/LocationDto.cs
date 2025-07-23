namespace ShiftWork.Api.DTOs
{
    public class LocationDto
    {
        public int LocationId { get; set; }
        public string Name { get; set; }
        public string CompanyId { get; set; }
        public string Address { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string Region { get; set; }
        public string Street { get; set; }
        public string Building { get; set; }
        public string Floor { get; set; }
        public string Department { get; set; }
        public string Country { get; set; }
        public string ZipCode { get; set; }
        public GeoCoordinatesDto? GeoCoordinates { get; set; }
        public int RatioMax { get; set; }
        public string PhoneNumber { get; set; }
        public string Email { get; set; }
        public string ExternalCode { get; set; }
        public string TimeZone { get; set; }
        public string Status { get; set; }
    }
}