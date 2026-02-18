using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using System;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public interface ICompanyUserProfileService
    {
        Task<CompanyUserProfile?> UpsertAsync(string companyId, string uid, int personId);
    }

    public class CompanyUserProfileService : ICompanyUserProfileService
    {
        private readonly ShiftWorkContext _context;

        public CompanyUserProfileService(ShiftWorkContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        public async Task<CompanyUserProfile?> UpsertAsync(string companyId, string uid, int personId)
        {
            var user = await _context.CompanyUsers.FirstOrDefaultAsync(u => u.Uid == uid && u.CompanyId == companyId);
            if (user == null)
            {
                return null;
            }

            var person = await _context.Persons.FirstOrDefaultAsync(p => p.PersonId == personId && p.CompanyId == companyId);
            if (person == null)
            {
                return null;
            }

            var existing = await _context.CompanyUserProfiles.FirstOrDefaultAsync(p => p.CompanyUserId == user.CompanyUserId);
            if (existing == null)
            {
                var link = new CompanyUserProfile
                {
                    CompanyUserId = user.CompanyUserId,
                    PersonId = person.PersonId,
                    CompanyId = companyId
                };

                _context.CompanyUserProfiles.Add(link);
                await _context.SaveChangesAsync();
                return link;
            }

            existing.PersonId = person.PersonId;
            existing.CompanyId = companyId;

            await _context.SaveChangesAsync();
            return existing;
        }
    }
}
