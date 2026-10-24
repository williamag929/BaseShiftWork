using System.Security.Claims;
using AutoMapper;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Registration;

/// <summary>
/// Drives POST /api/auth/register through AuthController (real RoleSeedService + AutoMapper,
/// in-memory database, mocked sandbox seeding) to cover self-serve company signup.
/// </summary>
public class RegisterEndpointTests : IDisposable
{
    private const string Uid = "firebase_uid_new_owner";

    private readonly ShiftWorkContext _context;
    private readonly IMapper _mapper;
    private readonly Mock<ISandboxService> _sandbox = new();

    public RegisterEndpointTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new ShiftWorkContext(options);
        _mapper = new MapperConfiguration(cfg => cfg.AddProfile<MappingProfiles>()).CreateMapper();

        // Two global permissions every company may use, plus one private to another tenant.
        _context.Permissions.AddRange(
            new Permission { PermissionId = 1, Key = "people.read", Name = "Read people" },
            new Permission { PermissionId = 2, Key = "people.write", Name = "Write people" },
            new Permission { PermissionId = 3, Key = "other.secret", Name = "Other tenant only", CompanyId = "other-co" });
        _context.SaveChanges();
    }

    public void Dispose() => _context.Dispose();

    private AuthController Controller(string? tokenUid = Uid)
    {
        var claims = tokenUid == null ? Array.Empty<Claim>() : new[] { new Claim(ClaimTypes.NameIdentifier, tokenUid) };
        return new AuthController(
            _context, _mapper, NullLogger<AuthController>.Instance, _sandbox.Object,
            new ConfigurationBuilder().Build(), new Mock<INotificationService>().Object,
            new RoleSeedService(_context))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")) },
            },
        };
    }

    private static CompanyRegistrationRequest Request(string uid = Uid, string companyEmail = "hello@acme.test") => new()
    {
        FirebaseUid = uid,
        UserEmail = "owner@acme.test",
        UserDisplayName = "Olga Owner",
        CompanyName = "Acme Crew",
        CompanyEmail = companyEmail,
        TimeZone = "America/New_York",
    };

    [Fact]
    public async Task Register_CreatesCompanyOwnerAndSeedsSandbox()
    {
        var result = await Controller().Register(Request());

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var body = Assert.IsType<CompanyRegistrationResponse>(created.Value);

        var company = await _context.Companies.SingleAsync(c => c.CompanyId == body.CompanyId);
        Assert.Equal("Acme Crew", company.Name);
        Assert.Equal("Pending", company.OnboardingStatus);
        Assert.NotNull(company.TrialEndsAt);

        var user = await _context.CompanyUsers.SingleAsync(u => u.Uid == Uid);
        Assert.Equal(body.CompanyId, user.CompanyId);

        _sandbox.Verify(s => s.SeedSandboxDataAsync(body.CompanyId), Times.Once);
    }

    [Fact]
    public async Task Register_GrantsTheNewCompanysOwnAdminRole_WithAllAllowedPermissions()
    {
        var body = (CompanyRegistrationResponse)((CreatedAtActionResult)(await Controller().Register(Request())).Result!).Value!;
        var user = await _context.CompanyUsers.SingleAsync(u => u.Uid == Uid);

        var userRole = await _context.UserRoles.SingleAsync(ur => ur.CompanyUserId == user.CompanyUserId);
        var role = await _context.Roles.SingleAsync(r => r.RoleId == userRole.RoleId);
        Assert.Equal(body.CompanyId, role.CompanyId);
        Assert.Equal(body.CompanyId, userRole.CompanyId);
        Assert.Equal(RoleSeedService.AdminRoleName, role.Name);

        var permissionIds = await _context.RolePermissions
            .Where(rp => rp.RoleId == role.RoleId)
            .Select(rp => rp.PermissionId)
            .OrderBy(id => id)
            .ToListAsync();
        Assert.Equal(new[] { 1, 2 }, permissionIds); // never the other tenant's private permission

        var profile = await _context.CompanyUserProfiles.SingleAsync(p => p.CompanyUserId == user.CompanyUserId);
        Assert.Equal(role.RoleId, profile.RoleId);
    }

    [Fact]
    public async Task Register_NeverReusesAnotherCompanysAdminRole()
    {
        _context.Companies.Add(new Company
        {
            CompanyId = "other-co", Name = "Other", Email = "other@co.test",
            PhoneNumber = string.Empty, Address = string.Empty, TimeZone = "UTC",
        });
        _context.Roles.Add(new Role { RoleId = 50, Name = "Admin", Description = "x", CompanyId = "other-co" });
        _context.Roles.Add(new Role { RoleId = 51, Name = "Owner", Description = "x", CompanyId = "other-co" });
        await _context.SaveChangesAsync();

        await Controller().Register(Request());

        var user = await _context.CompanyUsers.SingleAsync(u => u.Uid == Uid);
        var roleIds = await _context.UserRoles.Where(ur => ur.CompanyUserId == user.CompanyUserId).Select(ur => ur.RoleId).ToListAsync();
        Assert.DoesNotContain(50, roleIds);
        Assert.DoesNotContain(51, roleIds);
        Assert.False(await _context.CompanyUserProfiles.AnyAsync(p => p.RoleId == 50 || p.RoleId == 51));
    }

    [Fact]
    public async Task Register_WithoutToken_Is401()
    {
        var result = await Controller(tokenUid: null).Register(Request());
        Assert.IsType<UnauthorizedObjectResult>(result.Result);
        Assert.False(await _context.Companies.AnyAsync());
    }

    [Fact]
    public async Task Register_TokenForADifferentUid_Is400()
    {
        var result = await Controller(tokenUid: "someone_else").Register(Request());
        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.False(await _context.Companies.AnyAsync());
    }

    [Fact]
    public async Task Register_SameUidTwice_Is409()
    {
        await Controller().Register(Request());
        var second = await Controller().Register(Request(companyEmail: "second@acme.test"));
        Assert.IsType<ConflictObjectResult>(second.Result);
        Assert.Equal(1, await _context.Companies.CountAsync());
    }

    [Fact]
    public async Task Register_ExistingCompanyEmail_Is409()
    {
        await Controller().Register(Request());
        var second = await Controller(tokenUid: "another_uid").Register(Request(uid: "another_uid"));
        Assert.IsType<ConflictObjectResult>(second.Result);
    }
}
