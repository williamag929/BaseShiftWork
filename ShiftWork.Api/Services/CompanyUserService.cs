using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace ShiftWork.Api.Services
{
    public class CompanyUserService : ICompanyUserService
    {
        private readonly ShiftWorkContext _context;

        public CompanyUserService(ShiftWorkContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<CompanyUser>> GetAllByCompanyIdAsync(string companyId)
        {
            return await _context.CompanyUsers.
                Where(user => user.CompanyId == companyId)
                .ToListAsync();
        }

        public async Task<CompanyUser> GetByUidAsync(string uid)
        {
            return await _context.CompanyUsers.FindAsync(uid);
        }

        public async Task<CompanyUser> CreateAsync(CompanyUser companyUser)
        {
            if (companyUser == null)
            {
                throw new ArgumentNullException(nameof(companyUser));
            }

            companyUser.CreatedAt = DateTime.UtcNow;  // Ensure CreatedAt is set on creation
            companyUser.UpdatedAt = DateTime.UtcNow;

            _context.CompanyUsers.Add(companyUser);
            await _context.SaveChangesAsync();
            return companyUser;
        }

        public async Task<CompanyUser> UpdateAsync(string uid, CompanyUser companyUser)
        {
            if (companyUser == null)
            {
                throw new ArgumentNullException(nameof(companyUser));
            }

            if (uid != companyUser.Uid)
            {
                throw new ArgumentException("UID in route must match UID in body.", nameof(uid));
            }

            var existingUser = await _context.CompanyUsers.FindAsync(companyUser.Uid);
            if (existingUser == null)
            {
                return null; // Or throw an exception, depending on your error handling strategy
            }

            // Update properties, except the primary key (Uid) and CompanyId (if it shouldn't be changed)
            existingUser.Email = companyUser.Email;
            existingUser.DisplayName = companyUser.DisplayName;
            existingUser.PhotoURL = companyUser.PhotoURL;
            existingUser.EmailVerified = companyUser.EmailVerified;
            existingUser.UpdatedAt = DateTime.UtcNow;

            _context.Entry(existingUser).State = EntityState.Modified; // Explicitly mark as modified
            await _context.SaveChangesAsync();
            return existingUser;
        }

        public async Task<bool> DeleteAsync(string uid)
        {
            var companyUser = await _context.CompanyUsers.FindAsync(uid);
            if (companyUser == null) return false;

            _context.CompanyUsers.Remove(companyUser);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}