using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class LineupControllerTests
{
    private const string Co = LineupTestData.CompanyId;

    private static LineupController Build(LineupAccess? access, out Mock<ILineupQueryService> query, out Mock<ILineupCommitService> commit)
    {
        var accessSvc = new Mock<ILineupAccessService>();
        accessSvc.Setup(a => a.ResolveAsync(It.IsAny<ClaimsPrincipal>(), Co)).ReturnsAsync(access);
        query = new Mock<ILineupQueryService>();
        commit = new Mock<ILineupCommitService>();
        var c = new LineupController(accessSvc.Object, query.Object, commit.Object, NullLogger<LineupController>.Instance);
        c.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        return c;
    }

    private static LineupAccess Edit() => new("cu", true, true, new HashSet<int>());
    private static LineupAccess ViewOnly() => new("cu", false, true, new HashSet<int>());

    [Fact]
    public void Routes_are_guarded_by_the_lineup_policies()
    {
        string Policy(string method) =>
            typeof(LineupController).GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>()!.Policy!;
        Assert.Equal("lineup.view", Policy(nameof(LineupController.Get)));
        Assert.Equal("lineup.edit", Policy(nameof(LineupController.Commit)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("10/01/2026")]
    [InlineData("2026-13-45")]
    public async Task Get_rejects_missing_or_bad_date(string? date)
    {
        var c = Build(Edit(), out _, out _);
        Assert.IsType<BadRequestObjectResult>(await c.Get(Co, date));
    }

    [Fact]
    public async Task Get_is_forbidden_without_an_access_record()
    {
        var c = Build(null, out _, out _);
        Assert.IsType<ForbidResult>(await c.Get(Co, "2026-10-01"));
    }

    [Fact]
    public async Task Get_returns_the_lineup()
    {
        var c = Build(Edit(), out var query, out _);
        var dto = new LineupDto("2026-10-01", "UTC", true, new(), new(), new(), new());
        query.Setup(q => q.GetAsync(Co, new DateOnly(2026, 10, 1), It.IsAny<LineupAccess>())).ReturnsAsync(dto);
        var ok = Assert.IsType<OkObjectResult>(await c.Get(Co, "2026-10-01"));
        Assert.Same(dto, ok.Value);
    }

    [Fact]
    public async Task Commit_is_forbidden_for_view_only_users()
    {
        var c = Build(ViewOnly(), out _, out var commit);
        var result = await c.Commit(Co, new LineupCommitRequest("2026-10-01", new(), new()));
        Assert.IsType<ForbidResult>(result);
        commit.Verify(x => x.CommitAsync(It.IsAny<string>(), It.IsAny<DateOnly>(), It.IsAny<LineupCommitRequest>(), It.IsAny<LineupAccess>()), Times.Never);
    }

    [Fact]
    public async Task Commit_rejects_bad_date_and_delegates_otherwise()
    {
        var c = Build(Edit(), out _, out var commit);
        Assert.IsType<BadRequestObjectResult>(await c.Commit(Co, new LineupCommitRequest("nope", null, null)));

        var response = new LineupCommitResponse(new());
        commit.Setup(x => x.CommitAsync(Co, new DateOnly(2026, 10, 1), It.IsAny<LineupCommitRequest>(), It.IsAny<LineupAccess>()))
              .ReturnsAsync(response);
        var ok = Assert.IsType<OkObjectResult>(await c.Commit(Co, new LineupCommitRequest("2026-10-01", null, null)));
        Assert.Same(response, ok.Value);
    }
}
