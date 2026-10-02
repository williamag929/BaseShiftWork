using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class UserLocationScopeServiceTests
{
    private const string Co = LineupTestData.CompanyId;
    private const string OtherCo = "other-co";

    private static (ShiftWorkContext ctx, UserLocationScopeService svc) Build()
    {
        var ctx = LineupTestData.NewContext();
        ctx.Companies.AddRange(LineupTestData.Company(), LineupTestData.Company(OtherCo));
        ctx.Locations.AddRange(
            LineupTestData.Location(1, "A"),
            LineupTestData.Location(2, "B"),
            LineupTestData.Location(3, "C"),
            LineupTestData.Location(4, "Closed", status: "Inactive"),
            LineupTestData.Location(9, "Foreign", companyId: OtherCo));
        ctx.CompanyUsers.AddRange(
            new CompanyUser { CompanyUserId = "cu-1", Uid = "uid-1", Email = "1@x.com", DisplayName = "One", CompanyId = Co },
            new CompanyUser { CompanyUserId = "cu-2", Uid = "uid-2", Email = "2@x.com", DisplayName = "Two", CompanyId = Co },
            new CompanyUser { CompanyUserId = "cu-x", Uid = "uid-x", Email = "x@x.com", DisplayName = "Other", CompanyId = OtherCo });
        ctx.SaveChanges();
        return (ctx, new UserLocationScopeService(ctx));
    }

    private static void Scope(ShiftWorkContext ctx, string companyUserId, int locationId, string companyId = Co)
    {
        ctx.UserLocationScopes.Add(new UserLocationScope { CompanyId = companyId, CompanyUserId = companyUserId, LocationId = locationId });
        ctx.SaveChanges();
    }

    private static List<int> Rows(ShiftWorkContext ctx, string companyUserId) =>
        ctx.UserLocationScopes.Where(s => s.CompanyUserId == companyUserId).Select(s => s.LocationId).OrderBy(i => i).ToList();

    [Fact]
    public async Task Get_returns_sorted_ids()
    {
        var (ctx, svc) = Build();
        Scope(ctx, "cu-1", 3);
        Scope(ctx, "cu-1", 1);
        Assert.Equal(new List<int> { 1, 3 }, await svc.GetAsync(Co, "uid-1"));
    }

    [Fact]
    public async Task Get_ignores_other_users_and_other_companies()
    {
        var (ctx, svc) = Build();
        Scope(ctx, "cu-1", 1);
        Scope(ctx, "cu-2", 2);
        Scope(ctx, "cu-1", 9, OtherCo);
        Assert.Equal(new List<int> { 1 }, await svc.GetAsync(Co, "uid-1"));
    }

    [Fact]
    public async Task Get_returns_null_for_unknown_user()
    {
        var (_, svc) = Build();
        Assert.Null(await svc.GetAsync(Co, "nobody"));
        Assert.Null(await svc.GetAsync(Co, "uid-x"));
    }

    [Fact]
    public async Task Replace_adds_removes_and_keeps_in_one_save()
    {
        var (ctx, svc) = Build();
        Scope(ctx, "cu-1", 1);
        Scope(ctx, "cu-1", 2);

        var stored = await svc.ReplaceAsync(Co, "uid-1", new[] { 2, 3 });

        Assert.Equal(new List<int> { 2, 3 }, stored);
        Assert.Equal(new List<int> { 2, 3 }, Rows(ctx, "cu-1"));
        Assert.All(ctx.UserLocationScopes.Where(s => s.CompanyUserId == "cu-1"), s => Assert.Equal(Co, s.CompanyId));
    }

    [Fact]
    public async Task Replace_dedupes_ids()
    {
        var (ctx, svc) = Build();
        var stored = await svc.ReplaceAsync(Co, "uid-1", new[] { 3, 1, 3, 1 });
        Assert.Equal(new List<int> { 1, 3 }, stored);
        Assert.Equal(new List<int> { 1, 3 }, Rows(ctx, "cu-1"));
    }

    [Fact]
    public async Task Replace_with_empty_list_removes_all_rows()
    {
        var (ctx, svc) = Build();
        Scope(ctx, "cu-1", 1);
        Scope(ctx, "cu-1", 2);

        var stored = await svc.ReplaceAsync(Co, "uid-1", Array.Empty<int>());

        Assert.Empty(stored!);
        Assert.Empty(Rows(ctx, "cu-1"));
    }

    [Fact]
    public async Task Replace_rejects_unknown_location_and_writes_nothing()
    {
        var (ctx, svc) = Build();
        Scope(ctx, "cu-1", 1);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => svc.ReplaceAsync(Co, "uid-1", new[] { 2, 9 }));

        Assert.Equal("Unknown locations: 9", ex.Message);
        Assert.Equal(new List<int> { 1 }, Rows(ctx, "cu-1"));
    }

    [Fact]
    public async Task Replace_rejects_location_of_another_company()
    {
        var (ctx, svc) = Build();
        // 9 exists, but belongs to OtherCo.
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => svc.ReplaceAsync(Co, "uid-1", new[] { 9 }));
        Assert.Equal("Unknown locations: 9", ex.Message);
        Assert.Empty(Rows(ctx, "cu-1"));
    }

    [Fact]
    public async Task Replace_keeps_inactive_location()
    {
        var (ctx, svc) = Build();
        var stored = await svc.ReplaceAsync(Co, "uid-1", new[] { 4 });
        Assert.Equal(new List<int> { 4 }, stored);
        Assert.Equal(new List<int> { 4 }, Rows(ctx, "cu-1"));
    }

    [Fact]
    public async Task Replace_does_not_touch_other_users()
    {
        var (ctx, svc) = Build();
        Scope(ctx, "cu-2", 1);
        Scope(ctx, "cu-2", 2);

        await svc.ReplaceAsync(Co, "uid-1", new[] { 3 });

        Assert.Equal(new List<int> { 1, 2 }, Rows(ctx, "cu-2"));
    }

    [Fact]
    public async Task Replace_returns_null_for_unknown_user()
    {
        var (ctx, svc) = Build();
        Assert.Null(await svc.ReplaceAsync(Co, "nobody", new[] { 1 }));
        Assert.Empty(ctx.UserLocationScopes);
    }
}
