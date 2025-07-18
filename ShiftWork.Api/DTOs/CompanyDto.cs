namespace ShiftWork.Api.DTOs
{
    public class CompanyDto
    {
        public string CompanyId { get; set; }
        public string Name { get; set; }  
        public string Address { get; set; }
        public string PhoneNumber { get; set; }
        public string Email { get; set; }
        public string Website { get; set; }
        public string TimeZone { get; set; }
        // Add other relevant properties, but perhaps exclude sensitive or complex ones like Settings if not always needed
        public string ExternalCode { get; set; }
        public string Currency { get; set; }
        public string LogoUrl { get; set; }
    }
}