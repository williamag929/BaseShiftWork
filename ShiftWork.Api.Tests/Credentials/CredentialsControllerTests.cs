using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Credentials;

public class CredentialsControllerTests
{
    private readonly Mock<ICredentialService> _serviceMock = new();
    private readonly CredentialsController _sut;

    private const string CompanyA = "company-a";

    public CredentialsControllerTests()
    {
        _sut = new CredentialsController(_serviceMock.Object, NullLogger<CredentialsController>.Instance);
    }

    [Theory]
    [InlineData(-5, "Expired")]
    [InlineData(-1, "Expired")]
    [InlineData(0, "ExpiringSoon")]
    [InlineData(15, "ExpiringSoon")]
    [InlineData(30, "ExpiringSoon")]
    [InlineData(31, "Valid")]
    [InlineData(365, "Valid")]
    public async Task GetCredentials_ClassifiesExpiryStatus_AtThresholdBoundaries(int daysFromToday, string expectedStatus)
    {
        var credential = new Credential
        {
            CredentialId = Guid.NewGuid(),
            PersonId = 1,
            Name = "Test Cert",
            // Use a time comfortably inside "today" so day-boundary math doesn't flake near midnight UTC.
            ExpiryDate = DateTime.UtcNow.Date.AddDays(daysFromToday).AddHours(12),
        };

        _serviceMock.Setup(s => s.GetByCompanyAsync(CompanyA, null, null))
            .ReturnsAsync(new List<Credential> { credential });

        var result = await _sut.GetCredentials(CompanyA, null, null);

        var ok = Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(result.Result);
        var dtos = Assert.IsAssignableFrom<IEnumerable<ShiftWork.Api.DTOs.CredentialDto>>(ok.Value);
        var dto = Assert.Single(dtos);
        Assert.Equal(expectedStatus, dto.ExpiryStatus);
    }
}
