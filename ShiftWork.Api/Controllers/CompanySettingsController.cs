using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;

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
    public async Task<ActionResult<CompanySettingsDto>> GetSettings(string companyId)
    {
        var settings = await _settingsService.GetOrCreateSettings(companyId);
        return Ok(_mapper.Map<CompanySettingsDto>(settings));
    }

    /// <summary>
    /// Update company settings
    /// </summary>
    [HttpPut]
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

        // Map DTO to entity, preserving SettingsId
        var updatedSettings = _mapper.Map<CompanySettingsDto, Models.CompanySettings>(settingsDto, existingSettings);
        
        var result = await _settingsService.UpdateSettings(updatedSettings);
        
        return Ok(_mapper.Map<CompanySettingsDto>(result));
    }
}
