using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace ShiftWork.Api.Authorization
{
    public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
    {
        private readonly ShiftWorkContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public PermissionAuthorizationHandler(
            ShiftWorkContext context,
            IHttpContextAccessor httpContextAccessor)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));
        }

        protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
        {
            var httpContext = context.Resource as HttpContext
                ?? (context.Resource as Microsoft.AspNetCore.Mvc.Filters.AuthorizationFilterContext)?.HttpContext
                ?? (context.Resource as ActionContext)?.HttpContext
                ?? _httpContextAccessor.HttpContext;

            if (httpContext == null)
            {
                return;
            }

            var companyId = httpContext.GetRouteValue("companyId")?.ToString()
                ?? httpContext.GetRouteValue("id")?.ToString();
            if (string.IsNullOrWhiteSpace(companyId))
            {
                return;
            }

            var uid = GetUserId(context.User);
            if (string.IsNullOrWhiteSpace(uid))
            {
                return;
            }

            var companyUser = await _context.CompanyUsers
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Uid == uid && u.CompanyId == companyId);

            if (companyUser == null)
            {
                return;
            }

            var hasPermission = await _context.UserRoles
                .AsNoTracking()
                .Where(ur => ur.CompanyUserId == companyUser.CompanyUserId && ur.CompanyId == companyId)
                .SelectMany(ur => _context.RolePermissions.Where(rp => rp.RoleId == ur.RoleId))
                .Select(rp => rp.Permission)
                .AnyAsync(p => p.Key == requirement.PermissionKey);

            if (hasPermission)
            {
                context.Succeed(requirement);
            }
        }

        private static string? GetUserId(ClaimsPrincipal user)
        {
            return user.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? user.FindFirstValue("user_id")
                ?? user.FindFirstValue("uid")
                ?? user.FindFirstValue(ClaimTypes.Name)
                ?? user.FindFirstValue("sub");
        }
    }
}
