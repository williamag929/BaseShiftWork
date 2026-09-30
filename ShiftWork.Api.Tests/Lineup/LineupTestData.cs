using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Tests.Lineup;

internal static class LineupTestData
{
    public const string CompanyId = "lineup-co";

    public static ShiftWorkContext NewContext() =>
        new(new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    // The InMemory provider rejects missing non-nullable strings, so fill them all in one place.
    public static Company Company(string id = CompanyId, string tz = "America/New_York") => new()
    {
        CompanyId = id, Name = id, Email = "c@example.com", PhoneNumber = "", Address = "", TimeZone = tz
    };

    public static Location Location(int id, string name, string status = "Active", string? settings = null,
        string companyId = CompanyId, string tz = "America/New_York") => new()
    {
        LocationId = id, CompanyId = companyId, Name = name, Status = status, Settings = settings,
        Address = "1 Test St", City = "", State = "", Country = "US", ZipCode = "00000",
        GeoCoordinates = "0,0", RatioMax = 150, TimeZone = tz
    };
}
