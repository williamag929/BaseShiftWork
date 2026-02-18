using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    public class UserClaimsDto
    {
        public string CompanyId { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public List<string> Roles { get; set; } = new List<string>();
        public List<string> Permissions { get; set; } = new List<string>();
    }
}
