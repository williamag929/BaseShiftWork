using System.Security.Claims;

namespace ShiftWork.Api.Authorization
{
    public static class UserClaims
    {
        public static string? GetUserId(ClaimsPrincipal user) =>
            user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue("user_id")
            ?? user.FindFirstValue("uid")
            ?? user.FindFirstValue(ClaimTypes.Name)
            ?? user.FindFirstValue("sub");
    }
}
