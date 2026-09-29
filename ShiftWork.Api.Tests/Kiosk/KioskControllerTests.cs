using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Kiosk;

public class KioskControllerTests
{
    private readonly Mock<IKioskService> _kioskServiceMock = new();
    private readonly Mock<ICompanySettingsService> _companySettingsMock = new();
    private readonly Mock<ILocationService> _locationServiceMock = new();
    private readonly Mock<IBulletinService> _bulletinsMock = new();
    private readonly Mock<ISafetyService> _safetyMock = new();
    private readonly Mock<ILogger<KioskController>> _loggerMock = new();
    private readonly KioskController _sut;

    private const string CompanyId = "company-a";
    private const int PersonId = 42;

    public KioskControllerTests()
    {
        var config = new ConfigurationBuilder().Build();
        _sut = new KioskController(
            _kioskServiceMock.Object,
            config,
            _companySettingsMock.Object,
            _locationServiceMock.Object,
            _bulletinsMock.Object,
            _safetyMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task GetPostClockout_LogsError_OnException()
    {
        _bulletinsMock
            .Setup(b => b.GetUnreadAsync(CompanyId, PersonId, false))
            .ThrowsAsync(new InvalidOperationException("boom"));

        var result = await _sut.GetPostClockout(CompanyId, PersonId, null);

        var status = Assert.IsType<Microsoft.AspNetCore.Mvc.ObjectResult>(result.Result);
        Assert.Equal(500, status.StatusCode);
        VerifyLogError(Times.Once());
    }

    [Fact]
    public async Task MarkBulletinRead_LogsError_OnException()
    {
        var bulletinId = Guid.NewGuid();
        _bulletinsMock
            .Setup(b => b.MarkAsReadAsync(bulletinId, CompanyId, PersonId))
            .ThrowsAsync(new InvalidOperationException("boom"));

        var result = await _sut.MarkBulletinRead(CompanyId, bulletinId, PersonId);

        var status = Assert.IsType<Microsoft.AspNetCore.Mvc.ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
        VerifyLogError(Times.Once());
    }

    [Fact]
    public async Task AcknowledgeSafety_LogsError_OnException()
    {
        var safetyContentId = Guid.NewGuid();
        _safetyMock
            .Setup(s => s.AcknowledgeAsync(safetyContentId, CompanyId, PersonId, null))
            .ThrowsAsync(new InvalidOperationException("boom"));

        var result = await _sut.AcknowledgeSafety(CompanyId, safetyContentId, PersonId);

        var status = Assert.IsType<Microsoft.AspNetCore.Mvc.ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
        VerifyLogError(Times.Once());
    }

    [Fact]
    public async Task GetKioskConfig_ReturnsOk_WithTheServiceConfig()
    {
        _kioskServiceMock
            .Setup(s => s.GetKioskConfigAsync(CompanyId, 3))
            .ReturnsAsync(new KioskConfigDto { RequirePin = false, RequirePhoto = true });

        var result = await _sut.GetKioskConfig(CompanyId, 3);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<KioskConfigDto>(ok.Value);
        Assert.False(dto.RequirePin);
        Assert.True(dto.RequirePhoto);
    }

    [Fact]
    public async Task GetKioskConfig_ReturnsNotFound_WhenLocationIsUnknown()
    {
        _kioskServiceMock
            .Setup(s => s.GetKioskConfigAsync(CompanyId, 3))
            .ReturnsAsync((KioskConfigDto?)null);

        var result = await _sut.GetKioskConfig(CompanyId, 3);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task GetKioskConfig_ReturnsBadRequest_WhenCompanyIsBlank()
    {
        var result = await _sut.GetKioskConfig(" ", 3);
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    private void VerifyLogError(Times times)
    {
        _loggerMock.Verify(
            l => l.Log(
                LogLevel.Error,
                It.IsAny<EventId>(),
                It.IsAny<It.IsAnyType>(),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            times);
    }
}
