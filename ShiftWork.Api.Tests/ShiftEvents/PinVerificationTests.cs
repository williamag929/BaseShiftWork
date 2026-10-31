using System.Net;
using System.Reflection;
using AutoMapper;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
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

namespace ShiftWork.Api.Tests.ShiftEvents;

/// <summary>
/// Company-scoped PIN verification (POST /api/companies/{companyId}/people/{personId}/verify-pin),
/// the deprecated /api/auth/verify-pin, and their rate-limit wiring.
/// </summary>
public class PinVerificationTests : IDisposable
{
    private const string CoA = "company-a";
    private const string CoB = "company-b";
    private const string Pin = "4321";
    private const int AnaId = 1;   // company A, has a PIN
    private const int BenId = 2;   // company A, no PIN
    private const int CarlaId = 3; // company B, same PIN as Ana

    private readonly ShiftWorkContext _context;

    public PinVerificationTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ShiftWorkContext(options);
        var hash = BCrypt.Net.BCrypt.HashPassword(Pin);
        _context.Persons.AddRange(
            new Person { PersonId = AnaId, CompanyId = CoA, Name = "Ana", Email = "ana@example.com", Status = "Active", Pin = hash },
            new Person { PersonId = BenId, CompanyId = CoA, Name = "Ben", Email = "ben@example.com", Status = "Active", Pin = null },
            new Person { PersonId = CarlaId, CompanyId = CoB, Name = "Carla", Email = "carla@example.com", Status = "Active", Pin = hash });
        _context.SaveChanges();
    }

    public void Dispose() => _context.Dispose();

    private PeopleController People() => new(
        new Mock<IPeopleService>().Object, new Mock<IShiftEventService>().Object,
        new Mock<ICompanyUserService>().Object, new Mock<ICompanyUserProfileService>().Object,
        new Mock<IMapper>().Object, new MemoryCache(new MemoryCacheOptions()),
        NullLogger<PeopleController>.Instance, new Mock<IWebhookService>().Object,
        new Mock<INotificationService>().Object, new Mock<IAuditLogService>().Object, _context);

    private static bool? Verified(ActionResult<PinVerificationResponse> result) =>
        (Assert.IsType<OkObjectResult>(result.Result).Value as PinVerificationResponse)?.Verified;

    // ── Company-scoped route ──────────────────────────────────────────────────

    [Fact]
    public async Task CompanyRoute_RightPin_IsVerified()
    {
        var result = await People().VerifyPin(CoA, AnaId, new CompanyPinVerificationRequest { Pin = Pin });
        Assert.True(Verified(result));
    }

    [Fact]
    public async Task CompanyRoute_WrongPin_IsNotVerified()
    {
        var result = await People().VerifyPin(CoA, AnaId, new CompanyPinVerificationRequest { Pin = "0000" });
        Assert.False(Verified(result));
    }

    [Fact]
    public async Task CompanyRoute_PersonOfAnotherCompany_Is404()
    {
        // Carla has the same PIN, but she belongs to company B: company A's kiosk can't test it.
        var result = await People().VerifyPin(CoA, CarlaId, new CompanyPinVerificationRequest { Pin = Pin });
        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Theory]
    [InlineData(BenId)] // no PIN set
    [InlineData(999)]   // no such person
    public async Task CompanyRoute_NoPinOrUnknownPerson_Is404(int personId)
    {
        var result = await People().VerifyPin(CoA, personId, new CompanyPinVerificationRequest { Pin = Pin });
        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task CompanyRoute_EmptyPin_Is404()
    {
        var result = await People().VerifyPin(CoA, AnaId, new CompanyPinVerificationRequest { Pin = "" });
        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    // (The deprecated /api/auth/verify-pin is covered in ClockInOutIntegrationTests.)

    // ── Rate-limit wiring ─────────────────────────────────────────────────────

    [Fact]
    public void Endpoints_AreAnonymousButRateLimited()
    {
        var scoped = typeof(PeopleController).GetMethod(nameof(PeopleController.VerifyPin))!;
        Assert.Equal(RateLimitPolicies.PinVerify, scoped.GetCustomAttribute<EnableRateLimitingAttribute>()?.PolicyName);
        Assert.NotNull(scoped.GetCustomAttribute<Microsoft.AspNetCore.Authorization.AllowAnonymousAttribute>());

        var legacy = typeof(AuthController).GetMethod(nameof(AuthController.VerifyPin))!;
        Assert.Equal(RateLimitPolicies.PinVerifyLegacy, legacy.GetCustomAttribute<EnableRateLimitingAttribute>()?.PolicyName);
    }

    [Fact]
    public void PartitionKey_SeparatesPeopleAndCompanies_ButNotRepeatTries()
    {
        static string Key(string ip, string company, int person)
        {
            var ctx = new DefaultHttpContext();
            ctx.Connection.RemoteIpAddress = IPAddress.Parse(ip);
            ctx.Request.RouteValues["companyId"] = company;
            ctx.Request.RouteValues["personId"] = person.ToString();
            return RateLimitPolicies.PinVerifyPartitionKey(ctx);
        }

        Assert.Equal(Key("10.0.0.1", CoA, AnaId), Key("10.0.0.1", CoA, AnaId));
        Assert.NotEqual(Key("10.0.0.1", CoA, AnaId), Key("10.0.0.1", CoA, BenId));
        Assert.NotEqual(Key("10.0.0.1", CoA, AnaId), Key("10.0.0.1", CoB, AnaId));
    }
}
