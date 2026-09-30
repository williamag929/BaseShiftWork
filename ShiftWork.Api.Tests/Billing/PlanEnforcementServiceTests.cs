using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using ShiftWork.Api.Data;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Billing;

public class PlanEnforcementServiceTests : IDisposable
{
    private static readonly DateTimeOffset Now = new(2026, 9, 28, 12, 0, 0, TimeSpan.Zero);
    private readonly ShiftWorkContext _ctx;
    private readonly PlanEnforcementService _sut;
    private readonly PeopleService _people;

    public PlanEnforcementServiceTests()
    {
        _ctx = new ShiftWorkContext(new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var plans = new PlanService(_ctx, NullLogger<PlanService>.Instance, new FakeTimeProvider(Now));
        _sut = new PlanEnforcementService(_ctx, plans);
        _people = new PeopleService(_ctx, NullLogger<PeopleService>.Instance, _sut);
    }

    private void Company(string plan = "Free", string? status = null, DateTime? trialEnds = null) =>
        _ctx.Companies.Add(new Company { CompanyId = "c1", Name = "C", Email = "c@t.com", Address = "", PhoneNumber = "",
            TimeZone = "UTC", Plan = plan, SubscriptionStatus = status, TrialEndsAt = trialEnds });

    private void People(int n, string status = "Active", bool sandbox = false)
    {
        for (var i = 0; i < n; i++)
            _ctx.Persons.Add(new Person { Name = $"p{i}", Email = $"{Guid.NewGuid()}@t.com", CompanyId = "c1", Status = status, IsSandbox = sandbox });
    }

    [Fact]
    public async Task UnderCap_Passes()
    {
        Company(); People(4); await _ctx.SaveChangesAsync();
        await _sut.EnsureCanActivateEmployeeAsync("c1");
    }

    [Fact]
    public async Task AtCap_Throws_WithDetails()
    {
        Company(); People(5); await _ctx.SaveChangesAsync();
        var ex = await Assert.ThrowsAsync<PlanLimitExceededException>(() => _sut.EnsureCanActivateEmployeeAsync("c1"));
        Assert.Equal(("Free", 5, 5), (ex.Tier, ex.Cap, ex.Count));
    }

    [Fact]
    public async Task InactiveAndSandbox_AreNotCounted()
    {
        Company(); People(4); People(3, "Inactive"); People(10, sandbox: true); await _ctx.SaveChangesAsync();
        await _sut.EnsureCanActivateEmployeeAsync("c1");
    }

    [Fact]
    public async Task Trial_UsesProCap()
    {
        Company(trialEnds: Now.UtcDateTime.AddDays(2)); People(99); await _ctx.SaveChangesAsync();
        await _sut.EnsureCanActivateEmployeeAsync("c1");
    }

    [Fact]
    public async Task PastDueStarter_KeepsStarterCap()
    {
        Company("Starter", "past_due"); People(24); await _ctx.SaveChangesAsync();
        await _sut.EnsureCanActivateEmployeeAsync("c1");
    }

    [Fact]
    public async Task Business_IsUnlimited()
    {
        Company("Business", "active"); People(500); await _ctx.SaveChangesAsync();
        await _sut.EnsureCanActivateEmployeeAsync("c1");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("active")]
    [InlineData("Active")]
    public async Task PeopleAdd_NullOrAnyCaseActive_IsGuarded(string? status)
    {
        Company(); People(5); await _ctx.SaveChangesAsync();
        await Assert.ThrowsAsync<PlanLimitExceededException>(() =>
            _people.Add(new Person { Name = "n", Email = "n@t.com", CompanyId = "c1", Status = status! }));
    }

    [Fact]
    public async Task PeopleAdd_Sandbox_IsExempt()
    {
        Company(); People(5); await _ctx.SaveChangesAsync();
        await _people.Add(new Person { Name = "s", Email = "s@t.com", CompanyId = "c1", Status = "Active", IsSandbox = true });
    }

    [Fact]
    public async Task Reactivation_IsGuarded_ButInactiveEdit_IsNot()
    {
        Company(); People(5); People(1, "Inactive"); await _ctx.SaveChangesAsync();
        var inactive = await _ctx.Persons.FirstAsync(p => p.Status == "Inactive");

        await _people.UpdatePersonStatus(inactive.PersonId, "Inactive");
        await Assert.ThrowsAsync<PlanLimitExceededException>(() => _people.UpdatePersonStatus(inactive.PersonId, "Active"));

        var edit = new Person { PersonId = inactive.PersonId, CompanyId = "c1", Name = "x", Email = inactive.Email, Status = "Active" };
        await Assert.ThrowsAsync<PlanLimitExceededException>(() => _people.Update(edit));
    }

    [Fact]
    public async Task EditingAnAlreadyActivePerson_OverCap_IsAllowed()
    {
        Company(); People(7); await _ctx.SaveChangesAsync();
        var p = await _ctx.Persons.FirstAsync();
        await _people.Update(new Person { PersonId = p.PersonId, CompanyId = "c1", Name = "renamed", Email = p.Email, Status = "Active" });
    }

    public void Dispose() => _ctx.Dispose();
}
