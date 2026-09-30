using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Plan;

public class PlanServiceTests : IDisposable
{
    private static readonly DateTimeOffset Now = new(2026, 9, 28, 12, 0, 0, TimeSpan.Zero);
    private readonly ShiftWorkContext _context;
    private readonly PlanService _svc;

    public PlanServiceTests()
    {
        _context = new ShiftWorkContext(new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        _svc = new PlanService(_context, NullLogger<PlanService>.Instance, new FakeTimeProvider(Now));
    }

    private async Task<string> AddCompany(string plan, string? status = null, DateTime? trialEnds = null)
    {
        var id = Guid.NewGuid().ToString();
        _context.Companies.Add(new Company
        {
            CompanyId = id, Name = "C", Email = $"{id}@t.com", PhoneNumber = "", Address = "", TimeZone = "UTC",
            Plan = plan, SubscriptionStatus = status, TrialEndsAt = trialEnds
        });
        await _context.SaveChangesAsync();
        return id;
    }

    [Fact]
    public async Task Free_NoTrial_CannotDeleteSandbox()
        => Assert.False(await _svc.IsFeatureEnabledAsync(await AddCompany("Free"), "sandbox.delete"));

    [Fact]
    public async Task ActiveTrial_GetsProFeatures()
    {
        var id = await AddCompany("Free", null, Now.UtcDateTime.AddDays(3));
        Assert.True(await _svc.IsFeatureEnabledAsync(id, "analytics"));
        Assert.Equal("Pro", await _svc.GetCurrentPlanAsync(id));
    }

    [Fact]
    public async Task ActiveStarter_HasSandboxDelete_ButNotAnalytics()
    {
        var id = await AddCompany("Starter", "active");
        Assert.True(await _svc.IsFeatureEnabledAsync(id, "sandbox.delete"));
        Assert.False(await _svc.IsFeatureEnabledAsync(id, "analytics"));
    }

    [Fact]
    public async Task CanceledPro_IsFree()
        => Assert.Equal("Free", await _svc.GetCurrentPlanAsync(await AddCompany("Pro", "canceled")));

    [Fact]
    public async Task MissingCompany_IsFree()
    {
        var p = await _svc.GetEffectivePlanAsync("nope");
        Assert.Equal("Free", p.Tier);
        Assert.False(await _svc.IsFeatureEnabledAsync("nope", "sandbox.delete"));
    }

    [Fact]
    public async Task FeatureKey_IsCaseInsensitive()
        => Assert.True(await _svc.IsFeatureEnabledAsync(await AddCompany("Pro", "active"), "SANDBOX.DELETE"));

    public void Dispose() => _context.Dispose();
}
