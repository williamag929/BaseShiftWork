using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Middleware;
using Xunit;

namespace ShiftWork.Api.Tests.Observability;

public class RequestErrorLoggingMiddlewareTests
{
    [Fact]
    public async Task Logs_ClientError_WithPathStatusUserAndCompany()
    {
        var logger = new CapturingLogger();
        var middleware = new RequestErrorLoggingMiddleware(ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; }, logger);
        var context = NewContext("GET", "/api/companies/c1/areas", "uid-7", "c1");

        await middleware.InvokeAsync(context);

        var entry = Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Warning, entry.Level);
        Assert.Contains("/api/companies/c1/areas", entry.Message);
        Assert.Contains("403", entry.Message);
        Assert.Contains("uid-7", entry.Message);
        Assert.Contains("company=c1", entry.Message);
    }

    [Fact]
    public async Task Logs_ServerError_AsError()
    {
        var logger = new CapturingLogger();
        var middleware = new RequestErrorLoggingMiddleware(ctx => { ctx.Response.StatusCode = 500; return Task.CompletedTask; }, logger);

        await middleware.InvokeAsync(NewContext("PUT", "/api/companies/c1/schedules/9", null, "c1"));

        Assert.Equal(LogLevel.Error, Assert.Single(logger.Entries).Level);
    }

    [Fact]
    public async Task DoesNotLog_SuccessfulResponse()
    {
        var logger = new CapturingLogger();
        var middleware = new RequestErrorLoggingMiddleware(ctx => { ctx.Response.StatusCode = 200; return Task.CompletedTask; }, logger);

        await middleware.InvokeAsync(NewContext("GET", "/api/companies", null, null));

        Assert.Empty(logger.Entries);
    }

    [Fact]
    public async Task Logs_AndRethrows_UnhandledException()
    {
        var logger = new CapturingLogger();
        var middleware = new RequestErrorLoggingMiddleware(_ => throw new InvalidOperationException("boom"), logger);

        await Assert.ThrowsAsync<InvalidOperationException>(() => middleware.InvokeAsync(NewContext("POST", "/api/x", null, null)));

        var entry = Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Error, entry.Level);
        Assert.IsType<InvalidOperationException>(entry.Exception);
        Assert.Contains("anonymous", entry.Message);
    }

    private static DefaultHttpContext NewContext(string method, string path, string? userId, string? companyId)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = method;
        context.Request.Path = path;
        if (userId != null)
            context.User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("user_id", userId) }, "test"));
        if (companyId != null)
        {
            var routeData = new RouteData();
            routeData.Values["companyId"] = companyId;
            context.Features.Set<IRoutingFeature>(new RoutingFeature { RouteData = routeData });
        }
        return context;
    }

    private sealed class CapturingLogger : ILogger<RequestErrorLoggingMiddleware>
    {
        public List<(LogLevel Level, string Message, Exception? Exception)> Entries { get; } = new();
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            => Entries.Add((logLevel, formatter(state, exception), exception));
    }
}
