using System.Text.Json.Nodes;
using AutoMapper;
using Microsoft.Extensions.Logging.Abstractions;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using ShiftWork.Api.Tests.Lineup;
using Xunit;

namespace ShiftWork.Api.Tests.Locations;

public class LocationDefaultShiftServiceTests
{
    private const string Co = LineupTestData.CompanyId;

    private static (ShiftWorkContext ctx, LocationService svc) Build(string? settings = null)
    {
        var ctx = LineupTestData.NewContext();
        ctx.Companies.Add(LineupTestData.Company());
        ctx.Locations.Add(LineupTestData.Location(1, "Site A", settings: settings));
        ctx.SaveChanges();
        return (ctx, new LocationService(ctx, NullLogger<LocationService>.Instance));
    }

    private static Area NewArea(int id, int locationId, string companyId = Co) =>
        new() { AreaId = id, Name = $"Area {id}", CompanyId = companyId, LocationId = locationId };

    private static Location Reload(ShiftWorkContext ctx, int id = 1) => ctx.Locations.Single(l => l.LocationId == id);

    [Fact]
    public async Task Set_writes_json_that_TryParse_reads_back()
    {
        var (ctx, svc) = Build();
        ctx.Areas.Add(NewArea(12, 1));
        ctx.SaveChanges();

        var stored = await svc.SetDefaultShiftAsync(Co, 1, new DefaultShiftDto("07:00", "15:30", 12));

        Assert.Equal(new DefaultShiftDto("07:00", "15:30", 12), stored);
        var parsed = LocationDefaultShift.TryParse(Reload(ctx).Settings);
        Assert.Equal(new LocationDefaultShift(new TimeOnly(7, 0), new TimeOnly(15, 30), 12), parsed);
    }

    [Fact]
    public async Task Set_preserves_other_settings_keys()
    {
        var (ctx, svc) = Build("{\"theme\":\"x\"}");
        await svc.SetDefaultShiftAsync(Co, 1, new DefaultShiftDto("07:00", "15:30", null));

        var root = JsonNode.Parse(Reload(ctx).Settings!)!.AsObject();
        Assert.Equal("x", (string?)root["theme"]);
        Assert.NotNull(root["defaultShift"] as JsonObject);
    }

    [Fact]
    public async Task Set_replaces_an_existing_default_shift()
    {
        var (ctx, svc) = Build("{\"defaultShift\":{\"start\":\"06:00\",\"end\":\"14:00\"}}");
        await svc.SetDefaultShiftAsync(Co, 1, new DefaultShiftDto("08:00", "16:00", null));

        var parsed = LocationDefaultShift.TryParse(Reload(ctx).Settings);
        Assert.Equal(new LocationDefaultShift(new TimeOnly(8, 0), new TimeOnly(16, 0), null), parsed);
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("[1,2]")]
    [InlineData("\"str\"")]
    public async Task Set_with_invalid_existing_json_starts_a_fresh_object(string existing)
    {
        var (ctx, svc) = Build(existing);
        await svc.SetDefaultShiftAsync(Co, 1, new DefaultShiftDto("07:00", "15:00", null));

        var root = JsonNode.Parse(Reload(ctx).Settings!)!.AsObject();
        Assert.Equal(new[] { "defaultShift" }, root.Select(kv => kv.Key).ToArray());
        Assert.NotNull(LocationDefaultShift.TryParse(Reload(ctx).Settings));
    }

    [Fact]
    public async Task Set_accepts_overnight()
    {
        var (ctx, svc) = Build();
        await svc.SetDefaultShiftAsync(Co, 1, new DefaultShiftDto("22:00", "06:00", null));

        var parsed = LocationDefaultShift.TryParse(Reload(ctx).Settings);
        Assert.Equal(new LocationDefaultShift(new TimeOnly(22, 0), new TimeOnly(6, 0), null), parsed);
    }

