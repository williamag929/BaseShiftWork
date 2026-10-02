using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public interface IUserLocationScopeService
    {
        /// <summary>Sorted location ids the user is scoped to; null when the user is not in the company.</summary>
        Task<List<int>?> GetAsync(string companyId, string uid);
        /// <summary>Replaces the user's scope rows. Null for an unknown user; InvalidOperationException when an id is not a location of the company.</summary>
        Task<List<int>?> ReplaceAsync(string companyId, string uid, IEnumerable<int> locationIds);
    }

    public class UserLocationScopeService : IUserLocationScopeService
    {
        private readonly ShiftWorkContext _context;
        public UserLocationScopeService(ShiftWorkContext context) => _context = context;

        public async Task<List<int>?> GetAsync(string companyId, string uid)
        {
            var companyUserId = await ResolveCompanyUserIdAsync(companyId, uid);
            if (companyUserId == null) return null;

            return await _context.UserLocationScopes.AsNoTracking()
                .Where(s => s.CompanyId == companyId && s.CompanyUserId == companyUserId)
                .Select(s => s.LocationId)
                .Distinct()
                .OrderBy(id => id)
                .ToListAsync();
        }

        public async Task<List<int>?> ReplaceAsync(string companyId, string uid, IEnumerable<int> locationIds)
        {
            var companyUserId = await ResolveCompanyUserIdAsync(companyId, uid);
            if (companyUserId == null) return null;

            var wanted = (locationIds ?? Enumerable.Empty<int>()).Distinct().OrderBy(id => id).ToList();

            if (wanted.Count > 0)
            {
                var known = await _context.Locations.AsNoTracking()
                    .Where(l => l.CompanyId == companyId && wanted.Contains(l.LocationId))
                    .Select(l => l.LocationId)
                    .ToListAsync();
                var unknown = wanted.Except(known).ToList();
                if (unknown.Count > 0)
                    throw new InvalidOperationException($"Unknown locations: {string.Join(", ", unknown)}");
            }

            var existing = await _context.UserLocationScopes
                .Where(s => s.CompanyId == companyId && s.CompanyUserId == companyUserId)
                .ToListAsync();

            var keep = new HashSet<int>();
            foreach (var row in existing)
            {
                // Drops rows that are no longer wanted; the duplicate guard is defensive (the unique index does not exist on InMemory).
                if (!wanted.Contains(row.LocationId) || !keep.Add(row.LocationId))
                    _context.UserLocationScopes.Remove(row);
            }
            foreach (var id in wanted.Where(id => !keep.Contains(id)))
            {
                _context.UserLocationScopes.Add(new UserLocationScope
                {
                    CompanyId = companyId, CompanyUserId = companyUserId, LocationId = id
                });
            }

            await _context.SaveChangesAsync();
            return wanted;
        }

        private Task<string?> ResolveCompanyUserIdAsync(string companyId, string uid) =>
            _context.CompanyUsers.AsNoTracking()
                .Where(u => u.Uid == uid && u.CompanyId == companyId)
                .Select(u => (string?)u.CompanyUserId)
                .FirstOrDefaultAsync();
    }
}
