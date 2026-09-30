using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Nfc;

public class NfcPunchControllerTests
{
    private readonly Mock<INfcPunchService> _service = new();

    private NfcPunchController Sut(params Claim[] claims) => new(_service.Object, NullLogger<NfcPunchController>.Instance)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")) },
        },
    };

    private static NfcPunchRequest Tap() => new() { TagKey = "k", EventLogId = Guid.NewGuid() };

    [Fact]
    public async Task WithoutPersonIdClaim_Is403_AndServiceNotCalled()
    {
        var result = await Sut(new Claim(ClaimTypes.NameIdentifier, "firebase-uid")).Punch("co", Tap());

        var obj = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(403, obj.StatusCode);
        _service.Verify(s => s.PunchAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<NfcPunchRequest>()), Times.Never);
    }

    [Fact]
    public async Task Success_Is200_ForTheCallersPersonId()
    {
        _service.Setup(s => s.PunchAsync("co", 5, It.IsAny<NfcPunchRequest>()))
            .ReturnsAsync(new NfcPunchResponse { EventType = "clockin", LocationName = "North Tower" });

        var result = await Sut(new Claim("personId", "5")).Punch("co", Tap());

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal("clockin", ((NfcPunchResponse)ok.Value!).EventType);
    }

    [Fact]
    public async Task Rejection_MapsStatusAndCode()
    {
        _service.Setup(s => s.PunchAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<NfcPunchRequest>()))
            .ThrowsAsync(new NfcPunchRejectedException(404, "TAG_NOT_FOUND", "nope"));

        var result = await Sut(new Claim("personId", "5")).Punch("co", Tap());

        var obj = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(404, obj.StatusCode);
        Assert.Contains("TAG_NOT_FOUND", System.Text.Json.JsonSerializer.Serialize(obj.Value));
    }
}
