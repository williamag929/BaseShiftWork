using Microsoft.AspNetCore.Authorization;

namespace ShiftWork.Api.Authorization
{
    public class PermissionRequirement : IAuthorizationRequirement
    {
        public PermissionRequirement(string permissionKey)
        {
            PermissionKey = permissionKey;
        }

        public string PermissionKey { get; }
    }
}
