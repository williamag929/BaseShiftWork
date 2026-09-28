using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Services;
using Stripe;
using Xunit;

namespace ShiftWork.Api.Tests.Billing;

public class StripeWebhookControllerTests
{
    private const string Secret = "whsec_test";
    private const string Payload =
        "{\"id\":\"evt_1\",\"object\":\"event\",\"api_version\":\"2020-08-27\",\"type\":\"customer.created\",\"data\":{\"object\":{\"id\":\"cus_1\",\"object\":\"customer\"}}}";

    private readonly Mock<IStripeWebhookService> _svc = new();

    private StripeWebhookController Sut(string? secret, string signature)
    {
        var http = new DefaultHttpContext();
        http.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(Payload));
        http.Request.Headers["Stripe-Signature"] = signature;
        return new StripeWebhookController(_svc.Object, new StripeSettings { WebhookSecret = secret }, NullLogger<StripeWebhookController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = http }
        };
    }

    private static string Sign(string secret)
    {
        var t = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        using var h = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var sig = Convert.ToHexString(h.ComputeHash(Encoding.UTF8.GetBytes($"{t}.{Payload}"))).ToLowerInvariant();
        return $"t={t},v1={sig}";
    }

    [Fact]
    public async Task ValidSignature_Dispatches_Returns200()
    {
        var result = await Sut(Secret, Sign(Secret)).Receive();
        Assert.IsType<OkResult>(result);
        _svc.Verify(s => s.ProcessAsync(It.Is<Event>(e => e.Id == "evt_1")), Times.Once);
    }

    [Fact]
    public async Task BadSignature_Returns400_AndDoesNotDispatch()
    {
        var result = await Sut(Secret, Sign("whsec_wrong")).Receive();
        Assert.IsType<BadRequestObjectResult>(result);
        _svc.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task MissingSecret_Returns500()
    {
        var result = await Sut(null, Sign(Secret)).Receive();
        Assert.Equal(500, Assert.IsType<ObjectResult>(result).StatusCode);
    }
}
