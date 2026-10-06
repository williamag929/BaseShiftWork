using System.Security.Claims;
using AutoMapper;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.ShiftEvents;

public class ShiftEventsControllerNfcTests
{
    private const string CompanyId = "co";
    private readonly Mock<IShiftEventService> _service = new();
    private readonly Mock<IMapper> _mapper = new();

    public ShiftEventsControllerNfcTests()
    {
        _service.Setup(s => s.CreateShiftEventAsync(It.IsAny<ShiftEventDto>()))
            .ReturnsAsync((ShiftEventDto d) => new ShiftEvent { EventLogId = d.EventLogId, PersonId = d.PersonId });
        _mapper.Setup(m => m.Map<ShiftEventDto>(It.IsAny<ShiftEvent>()))
            .Returns((ShiftEvent e) => new ShiftEventDto { EventLogId = e.EventLogId, PersonId = e.PersonId });
    }

    private ShiftEventsController Sut(params Claim[] claims)
    {
        var controller = new ShiftEventsController(_service.Object, NullLogger<ShiftEventsController>.Instance, _mapper.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")) },
        };
        return controller;
    }

    private static ShiftEventDto Punch(int personId) => new()
    {
        EventLogId = Guid.NewGuid(), CompanyId = CompanyId, PersonId = personId, EventType = "clockin", LocationId = 1,
    };

    [Fact]
    public async Task OwnPhonePunch_AtAnNfcSite_Is403_WithCode_AndNothingIsCreated()
    {
        _service.Setup(s => s.EnsureNfcNotRequiredAsync(It.IsAny<ShiftEventDto>()))
            .ThrowsAsync(new NfcRequiredException("North Tower"));

        var result = await Sut(new Claim("personId", "5")).CreateShiftEvent(CompanyId, Punch(5));

        var obj = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(403, obj.StatusCode);
        Assert.Contains("NFC_REQUIRED", System.Text.Json.JsonSerializer.Serialize(obj.Value));
        _service.Verify(s => s.CreateShiftEventAsync(It.IsAny<ShiftEventDto>()), Times.Never);
    }

    [Fact]
    public async Task OwnPhonePunch_AtANormalSite_IsChecked_AndCreated()
    {
        var result = await Sut(new Claim("personId", "5")).CreateShiftEvent(CompanyId, Punch(5));

        Assert.IsType<CreatedAtActionResult>(result.Result);
        _service.Verify(s => s.EnsureNfcNotRequiredAsync(It.IsAny<ShiftEventDto>()), Times.Once);
    }

    [Fact]
    public async Task ManagerTokenWithoutPersonIdClaim_IsNotChecked()
    {
        await Sut(new Claim(ClaimTypes.NameIdentifier, "firebase-uid")).CreateShiftEvent(CompanyId, Punch(5));
        _service.Verify(s => s.EnsureNfcNotRequiredAsync(It.IsAny<ShiftEventDto>()), Times.Never);
    }

    [Fact]
    public async Task PunchForSomeoneElse_IsNotChecked()
    {
        await Sut(new Claim("personId", "99")).CreateShiftEvent(CompanyId, Punch(5));
        _service.Verify(s => s.EnsureNfcNotRequiredAsync(It.IsAny<ShiftEventDto>()), Times.Never);
    }
}
