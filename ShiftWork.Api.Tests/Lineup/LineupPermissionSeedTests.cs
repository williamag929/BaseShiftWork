using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class LineupPermissionSeedTests
{
    [Theory]
    [InlineData("lineup.view")]
    [InlineData("lineup.edit")]
    [InlineData("lineup.all-locations")]
    public async Task Seed_creates_lineup_permission(string key)
    {
        await using var ctx = LineupTestData.NewContext();
        await new PermissionSeedService(ctx).SeedAsync();
        Assert.True(await ctx.Permissions.AnyAsync(p => p.Key == key));
    }

    [Fact]
    public async Task Scope_rows_are_unique_per_company_user_location()
    {
        await using var ctx = LineupTestData.NewContext();
        var entity = ctx.Model.FindEntityType(typeof(ShiftWork.Api.Models.UserLocationScope))!;
        var index = entity.GetIndexes().Single(i => i.IsUnique);
        Assert.Equal(new[] { "CompanyId", "CompanyUserId", "LocationId" },
            index.Properties.Select(p => p.Name).ToArray());
    }
}
