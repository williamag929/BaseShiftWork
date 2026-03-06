using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Registration;

/// <summary>
/// Integration tests for the company registration flow.
/// Uses in-memory EF Core to avoid a real database dependency.
/// TransactionIgnoredWarning is suppressed globally for all tests in this class.
/// </summary>
public class RegistrationIntegrationTests : IDisposable
{
    private readonly ShiftWorkContext _context;
    private readonly SandboxService _sandboxService;

    public RegistrationIntegrationTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()) // fresh DB per test
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new ShiftWorkContext(options);
        _sandboxService = new SandboxService(_context, NullLogger<SandboxService>.Instance);
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Register_HappyPath_CreatesCompanyAndCompanyUser()
    {
        // Arrange
        var companyId = Guid.NewGuid().ToString();
        var company = new Company
        {
            CompanyId = companyId,
            Name = "Test Corp",
            Email = "test@corp.com",
            PhoneNumber = string.Empty,
            Address = string.Empty,
            TimeZone = "UTC",
            Plan = "Free",
            OnboardingStatus = "Pending"
        };
        _context.Companies.Add(company);

        var companyUser = new CompanyUser
        {
            CompanyUserId = Guid.NewGuid().ToString(),
            Uid = "firebase_uid_abc123",
            Email = "admin@corp.com",
            DisplayName = "Test Admin",
            CompanyId = companyId,
            PhotoURL = string.Empty,
            EmailVerified = false
        };
        _context.CompanyUsers.Add(companyUser);
        await _context.SaveChangesAsync();

        // Assert company was persisted
        var savedCompany = await _context.Companies.FindAsync(companyId);
        Assert.NotNull(savedCompany);
        Assert.Equal("Free", savedCompany.Plan);
        Assert.Equal("Pending", savedCompany.OnboardingStatus);

        // Assert CompanyUser was persisted
        var savedUser = await _context.CompanyUsers
            .FirstOrDefaultAsync(u => u.Uid == "firebase_uid_abc123");
        Assert.NotNull(savedUser);
        Assert.Equal(companyId, savedUser.CompanyId);
    }

    [Fact]
    public async Task Register_HappyPath_SandboxIsSeeded()
    {
        // Arrange
        var companyId = Guid.NewGuid().ToString();
        _context.Companies.Add(new Company
        {
            CompanyId = companyId, Name = "Seed Corp", Email = "seed@corp.com",
            PhoneNumber = string.Empty, Address = string.Empty, TimeZone = "UTC"
        });
        await _context.SaveChangesAsync();

        // Act
        await _sandboxService.SeedSandboxDataAsync(companyId);

        // Assert exactly 1 sandbox Location, 1 Area, 2 Persons seeded
        var sandboxLocations = _context.Locations.Where(l => l.CompanyId == companyId && l.IsSandbox).ToList();
        var sandboxAreas = _context.Areas.Where(a => a.CompanyId == companyId && a.IsSandbox).ToList();
        var sandboxPersons = _context.Persons.Where(p => p.CompanyId == companyId && p.IsSandbox).ToList();

        Assert.Single(sandboxLocations);
        Assert.Single(sandboxAreas);
        Assert.Equal(2, sandboxPersons.Count);

        // Assert sandbox records have the expected names
        Assert.Equal(SandboxSeedTemplate.LocationName, sandboxLocations[0].Name);
        Assert.Equal(SandboxSeedTemplate.AreaName, sandboxAreas[0].Name);
        Assert.Contains(sandboxPersons, p => p.Name == "Sample Employee 1");
        Assert.Contains(sandboxPersons, p => p.Name == "Sample Employee 2");
    }

    [Fact]
    public async Task Register_SandboxSeed_AllRecordsTaggedIsSandboxTrue()
    {
        // Arrange
        var companyId = Guid.NewGuid().ToString();
        _context.Companies.Add(new Company
        {
            CompanyId = companyId, Name = "Tag Corp", Email = "tag@corp.com",
            PhoneNumber = string.Empty, Address = string.Empty, TimeZone = "UTC"
        });
        await _context.SaveChangesAsync();

        // Act
        await _sandboxService.SeedSandboxDataAsync(companyId);

        // Assert ALL seeded records have IsSandbox = true
        Assert.All(_context.Locations.Where(l => l.CompanyId == companyId), l => Assert.True(l.IsSandbox));
        Assert.All(_context.Areas.Where(a => a.CompanyId == companyId), a => Assert.True(a.IsSandbox));
        Assert.All(_context.Persons.Where(p => p.CompanyId == companyId), p => Assert.True(p.IsSandbox));
    }

    // ── Duplicate checks ──────────────────────────────────────────────────────

    [Fact]
    public async Task Register_DuplicateFirebaseUid_DetectedByQuery()
    {
        // Arrange
        var companyId = Guid.NewGuid().ToString();
        var uid = "firebase_uid_duplicate";
        _context.CompanyUsers.Add(new CompanyUser
        {
            CompanyUserId = Guid.NewGuid().ToString(),
            Uid = uid, Email = "dup@test.com", DisplayName = "Dup",
            PhotoURL = string.Empty,
            CompanyId = companyId, EmailVerified = false
        });
        await _context.SaveChangesAsync();

        // Act — simulate the duplicate UID check in AuthController
        var existing = await _context.CompanyUsers
            .FirstOrDefaultAsync(u => u.Uid == uid);

        // Assert — duplicate is found
        Assert.NotNull(existing);
    }

    [Fact]
    public async Task Register_DuplicateCompanyEmail_DetectedByQuery()
    {
        // Arrange
        var email = "existing@corp.com";
        _context.Companies.Add(new Company
        {
            CompanyId = Guid.NewGuid().ToString(), Name = "Existing", Email = email,
            PhoneNumber = string.Empty, Address = string.Empty, TimeZone = "UTC"
        });
        await _context.SaveChangesAsync();

        // Act — simulate the duplicate company email check in AuthController
        var existing = await _context.Companies
            .FirstOrDefaultAsync(c => c.Email == email);

        // Assert — duplicate is found
        Assert.NotNull(existing);
    }

    // ── Registration isolation ────────────────────────────────────────────────

    [Fact]
    public async Task Register_SandboxSeed_DoesNotAffectExistingNonSandboxRecords()
    {
        // Arrange — a real person that existed before onboarding
        var companyId = Guid.NewGuid().ToString();
        _context.Companies.Add(new Company
        {
            CompanyId = companyId, Name = "Mixed Corp", Email = "mixed@corp.com",
            PhoneNumber = string.Empty, Address = string.Empty, TimeZone = "UTC"
        });
        _context.Persons.Add(new Person
        {
            Name = "Real Employee", Email = "real@corp.com",
            CompanyId = companyId, Status = "Active", IsSandbox = false
        });
        await _context.SaveChangesAsync();

        // Act
        await _sandboxService.SeedSandboxDataAsync(companyId);

        // Assert — real employee is untouched
        var realPerson = await _context.Persons
            .FirstOrDefaultAsync(p => p.Name == "Real Employee");
        Assert.NotNull(realPerson);
        Assert.False(realPerson.IsSandbox);

        // And there are exactly 2 sandbox persons (not 3)
        var sandboxCount = _context.Persons.Count(p => p.CompanyId == companyId && p.IsSandbox);
        Assert.Equal(2, sandboxCount);
    }

    public void Dispose() => _context.Dispose();
}
