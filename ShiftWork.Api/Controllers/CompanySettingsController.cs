using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;
using BCrypt.Net;

namespace ShiftWork.Api.Controllers;

[ApiController]
[Route("api/companies/{companyId}/settings")]
public class CompanySettingsController : ControllerBase
{
    private readonly ICompanySettingsService _settingsService;
    private readonly IMapper _mapper;

    public CompanySettingsController(ICompanySettingsService settingsService, IMapper mapper)
    {
        _settingsService = settingsService;
        _mapper = mapper;
    }

    /// <summary>
    /// Get company settings. Creates default settings if none exist.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "company-settings.read")]
    public async Task<ActionResult<CompanySettingsDto>> GetSettings(string companyId)
    {
        var settings = await _settingsService.GetOrCreateSettings(companyId);
        return Ok(_mapper.Map<CompanySettingsDto>(settings));
    }

    /// <summary>
    /// Update company settings
    /// </summary>
    [HttpPut]
    [Authorize(Policy = "company-settings.update")]
    public async Task<ActionResult<CompanySettingsDto>> UpdateSettings(
        string companyId, 
        [FromBody] CompanySettingsDto settingsDto)
    {
        if (settingsDto.CompanyId != companyId)
        {
            return BadRequest("CompanyId in URL does not match CompanyId in request body.");
        }

        var existingSettings = await _settingsService.GetSettingsByCompanyId(companyId);
        
        if (existingSettings == null)
        {
            return NotFound($"Settings for company {companyId} not found.");
        }

        // Hash the kiosk admin password if provided
        if (!string.IsNullOrWhiteSpace(settingsDto.KioskAdminPassword))
        {
            existingSettings.KioskAdminPasswordHash = BCrypt.Net.BCrypt.HashPassword(settingsDto.KioskAdminPassword);
        }

        // Map DTO to entity, preserving SettingsId and password hash
        var updatedSettings = _mapper.Map<CompanySettingsDto, Models.CompanySettings>(settingsDto, existingSettings);
        
        var result = await _settingsService.UpdateSettings(updatedSettings);
        
        // Don't return the password in response
        var responseDto = _mapper.Map<CompanySettingsDto>(result);
        responseDto.KioskAdminPassword = null;
        
        return Ok(responseDto);
    }
}
