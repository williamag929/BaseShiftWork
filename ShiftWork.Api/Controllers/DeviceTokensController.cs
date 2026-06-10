using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Controllers;

[ApiController]
[Route("api/companies/{companyId}/people/{personId}/device-tokens")]
public class DeviceTokensController : ControllerBase
{
    private readonly ShiftWorkContext _context;

    public DeviceTokensController(ShiftWorkContext context)
    {
        _context = context;
    }

    // GET: api/companies/1/people/123/device-tokens
    [HttpGet]
    [Authorize(Policy = "device-tokens.read")]
    public async Task<ActionResult<IEnumerable<DeviceToken>>> GetDeviceTokens(string companyId, int personId)
    {
        return await _context.DeviceTokens
            .Where(dt => dt.CompanyId == companyId && dt.PersonId == personId)
            .ToListAsync();
    }

    // POST: api/companies/1/people/123/device-tokens
    [HttpPost]
    [Authorize(Policy = "device-tokens.create")]
    public async Task<ActionResult<DeviceToken>> RegisterDeviceToken(
        string companyId,
        int personId,
        [FromBody] DeviceTokenDto dto)
    {
        // Check if token already exists
        var existing = await _context.DeviceTokens
            .FirstOrDefaultAsync(dt => 
                dt.CompanyId == companyId && 
                dt.PersonId == personId && 
                dt.Token == dto.DeviceToken);

        if (existing != null)
        {
            // Update existing token
            existing.Platform = dto.Platform;
            existing.DeviceName = dto.DeviceName;
            existing.LastUpdated = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        // Create new token
        var deviceToken = new DeviceToken
        {
            CompanyId = companyId,
            PersonId = personId,
            Token = dto.DeviceToken,
            Platform = dto.Platform,
            DeviceName = dto.DeviceName,
            CreatedAt = DateTime.UtcNow,
            LastUpdated = DateTime.UtcNow
        };

        _context.DeviceTokens.Add(deviceToken);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetDeviceTokens), new { companyId, personId }, deviceToken);
    }

    // DELETE: api/companies/1/people/123/device-tokens/{token}
    [HttpDelete("{token}")]
    [Authorize(Policy = "device-tokens.delete")]
    public async Task<IActionResult> DeleteDeviceToken(string companyId, int personId, string token)
    {
        var deviceToken = await _context.DeviceTokens
            .FirstOrDefaultAsync(dt => 
                dt.CompanyId == companyId && 
                dt.PersonId == personId && 
                dt.Token == token);

        if (deviceToken == null)
        {
            return NotFound();
        }

        _context.DeviceTokens.Remove(deviceToken);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}

public class DeviceTokenDto
{
    public string DeviceToken { get; set; } = string.Empty;
    public string Platform { get; set; } = string.Empty;
    public string? DeviceName { get; set; }
}
