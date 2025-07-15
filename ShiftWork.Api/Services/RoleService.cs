using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace ShiftWork.Api.Services
{
    /// <summary>
    /// Defines the contract for the role service.
    /// </summary>
    public interface IRoleService
    {
        Task<IEnumerable<Role>> GetAll(string companyId);
        Task<Role> Get(string companyId, int roleId);
        Task<Role> Add(Role role);
        Task<Role> Update(Role role);
        Task<bool> Delete(string companyId, int roleId);
    }

    /// <summary>
    /// Service for managing roles.
    /// </summary>
    public class RoleService : IRoleService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<RoleService> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="RoleService"/> class.
        /// </summary>
        public RoleService(ShiftWorkContext context, ILogger<RoleService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IEnumerable<Role>> GetAll(string companyId)
        {
            return await _context.Roles.Where(r => r.CompanyId == companyId).ToListAsync();
        }

        public async Task<Role> Get(string companyId, int roleId)
        {
            return await _context.Roles.FirstOrDefaultAsync(r => r.CompanyId == companyId && r.RoleId == roleId);
        }

        public async Task<Role> Add(Role role)
        {
            _context.Roles.Add(role);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Role with ID {RoleId} created.", role.RoleId);
            return role;
        }

        public async Task<Role> Update(Role role)
        {
            _context.Entry(role).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            _logger.LogInformation("Role with ID {RoleId} updated.", role.RoleId);
            return role;
        }

        public async Task<bool> Delete(string companyId, int roleId)
        {
            var role = await _context.Roles.FirstOrDefaultAsync(r => r.CompanyId == companyId && r.RoleId == roleId);
            if (role == null)
            {
                return false;
            }

            _context.Roles.Remove(role);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Role with ID {RoleId} for company {CompanyId} deleted.", roleId, companyId);
            return true;
        }
    }
}