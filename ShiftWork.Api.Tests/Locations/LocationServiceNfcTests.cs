using System.Text.RegularExpressions;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Locations;

public class LocationServiceNfcTests : IDisposable
{
    private const string CompanyId = "nfc-co";
    private static readonly Regex KeyShape = new("^[A-Za-z0-9_-]{22}$");
    private readonly ShiftWorkContext _context;
    private readonly LocationService _service;

    public LocationServiceNfcTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ShiftWorkContext(options);
        _service = new LocationService(_context, NullLogger<LocationService>.Instance);
    }

    public void Dispose() => _context.Dispose();

    private static Location NewLocation(int id, string companyId = CompanyId, bool requireNfc = false, string status = "Active") => new()
    {
        LocationId = id, CompanyId = companyId, Name = $"Site {id}", Address = "1 Main",
        City = "", State = "", Country = "US", ZipCode = "00000", GeoCoordinates = "{}",
        RatioMax = 100, Status = status, TimeZone = "UTC", RequireNfc = requireNfc,
    };

    [Fact]
    public async Task Add_WithRequireNfc_CreatesAUrlSafeKey()
    {
        var created = await _service.Add(NewLocation(1, requireNfc: true));
        Assert.Matches(KeyShape, created.NfcTagKey);
    }

    [Fact]
    public async Task Add_WithoutRequireNfc_HasNoKey()
    {
        var created = await _service.Add(NewLocation(1));
        Assert.Null(created.NfcTagKey);
    }

    [Fact]
    public async Task Update_TurningRequireNfcOn_CreatesTheKeyOnce()
    {
        await _service.Add(NewLocation(1));

        var first = await _service.Update(NewLocation(1, requireNfc: true));
        var key = first.NfcTagKey;
        var second = await _service.Update(NewLocation(1, requireNfc: true));

        Assert.Matches(KeyShape, key);
        Assert.Equal(key, second.NfcTagKey);
    }

    [Fact]
    public async Task Update_TurningRequireNfcOff_KeepsTheKey()
    {
        var created = await _service.Add(NewLocation(1, requireNfc: true));
        var key = created.NfcTagKey;

        var updated = await _service.Update(NewLocation(1, requireNfc: false));

        Assert.False(updated.RequireNfc);
        Assert.Equal(key, updated.NfcTagKey);
    }

    [Fact]
    public async Task Update_KeepsServerKey_WhenClientSendsAnother()
    {
        var created = await _service.Add(NewLocation(1, requireNfc: true));
        var key = created.NfcTagKey;
        var fromClient = NewLocation(1, requireNfc: true);
        fromClient.NfcTagKey = "client-chosen-key-000000";
        fromClient.NfcLastTappedAt = DateTime.UtcNow;

        var updated = await _service.Update(fromClient);

        Assert.Equal(key, updated.NfcTagKey);
        Assert.Null(updated.NfcLastTappedAt);
    }

    [Fact]
    public async Task Regenerate_ReplacesTheKey_AndClearsLastTapped()
    {
        var created = await _service.Add(NewLocation(1, requireNfc: true));
        var oldKey = created.NfcTagKey;
        created.NfcLastTappedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var regenerated = await _service.RegenerateNfcTagAsync(CompanyId, 1);

        Assert.NotNull(regenerated);
        Assert.Matches(KeyShape, regenerated!.NfcTagKey);
        Assert.NotEqual(oldKey, regenerated.NfcTagKey);
        Assert.Null(regenerated.NfcLastTappedAt);
    }

    [Fact]
    public async Task Regenerate_WorksOnAnOptionalSite_WithoutRequireNfc()
    {
        await _service.Add(NewLocation(1));
        var regenerated = await _service.RegenerateNfcTagAsync(CompanyId, 1);
        Assert.Matches(KeyShape, regenerated!.NfcTagKey);
        Assert.False(regenerated.RequireNfc);
    }

    [Fact]
    public async Task Regenerate_ForAnotherCompany_ReturnsNull()
    {
        await _service.Add(NewLocation(1, companyId: "other-co"));
        Assert.Null(await _service.RegenerateNfcTagAsync(CompanyId, 1));
    }

    [Fact]
    public async Task GetNfcTagLinks_ListsActiveSitesOfTheCompany_WithTagUrls()
    {
        var tagged = await _service.Add(NewLocation(1, requireNfc: true));
        await _service.Add(NewLocation(2));
        await _service.Add(NewLocation(3, status: "Inactive"));
        await _service.Add(NewLocation(4, companyId: "other-co", requireNfc: true));

        var links = await _service.GetNfcTagLinksAsync(CompanyId);

        Assert.Equal(new[] { 1, 2 }, links.Select(l => l.LocationId).OrderBy(i => i).ToArray());
        var first = links.Single(l => l.LocationId == 1);
        Assert.Equal("https://t.loqzen.com/t/" + tagged.NfcTagKey, first.TagUrl);
        Assert.True(first.RequireNfc);
        Assert.Null(links.Single(l => l.LocationId == 2).TagUrl);
    }

    [Fact]
    public void DtoToModel_IgnoresTagFields()
    {
        var mapper = new MapperConfiguration(cfg => cfg.AddProfile<MappingProfiles>()).CreateMapper();
        var dto = new LocationDto { LocationId = 1, Name = "Site", RequireNfc = true, NfcTagKey = "from-client", NfcLastTappedAt = DateTime.UtcNow };

        var model = mapper.Map<Location>(dto);

        Assert.True(model.RequireNfc);
        Assert.Null(model.NfcTagKey);
        Assert.Null(model.NfcLastTappedAt);
    }

    [Fact]
    public void ModelToDto_ExposesTagFields()
    {
        var mapper = new MapperConfiguration(cfg => cfg.AddProfile<MappingProfiles>()).CreateMapper();
        var tappedAt = DateTime.UtcNow;
        var model = NewLocation(1, requireNfc: true);
        model.NfcTagKey = "abc";
        model.NfcLastTappedAt = tappedAt;

        var dto = mapper.Map<LocationDto>(model);

        Assert.True(dto.RequireNfc);
        Assert.Equal("abc", dto.NfcTagKey);
        Assert.Equal(tappedAt, dto.NfcLastTappedAt);
    }
}
