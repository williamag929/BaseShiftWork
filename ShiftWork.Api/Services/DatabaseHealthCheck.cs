using Microsoft.Extensions.Diagnostics.HealthChecks;
using ShiftWork.Api.Data;

namespace ShiftWork.Api.Services
{
    public class DatabaseHealthCheck : IHealthCheck
    {
        private readonly ShiftWorkContext _context;

        public DatabaseHealthCheck(ShiftWorkContext context)
        {
            _context = context;
        }

        public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
        {
            try
            {
                var canConnect = await _context.Database.CanConnectAsync(cancellationToken);
                return canConnect
                    ? HealthCheckResult.Healthy("Database connection is healthy.")
                    : HealthCheckResult.Unhealthy("Cannot connect to the database.");
            }
            catch (Exception ex)
            {
                return HealthCheckResult.Unhealthy("Database health check threw an exception.", ex);
            }
        }
    }
}
