using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services;

public interface ICompanySettingsService
{
    Task<CompanySettings?> GetSettingsByCompanyId(string companyId);
    Task<CompanySettings> CreateDefaultSettings(string companyId);
    Task<CompanySettings> UpdateSettings(CompanySettings settings);
    Task<CompanySettings> GetOrCreateSettings(string companyId);
}
