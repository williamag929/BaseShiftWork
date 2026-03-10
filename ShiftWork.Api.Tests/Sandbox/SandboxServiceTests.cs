using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Sandbox;

/// <summary>
/// Unit tests for SandboxService using an in-memory EF Core context.
/// TransactionIgnoredWarning is suppressed because in-memory EF does not
/// support real transactions; the service code still executes SaveChangesAsync.
/// </summary>
public class SandboxServiceTests : IDisposable
{
    private readonly ShiftWorkContext _context;
    private readonly SandboxService _svc;

    public SandboxServiceTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new ShiftWorkContext(options);
        _svc = new SandboxService(_context, NullLogger<SandboxService>.Instance);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<string> CreateCompanyAsync(string name = "Test Corp")
    {
        var companyId = Guid.NewGuid().ToString();
        _context.Companies.Add(new Company
        {
            CompanyId = companyId, Name = name, Email = $"{companyId}@test.com",
            PhoneNumber = string.Empty, Address = string.Empty, TimeZone = "UTC"
        });
        await _context.SaveChangesAsync();
        return companyId;
    }

    // ── SeedSandboxDataAsync ──────────────────────────────────────────────────

    [Fact]
    public async Task SeedSandboxData_CreatesExactlyOneLocation()
    {
        var companyId = await CreateCompanyAsync();
        await _svc.SeedSandboxDataAsync(companyId);

        var count = await _context.Locations.CountAsync(l => l.CompanyId == companyId && l.IsSandbox);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task SeedSandboxData_CreatesExactlyOneArea()
    {
        var companyId = await CreateCompanyAsync();
        await _svc.SeedSandboxDataAsync(companyId);

        var count = await _context.Areas.CountAsync(a => a.CompanyId == companyId && a.IsSandbox);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task SeedSandboxData_CreatesExactlyTwoPersons()
    {
        var companyId = await CreateCompanyAsync();
        await _svc.SeedSandboxDataAsync(companyId);

        var count = await _context.Persons.CountAsync(p => p.CompanyId == companyId && p.IsSandbox);
        Assert.Equal(2, count);
    }

    [Fact]
    public async Task SeedSandboxData_LocationNameMatchesTemplate()
    {
        var companyId = await CreateCompanyAsync();
        await _svc.SeedSandboxDataAsync(companyId);

        var location = await _context.Locations.FirstAsync(l => l.CompanyId == companyId && l.IsSandbox);
        Assert.Equal(SandboxSeedTemplate.LocationName, location.Name);
    }

    [Fact]
    public async Task SeedSandboxData_AreaNameMatchesTemplate()
    {
        var companyId = await CreateCompanyAsync();
        await _svc.SeedSandboxDataAsync(companyId);

        var area = await _context.Areas.FirstAsync(a => a.CompanyId == companyId && a.IsSandbox);
        Assert.Equal(SandboxSeedTemplate.AreaName, area.Name);
    }

    // ── DeleteSandboxDataAsync ────────────────────────────────────────────────

    [Fact]
    public async Task DeleteSandboxData_RemovesAllSandboxRecords()
    {
        var companyId = await CreateCompanyAsync();
        await _svc.SeedSandboxDataAsync(companyId);

        // Verify something was seeded
        Assert.True(await _context.Persons.AnyAsync(p => p.CompanyId == companyId && p.IsSandbox));

        await _svc.DeleteSandboxDataAsync(companyId);

        Assert.Equal(0, await _context.Locations.CountAsync(l => l.CompanyId == companyId && l.IsSandbox));
        Assert.Equal(0, await _context.Areas.CountAsync(a => a.CompanyId == companyId && a.IsSandbox));
        Assert.Equal(0, await _context.Persons.CountAsync(p => p.CompanyId == companyId && p.IsSandbox));
    }

    [Fact]
    public async Task DeleteSandboxData_DoesNotDeleteNonSandboxRecords()
    {
        var companyId = await CreateCompanyAsync();

        // Add a real employee
        _context.Persons.Add(new Person
        {
            Name = "Real Employee", Email = "real@corp.com",
            CompanyId = companyId, Status = "Active", IsSandbox = false
        });
        await _context.SaveChangesAsync();

        // Seed and then delete sandbox
        await _svc.SeedSandboxDataAsync(companyId);
        await _svc.DeleteSandboxDataAsync(companyId);

        var realPerson = await _context.Persons.FirstOrDefaultAsync(p => p.Name == "Real Employee");
        Assert.NotNull(realPerson);
        Assert.False(realPerson.IsSandbox);
    }

    [Fact]
    public async Task DeleteSandboxData_IsIdempotent_WhenCalledTwice()
    {
        var companyId = await CreateCompanyAsync();
        await _svc.SeedSandboxDataAsync(companyId);

        await _svc.DeleteSandboxDataAsync(companyId);
        var ex = await Record.ExceptionAsync(() => _svc.DeleteSandboxDataAsync(companyId));

        Assert.Null(ex); // second call should not throw
    }

    // ── ResetSandboxDataAsync ─────────────────────────────────────────────────

    [Fact]
    public async Task ResetSandboxData_SeedCountIsIdempotent()
    {
        var companyId = await CreateCompanyAsync();
        await _svc.SeedSandboxDataAsync(companyId);
        await _svc.ResetSandboxDataAsync(companyId);

        // Should still have exactly 1 location, 1 area, 2 persons
        Assert.Equal(1, await _context.Locations.CountAsync(l => l.CompanyId == companyId && l.IsSandbox));
        Assert.Equal(1, await _context.Areas.CountAsync(a => a.CompanyId == companyId && a.IsSandbox));
        Assert.Equal(2, await _context.Persons.CountAsync(p => p.CompanyId == companyId && p.IsSandbox));
    }

    // ── HideSandboxDataAsync ──────────────────────────────────────────────────

    [Fact]
    public async Task HideSandboxData_SetsSandboxPersonStatusToSandbox()
    {
        var companyId = await CreateCompanyAsync();
        await _svc.SeedSandboxDataAsync(companyId);

        await _svc.HideSandboxDataAsync(companyId, new[] { "all" });

        var persons = await _context.Persons.Where(p => p.CompanyId == companyId && p.IsSandbox).ToListAsync();
        Assert.All(persons, p => Assert.Equal("Sandbox", p.Status));
    }

    [Fact]
    public async Task HideSandboxData_SetsSandboxLocationStatusToSandbox()
    {
        var companyId = await CreateCompanyAsync();
        await _svc.SeedSandboxDataAsync(companyId);

        await _svc.HideSandboxDataAsync(companyId, new[] { "location" });

        var locations = await _context.Locations.Where(l => l.CompanyId == companyId && l.IsSandbox).ToListAsync();
        Assert.All(locations, l => Assert.Equal("Sandbox", l.Status));
    }

    [Fact]
    public async Task HideSandboxData_DoesNotAffectNonSandboxPersons()
    {
        var companyId = await CreateCompanyAsync();
        _context.Persons.Add(new Person
        {
            Name = "Real Employee", Email = "real@corp.com",
            CompanyId = companyId, Status = "Active", IsSandbox = false
        });
        await _context.SaveChangesAsync();
        await _svc.SeedSandboxDataAsync(companyId);

        await _svc.HideSandboxDataAsync(companyId, new[] { "person" });

        var realPerson = await _context.Persons.FirstAsync(p => p.Name == "Real Employee");
        Assert.Equal("Active", realPerson.Status);
    }

    // ── GetSandboxStatusAsync ─────────────────────────────────────────────────

    [Fact]
    public async Task GetSandboxStatus_ReturnsTrueAfterSeed()
    {
        var companyId = await CreateCompanyAsync();
        await _svc.SeedSandboxDataAsync(companyId);

        var status = await _svc.GetSandboxStatusAsync(companyId);

        Assert.True(status.HasSandboxData);
        Assert.Equal(2, status.SandboxPersonCount);
        Assert.Equal(1, status.SandboxAreaCount);
        Assert.Equal(1, status.SandboxLocationCount);
    }

    [Fact]
    public async Task GetSandboxStatus_ReturnsFalseAfterDelete()
    {
        var companyId = await CreateCompanyAsync();
        await _svc.SeedSandboxDataAsync(companyId);
        await _svc.DeleteSandboxDataAsync(companyId);

        var status = await _svc.GetSandboxStatusAsync(companyId);

        Assert.False(status.HasSandboxData);
        Assert.Equal(0, status.SandboxPersonCount);
    }

    public void Dispose() => _context.Dispose();
}
