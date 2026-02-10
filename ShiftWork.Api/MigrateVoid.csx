// Quick utility to add VoidedBy/VoidedAt columns to the Schedules table
// Run with: dotnet run --project . -- --migrate-void
// Or: dotnet script add_void_columns.csx

using Microsoft.Data.SqlClient;

var connectionString = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING");
if (string.IsNullOrEmpty(connectionString))
{
    Console.WriteLine("ERROR: DB_CONNECTION_STRING not set");
    return 1;
}

var sql = @"
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Schedules') AND name = 'VoidedBy')
BEGIN
    ALTER TABLE [Schedules] ADD [VoidedBy] nvarchar(max) NULL;
    PRINT 'Added VoidedBy column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Schedules') AND name = 'VoidedAt')
BEGIN
    ALTER TABLE [Schedules] ADD [VoidedAt] datetime2 NULL;
    PRINT 'Added VoidedAt column';
END
";

try
{
    using var conn = new SqlConnection(connectionString);
    conn.Open();
    conn.InfoMessage += (s, e) => Console.WriteLine(e.Message);
    using var cmd = new SqlCommand(sql, conn);
    cmd.ExecuteNonQuery();
    Console.WriteLine("Done - columns verified/added.");
    return 0;
}
catch (Exception ex)
{
    Console.WriteLine($"ERROR: {ex.Message}");
    return 1;
}
