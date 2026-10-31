using System;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;

namespace ShiftWork.Api.Helpers
{
    /// <summary>Names and registration of the API's rate-limit policies.</summary>
    public static class RateLimitPolicies
    {
        /// <summary>Company-scoped PIN check: 5 attempts per 5 minutes per (client IP, company, person).</summary>
        public const string PinVerify = "pin-verify";

        /// <summary>Deprecated /api/auth/verify-pin: 30 attempts per minute per client IP.</summary>
        public const string PinVerifyLegacy = "pin-verify-legacy";

        public const int PinVerifyPermitLimit = 5;
        public static readonly TimeSpan PinVerifyWindow = TimeSpan.FromMinutes(5);

        public static void AddPinVerifyPolicies(this RateLimiterOptions options)
        {
            options.AddPolicy(PinVerify, httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(PinVerifyPartitionKey(httpContext), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = PinVerifyPermitLimit,
                    Window = PinVerifyWindow,
                    QueueLimit = 0,
                    AutoReplenishment = true,
                }));

            options.AddPolicy(PinVerifyLegacy, httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(ClientIp(httpContext), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 30,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true,
                }));
        }

        /// <summary>
        /// One bucket per client IP + company + person, so a guessing run against one employee is
        /// throttled without locking out co-workers who punch in from the same kiosk.
        /// </summary>
        public static string PinVerifyPartitionKey(HttpContext httpContext)
        {
            var companyId = httpContext.Request.RouteValues.TryGetValue("companyId", out var c) ? c?.ToString() : null;
            var personId = httpContext.Request.RouteValues.TryGetValue("personId", out var p) ? p?.ToString() : null;
            return $"{ClientIp(httpContext)}|{companyId}|{personId}";
        }

        private static string ClientIp(HttpContext httpContext) =>
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
