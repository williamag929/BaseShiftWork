using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ShiftWork.Api.Data
{
    // Provides a design-time factory so `dotnet ef` can create the DbContext
    // without executing Program.cs (and without requiring env vars).
    public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ShiftWorkContext>
    {
        public ShiftWorkContext CreateDbContext(string[] args)
        {
            var optionsBuilder = new DbContextOptionsBuilder<ShiftWorkContext>();

            // Prefer environment variable if present; else fall back to a local default for dev.
            var connectionString = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING")
                ?? "Server=(localdb)\\MSSQLLocalDB;Database=ShiftWorkDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True";

            optionsBuilder.UseSqlServer(connectionString);
            return new ShiftWorkContext(optionsBuilder.Options);
        }
    }
}
