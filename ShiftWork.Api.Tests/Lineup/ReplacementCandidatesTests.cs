using Microsoft.Extensions.Logging.Abstractions;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class ReplacementCandidatesTests
{
    private const string Co = LineupTestData.CompanyId;
    private static DateTime U(int d, int h) => new(2026, 10, d, h, 0, 0, DateTimeKind.Utc);

    private static ScheduleShiftService Build(ShiftWork.Api.Data.ShiftWorkContext ctx) =>
        new(ctx, NullLogger<ScheduleShiftService>.Instance, new AvailabilityService(ctx), new CompanyTimeZoneService(ctx));

    [Fact]
    public async Task Excludes_busy_inactive_time_off_and_the_excluded_person()
    {
        await using var ctx = LineupTestData.NewContext();
        ctx.Companies.Add(LineupTestData.Company());
        ctx.Persons.AddRange(
            new Person { PersonId = 1, Name = "Free", CompanyId = Co, Email = "1@x", Status = "Active" },
            new Person { PersonId = 2, Name = "Busy", CompanyId = Co, Email = "2@x", Status = "Active" },
            new Person { PersonId = 3, Name = "Inactive", CompanyId = Co, Email = "3@x", Status = "Inactive" },
            new Person { PersonId = 4, Name = "Off", CompanyId = Co, Email = "4@x", Status = "Active" },
            new Person { PersonId = 6, Name = "Requester", CompanyId = Co, Email = "6@x", Status = "Active" });
        ctx.ScheduleShifts.Add(new ScheduleShift { CompanyId = Co, PersonId = 2, LocationId = 7, AreaId = 1, StartDate = U(1, 12), EndDate = U(1, 20), Status = "Published" });
        ctx.TimeOffRequests.Add(new TimeOffRequest { CompanyId = Co, PersonId = 4, Status = "Approved", StartDate = new DateTime(2026, 10, 1), EndDate = new DateTime(2026, 10, 1) });
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).GetReplacementCandidatesByWindow(Co, U(1, 12), U(1, 20), 7, 1, excludePersonId: 6);
        Assert.Equal(new[] { 1 }, result.Select(p => p.PersonId));
    }

    [Fact]
    public void Both_replacement_candidate_routes_require_schedule_shifts_read()
    {
        var methods = typeof(ShiftWork.Api.Controllers.ScheduleShiftsController).GetMethods()
            .Where(m => m.Name is "GetReplacementCandidatesForShift" or "GetReplacementCandidatesByWindow").ToList();
        Assert.Equal(2, methods.Count);
        foreach (var m in methods)
        {
            var attr = m.GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute), true)
                .Cast<Microsoft.AspNetCore.Authorization.AuthorizeAttribute>().SingleOrDefault();
            Assert.Equal("schedule-shifts.read", attr?.Policy);
        }
    }
}
