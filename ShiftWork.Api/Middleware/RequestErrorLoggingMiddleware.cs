using System.Security.Claims;

namespace ShiftWork.Api.Middleware
{
    /// <summary>
    /// Logs every 4xx/5xx response and every unhandled exception with method, path, status,
    /// user and company, so a failing screen in a client can be matched to its server-side cause.
    /// Request/response bodies and headers are never logged: they can carry passwords and tokens.
    /// </summary>
    public class RequestErrorLoggingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<RequestErrorLoggingMiddleware> _logger;

        public RequestErrorLoggingMiddleware(RequestDelegate next, ILogger<RequestErrorLoggingMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "API {Method} {Path} threw {ExceptionType} user={User} company={Company}",
                    context.Request.Method, context.Request.Path.Value, ex.GetType().Name,
                    UserOf(context), CompanyOf(context));
                throw;
            }

            var status = context.Response.StatusCode;
            if (status < 400) return;

            var level = status >= 500 ? LogLevel.Error : LogLevel.Warning;
            _logger.Log(level, "API {Method} {Path} -> {Status} user={User} company={Company}",
                context.Request.Method, context.Request.Path.Value, status,
                UserOf(context), CompanyOf(context));
        }

        private static string UserOf(HttpContext context) =>
            context.User?.FindFirst("user_id")?.Value
            ?? context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? context.User?.FindFirst("sub")?.Value
            ?? "anonymous";

        private static string CompanyOf(HttpContext context) =>
            context.GetRouteValue("companyId")?.ToString() ?? "-";
    }
}
