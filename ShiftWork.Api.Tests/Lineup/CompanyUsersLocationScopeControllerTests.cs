using System.Reflection;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class CompanyUsersLocationScopeControllerTests
{
    private const string Co = "co-1";
    private const string Uid = "uid-1";

    private static CompanyUsersController Build(out Mock<IUserLocationScopeService> svc)
    {
        svc = new Mock<IUserLocationScopeService>();
        return new CompanyUsersController(
            new Mock<ICompanyUserService>().Object,
            new Mock<IUserRoleService>().Object,
            new Mock<ICompanyUserProfileService>().Object,
            NullLogger<CompanyUsersController>.Instance,
            new Mock<IMapper>().Object,
            svc.Object);
    }

    [Fact]
    public void Actions_carry_the_expected_policies()
    {
        string Policy(string method) =>
            typeof(CompanyUsersController).GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>()!.Policy!;
        Assert.Equal("company-users.read", Policy(nameof(CompanyUsersController.GetLocationScopes)));
        Assert.Equal("company-users.roles.update", Policy(nameof(CompanyUsersController.PutLocationScopes)));
    }

    [Fact]
    public async Task Get_returns_200_with_the_ids()
    {
        var c = Build(out var svc);
        svc.Setup(s => s.GetAsync(Co, Uid)).ReturnsAsync(new List<int> { 1, 3 });

        var ok = Assert.IsType<OkObjectResult>((await c.GetLocationScopes(Co, Uid)).Result);
        Assert.Equal(new List<int> { 1, 3 }, Assert.IsType<UserLocationScopeDto>(ok.Value).LocationIds);
    }

    [Fact]
    public async Task Get_returns_404_for_unknown_user()
    {
        var c = Build(out var svc);
        svc.Setup(s => s.GetAsync(Co, Uid)).ReturnsAsync((List<int>?)null);
        Assert.IsType<NotFoundObjectResult>((await c.GetLocationScopes(Co, Uid)).Result);
    }

    [Fact]
    public async Task Put_returns_200_with_the_stored_ids()
    {
        var c = Build(out var svc);
        svc.Setup(s => s.ReplaceAsync(Co, Uid, It.Is<IEnumerable<int>>(ids => ids.SequenceEqual(new[] { 3, 1 }))))
            .ReturnsAsync(new List<int> { 1, 3 });

        var ok = Assert.IsType<OkObjectResult>((await c.PutLocationScopes(Co, Uid, new UserLocationScopeDto(new List<int> { 3, 1 }))).Result);
        Assert.Equal(new List<int> { 1, 3 }, Assert.IsType<UserLocationScopeDto>(ok.Value).LocationIds);
    }

    [Fact]
    public async Task Put_returns_404_for_unknown_user()
    {
        var c = Build(out var svc);
        svc.Setup(s => s.ReplaceAsync(Co, Uid, It.IsAny<IEnumerable<int>>())).ReturnsAsync((List<int>?)null);
        Assert.IsType<NotFoundObjectResult>((await c.PutLocationScopes(Co, Uid, new UserLocationScopeDto(new List<int> { 1 }))).Result);
    }

    [Fact]
    public async Task Put_returns_400_with_the_exception_message()
    {
        var c = Build(out var svc);
        svc.Setup(s => s.ReplaceAsync(Co, Uid, It.IsAny<IEnumerable<int>>()))
            .ThrowsAsync(new InvalidOperationException("Unknown locations: 3, 9"));

        var bad = Assert.IsType<BadRequestObjectResult>((await c.PutLocationScopes(Co, Uid, new UserLocationScopeDto(new List<int> { 3, 9 }))).Result);
        var message = bad.Value!.GetType().GetProperty("message")!.GetValue(bad.Value);
        Assert.Equal("Unknown locations: 3, 9", message);
    }
}
