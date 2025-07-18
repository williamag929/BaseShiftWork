using ShiftWork.Api.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public interface ICompanyUserService
    {
        Task<IEnumerable<CompanyUser>> GetAllByCompanyIdAsync(string companyId);
        Task<CompanyUser> GetByUidAsync(string uid);
        Task<CompanyUser> CreateAsync(CompanyUser companyUser);
        Task<CompanyUser> UpdateAsync(string uid, CompanyUser companyUser);
        Task<bool> DeleteAsync(string uid);

        // Optional: Methods for handling users across companies if needed
        // Task<IEnumerable<CompanyUser>> GetAllUsersAsync();
        // Task<CompanyUser> GetUserByIdAsync(string uid);
    }
}