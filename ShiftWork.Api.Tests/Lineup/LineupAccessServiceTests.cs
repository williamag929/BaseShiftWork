using System.Security.Claims;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class LineupAccessServiceTests
{
    private const string Co = LineupTestData.CompanyId;

    private static ClaimsPrincipal User(string uid, string? email = null)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, uid) };
        if (email != null) claims.Add(new Claim(ClaimTypes.Email, email));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
    }

    private static async Task GrantAsync(ShiftWorkContext ctx, string companyUserId, params string[] keys)
    {
        var role = new Role { Name = "r-" + companyUserId, Description = "", CompanyId = Co, Status = "Active" };
        ctx.Roles.Add(role);
        await ctx.SaveChangesAsync();
        foreach (var k in keys)
        {
            var perm = ctx.Permissions.FirstOrDefault(p => p.Key == k) ?? ctx.Permissions.Add(new Permission { Key = k, Name = k }).Entity;
            await ctx.SaveChangesAsync();
            ctx.RolePermissions.Add(new RolePermission { RoleId = role.RoleId, PermissionId = perm.PermissionId });
        }
        await ctx.SaveChangesAsync();
        ctx.UserRoles.Add(new UserRole { CompanyUserId = companyUserId, RoleId = role.RoleId, CompanyId = Co });
        await ctx.SaveChangesAsync();
    }

    private static async Task<ShiftWorkContext> SeedAsync()
    {
        var ctx = LineupTestData.NewContext();
        ctx.CompanyUsers.AddRange(
            new CompanyUser { CompanyUserId = "cu-foreman", Uid = "uid-foreman", Email = "f@x.com", DisplayName = "F", CompanyId = Co },
            new CompanyUser { CompanyUserId = "cu-boss", Uid = "uid-boss", Email = "b@x.com", DisplayName = "B", CompanyId = Co },
            new CompanyUser { CompanyUserId = "cu-other", Uid = "uid-other", Email = "o@x.com", DisplayName = "O", CompanyId = "other-co" });
        ctx.UserLocationScopes.AddRange(
            new UserLocationScope { CompanyId = Co, CompanyUserId = "cu-foreman", LocationId = 7 },
            new UserLocationScope { CompanyId = "other-co", CompanyUserId = "cu-foreman", LocationId = 99 });
        await ctx.SaveChangesAsync();
        await GrantAsync(ctx, "cu-foreman", "lineup.view", "lineup.edit");
        await GrantAsync(ctx, "cu-boss", "lineup.view", "lineup.edit", "lineup.all-locations");
        return ctx;
    }

    [Fact]
    public async Task Foreman_is_scoped_to_assigned_sites_in_this_company_only()
    {
        await using var ctx = await SeedAsync();
        var a = await new LineupAccessService(ctx).ResolveAsync(User("uid-foreman"), Co);
        Assert.NotNull(a);
        Assert.True(a!.CanEdit);
        Assert.False(a.AllLocations);
        Assert.True(a.CanSeeLocation(7));
        Assert.False(a.CanSeeLocation(8));
        Assert.False(a.CanSeeLocation(99));
    }

    [Fact]
    public async Task All_locations_permission_sees_every_site()
    {
        await using var ctx = await SeedAsync();
        var a = await new LineupAccessService(ctx).ResolveAsync(User("uid-boss"), Co);
        Assert.True(a!.AllLocations);
        Assert.True(a.CanSeeLocation(12345));
    }

    [Fact]
    public async Task View_only_user_cannot_edit()
    {
        await using var ctx = await SeedAsync();
        await GrantAsync(ctx, "cu-boss-view", "lineup.view");
        ctx.CompanyUsers.Add(new CompanyUser { CompanyUserId = "cu-boss-view", Uid = "uid-view", Email = "v@x.com", DisplayName = "V", CompanyId = Co });
        await ctx.SaveChangesAsync();
        var a = await new LineupAccessService(ctx).ResolveAsync(User("uid-view"), Co);
        Assert.False(a!.CanEdit);
    }

    [Fact]
    public async Task Email_fallback_matches_invite_accepted_users()
    {
        await using var ctx = await SeedAsync();
        var a = await new LineupAccessService(ctx).ResolveAsync(User("some-person-id", "f@x.com"), Co);
        Assert.Equal("cu-foreman", a!.CompanyUserId);
    }

    [Fact]
    public async Task User_from_another_company_resolves_to_null()
    {
        await using var ctx = await SeedAsync();
        Assert.Null(await new LineupAccessService(ctx).ResolveAsync(User("uid-other"), Co));
    }
}
