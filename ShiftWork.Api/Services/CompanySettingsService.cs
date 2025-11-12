using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services;

public class CompanySettingsService : ICompanySettingsService
{
    private readonly ShiftWorkContext _context;

    public CompanySettingsService(ShiftWorkContext context)
    {
        _context = context;
    }

    public async Task<CompanySettings?> GetSettingsByCompanyId(string companyId)
    {
        return await _context.CompanySettings
            .FirstOrDefaultAsync(s => s.CompanyId == companyId);
    }

    public async Task<CompanySettings> CreateDefaultSettings(string companyId)
    {
        var settings = new CompanySettings
        {
            CompanyId = companyId,
            // All default values are set in the model
            CreatedAt = DateTime.UtcNow,
            LastUpdatedAt = DateTime.UtcNow
        };

        _context.CompanySettings.Add(settings);
        await _context.SaveChangesAsync();

        return settings;
    }

    public async Task<CompanySettings> UpdateSettings(CompanySettings settings)
    {
        settings.LastUpdatedAt = DateTime.UtcNow;
        _context.CompanySettings.Update(settings);
        await _context.SaveChangesAsync();

        return settings;
    }

    public async Task<CompanySettings> GetOrCreateSettings(string companyId)
    {
        var settings = await GetSettingsByCompanyId(companyId);
        
        if (settings == null)
        {
            settings = await CreateDefaultSettings(companyId);
        }

        return settings;
    }
}
