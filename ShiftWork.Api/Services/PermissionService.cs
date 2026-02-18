using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public interface IPermissionService
    {
        Task<List<Permission>> GetAllAsync(string companyId);
        Task<List<Permission>> GetByKeysAsync(string companyId, IEnumerable<string> keys);
    }

    public class PermissionService : IPermissionService
    {
        private readonly ShiftWorkContext _context;

        public PermissionService(ShiftWorkContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        public async Task<List<Permission>> GetAllAsync(string companyId)
        {
            return await _context.Permissions
                .Where(p => p.CompanyId == null || p.CompanyId == companyId)
                .OrderBy(p => p.Key)
                .ToListAsync();
        }

        public async Task<List<Permission>> GetByKeysAsync(string companyId, IEnumerable<string> keys)
        {
            var keyList = keys
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .Select(k => k.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (keyList.Count == 0)
            {
                return new List<Permission>();
            }

            return await _context.Permissions
                .Where(p => (p.CompanyId == null || p.CompanyId == companyId)
                    && keyList.Contains(p.Key))
                .ToListAsync();
        }
    }
}
