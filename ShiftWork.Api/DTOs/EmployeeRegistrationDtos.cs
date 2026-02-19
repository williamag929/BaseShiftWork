namespace ShiftWork.Api.DTOs
{
    /// <summary>
    /// Request to register a new user with their employee profile
    /// </summary>
    public class RegisterUserRequest
    {
        public string Name { get; set; }
        public string Email { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Pin { get; set; }
        public List<int> RoleIds { get; set; } = new List<int>();
    }

    /// <summary>
    /// Request to link an existing person to a Firebase user account
    /// </summary>
    public class LinkUserToPersonRequest
    {
        public int PersonId { get; set; }
        public List<int> RoleIds { get; set; } = new List<int>();
    }

    /// <summary>
    /// Request to create employee with optional user account
    /// </summary>
    public class CreateEmployeeWithUserRequest
    {
        public string Name { get; set; }
        public string Email { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Pin { get; set; }
        public bool CreateUserAccount { get; set; }
        public List<int> RoleIds { get; set; } = new List<int>();
        public bool SendInvite { get; set; }
    }

    /// <summary>
    /// Response for employee+user creation
    /// </summary>
    public class EmployeeUserResponse
    {
        public PersonDto Person { get; set; }
        public CompanyUserDto? CompanyUser { get; set; }
        public List<CompanyUserProfileDto> Profiles { get; set; } = new List<CompanyUserProfileDto>();
        public string? InviteLink { get; set; }
    }
}
