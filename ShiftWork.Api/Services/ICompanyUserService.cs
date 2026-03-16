using ShiftWork.Api.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public interface ICompanyUserService
    {
        Task<IEnumerable<CompanyUser>> GetAllByCompanyIdAsync(string companyId);
        Task<CompanyUser> GetByUidAsync(string uid);
        Task<CompanyUser> GetByCompanyUserIdAsync(string companyUserId);
        Task<CompanyUser> CreateAsync(CompanyUser companyUser);
        Task<CompanyUser> UpdateAsync(string uid, CompanyUser companyUser);
        Task<bool> DeleteAsync(string uid);
        Task<CompanyUser> SetActiveAsync(string companyUserId, bool isActive);
    }
}