    [Fact]
    public async Task Set_rejects_equal_times()
    {
        var (_, svc) = Build();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.SetDefaultShiftAsync(Co, 1, new DefaultShiftDto("07:00", "07:00", null)));
    }

    [Theory]
    [InlineData("7:00", "15:00")]
    [InlineData("07:00:00", "15:00")]
    [InlineData("abc", "15:00")]
    [InlineData(null, "15:00")]
    [InlineData("07:00", "7:00")]
    [InlineData("07:00", null)]
    public async Task Set_rejects_non_HHmm(string? start, string? end)
    {
        var (ctx, svc) = Build();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.SetDefaultShiftAsync(Co, 1, new DefaultShiftDto(start!, end!, null)));
        Assert.Null(Reload(ctx).Settings);
    }

    [Fact]
    public async Task Set_rejects_area_from_another_location()
    {
        var (ctx, svc) = Build();
        ctx.Locations.Add(LineupTestData.Location(2, "Site B"));
        ctx.Areas.Add(NewArea(20, 2));
        ctx.SaveChanges();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.SetDefaultShiftAsync(Co, 1, new DefaultShiftDto("07:00", "15:00", 20)));
    }

    [Fact]
    public async Task Set_rejects_area_from_another_company()
    {
        var (ctx, svc) = Build();
        ctx.Companies.Add(LineupTestData.Company("other-co"));
        ctx.Areas.Add(NewArea(30, 1, "other-co"));
        ctx.SaveChanges();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.SetDefaultShiftAsync(Co, 1, new DefaultShiftDto("07:00", "15:00", 30)));
    }

    [Fact]
    public async Task Set_accepts_null_area()
    {
        var (_, svc) = Build();
        var stored = await svc.SetDefaultShiftAsync(Co, 1, new DefaultShiftDto("07:00", "15:00", null));
        Assert.Null(stored!.AreaId);
    }

    [Fact]
    public async Task Set_returns_null_for_unknown_location()
    {
        var (_, svc) = Build();
        Assert.Null(await svc.SetDefaultShiftAsync(Co, 999, new DefaultShiftDto("07:00", "15:00", null)));
    }

    [Fact]
    public async Task Set_returns_null_for_other_companys_location()
    {
        var (ctx, svc) = Build();
        ctx.Companies.Add(LineupTestData.Company("other-co"));
        ctx.Locations.Add(LineupTestData.Location(5, "Foreign", companyId: "other-co"));
        ctx.SaveChanges();

        Assert.Null(await svc.SetDefaultShiftAsync(Co, 5, new DefaultShiftDto("07:00", "15:00", null)));
        Assert.Null(Reload(ctx, 5).Settings);
    }

    [Fact]
    public async Task Clear_removes_only_the_defaultShift_key()
    {
        var (ctx, svc) = Build("{\"theme\":\"x\",\"defaultShift\":{\"start\":\"07:00\",\"end\":\"15:00\"}}");
        Assert.True(await svc.ClearDefaultShiftAsync(Co, 1));

        var root = JsonNode.Parse(Reload(ctx).Settings!)!.AsObject();
        Assert.Equal("x", (string?)root["theme"]);
        Assert.False(root.ContainsKey("defaultShift"));
    }

    [Fact]
    public async Task Clear_sets_Settings_to_null_when_nothing_else_remains()
    {
        var (ctx, svc) = Build("{\"defaultShift\":{\"start\":\"07:00\",\"end\":\"15:00\"}}");
        Assert.True(await svc.ClearDefaultShiftAsync(Co, 1));
        Assert.Null(Reload(ctx).Settings);
    }

    [Fact]
    public async Task Clear_returns_false_for_unknown_location()
    {
        var (_, svc) = Build();
        Assert.False(await svc.ClearDefaultShiftAsync(Co, 999));
    }

    [Fact]
    public async Task Update_preserves_settings()
    {
        const string original = "{\"defaultShift\":{\"start\":\"07:00\",\"end\":\"15:00\"}}";
        var (ctx, svc) = Build(original);

        var edited = LineupTestData.Location(1, "Renamed", settings: null);
        await svc.Update(edited);

        var saved = Reload(ctx);
        Assert.Equal("Renamed", saved.Name);
        Assert.Equal(original, saved.Settings);
    }

    private static IMapper Mapper() =>
        new MapperConfiguration(c => c.AddProfile<MappingProfiles>()).CreateMapper();

    [Fact]
    public void Mapping_fills_DefaultShift_from_Settings()
    {
        var loc = LineupTestData.Location(1, "A",
            settings: "{\"defaultShift\":{\"start\":\"07:00\",\"end\":\"15:30\",\"areaId\":12}}");
        var dto = Mapper().Map<LocationDto>(loc);
        Assert.Equal(new DefaultShiftDto("07:00", "15:30", 12), dto.DefaultShift);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("not json")]
    [InlineData("{\"defaultShift\":{\"start\":\"7:00\",\"end\":\"15:30\"}}")]
    public void Mapping_leaves_DefaultShift_null_for_bad_or_missing_json(string? settings)
    {
        var dto = Mapper().Map<LocationDto>(LineupTestData.Location(1, "A", settings: settings));
        Assert.Null(dto.DefaultShift);
    }

    [Fact]
    public void Mapping_dto_to_model_leaves_Settings_null()
    {
        var dto = new LocationDto { LocationId = 1, Name = "A", CompanyId = Co, DefaultShift = new DefaultShiftDto("07:00", "15:30", 12) };
        var loc = Mapper().Map<Location>(dto);
        Assert.Null(loc.Settings);
    }
}
