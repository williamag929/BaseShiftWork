using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using ShiftWork.Api.Data;
using ShiftWork.Api.Services;

namespace ShiftWork.Api.Tests.TestHelpers;

/// <summary>
/// Creates a PushNotificationService wired to a no-op HTTP handler so tests
/// never make real network calls and push failures don't cause test noise.
/// </summary>
internal static class FakePush
{
    public static PushNotificationService Create(ShiftWorkContext context)
    {
        var handler = new NullHttpMessageHandler();
        var factory = new SingletonHttpClientFactory(handler);
        return new PushNotificationService(factory, context, NullLogger<PushNotificationService>.Instance);
    }

    private sealed class NullHttpMessageHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") });
    }

    private sealed class SingletonHttpClientFactory : IHttpClientFactory
    {
        private readonly HttpMessageHandler _handler;
        public SingletonHttpClientFactory(HttpMessageHandler handler) => _handler = handler;
        public HttpClient CreateClient(string name) => new(_handler, disposeHandler: false);
    }
}
