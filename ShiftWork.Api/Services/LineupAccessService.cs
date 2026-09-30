using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Authorization;
using ShiftWork.Api.Data;

namespace ShiftWork.Api.Services
{
    public record LineupAccess(string CompanyUserId, bool CanEdit, bool AllLocations, IReadOnlySet<int> LocationIds)
    {
        public bool CanSeeLocation(int locationId) => AllLocations || LocationIds.Contains(locationId);
    }

    public interface ILineupAccessService
    {
        Task<LineupAccess?> ResolveAsync(ClaimsPrincipal user, string companyId);
    }

    public class LineupAccessService : ILineupAccessService
    {
        private readonly ShiftWorkContext _context;
        public LineupAccessService(ShiftWorkContext context) => _context = context;

        public async Task<LineupAccess?> ResolveAsync(ClaimsPrincipal user, string companyId)
        {
            var uid = UserClaims.GetUserId(user);
            if (string.IsNullOrWhiteSpace(uid)) return null;

            var companyUser = await _context.CompanyUsers.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Uid == uid && u.CompanyId == companyId);

            // Same fallback as PermissionAuthorizationHandler: API JWTs carry personId, not Uid.
            if (companyUser == null)
            {
                var email = user.FindFirstValue(ClaimTypes.Email);
                if (!string.IsNullOrWhiteSpace(email))
                {
                    companyUser = await _context.CompanyUsers.AsNoTracking()
                        .FirstOrDefaultAsync(u => u.Email == email && u.CompanyId == companyId);
                }
            }
            if (companyUser == null) return null;

            var keys = await _context.UserRoles.AsNoTracking()
                .Where(ur => ur.CompanyUserId == companyUser.CompanyUserId && ur.CompanyId == companyId)
                .SelectMany(ur => _context.RolePermissions.Where(rp => rp.RoleId == ur.RoleId))
                .Select(rp => rp.Permission.Key)
                .Where(k => k.StartsWith("lineup."))
                .Distinct()
                .ToListAsync();

            var all = keys.Contains("lineup.all-locations");
            var scoped = all
                ? new HashSet<int>()
                : (await _context.UserLocationScopes.AsNoTracking()
                    .Where(s => s.CompanyId == companyId && s.CompanyUserId == companyUser.CompanyUserId)
                    .Select(s => s.LocationId)
                    .ToListAsync()).ToHashSet();

            return new LineupAccess(companyUser.CompanyUserId, keys.Contains("lineup.edit"), all, scoped);
        }
    }
}
