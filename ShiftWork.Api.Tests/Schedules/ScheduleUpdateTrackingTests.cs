using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Schedules;

public class ScheduleUpdateTrackingTests
{
    private const string CompanyId = "c1";

    private static ShiftWorkContext NewContext() =>
        new(new DbContextOptionsBuilder<ShiftWorkContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static Schedule NewSchedule(int id, string name) => new()
    {
        ScheduleId = id, Name = name, CompanyId = CompanyId, PersonId = "7", Status = "Unpublished",
        StartDate = new DateTime(2026, 11, 12, 8, 0, 0), EndDate = new DateTime(2026, 11, 12, 16, 0, 0),
    };

    private static ScheduleShift NewShift(int id, string notes) => new()
    {
        ScheduleShiftId = id, ScheduleId = 1, CompanyId = CompanyId, LocationId = 1, AreaId = 1, PersonId = 7,
        Status = "Unpublished", Notes = notes,
        StartDate = new DateTime(2026, 11, 12, 8, 0, 0), EndDate = new DateTime(2026, 11, 12, 16, 0, 0),
    };

    [Fact]
    public async Task ScheduleUpdate_AfterGetLoadedTheSameRow_SavesInsteadOfThrowing()
    {
        await using var context = NewContext();
        context.Schedules.Add(NewSchedule(90, "Before"));
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var service = new ScheduleService(context, NullLogger<ScheduleService>.Instance);

        await service.Get(CompanyId, 90);
        var updated = await service.Update(NewSchedule(90, "After"));

        Assert.Equal("After", updated.Name);
        context.ChangeTracker.Clear();
        Assert.Equal("After", (await context.Schedules.SingleAsync()).Name);
    }

    [Fact]
    public async Task ScheduleUpdate_ReturnsNull_WhenTheScheduleDoesNotExist()
    {
        await using var context = NewContext();
        var service = new ScheduleService(context, NullLogger<ScheduleService>.Instance);

        Assert.Null(await service.Update(NewSchedule(404, "Ghost")));
        Assert.Empty(context.Schedules);
    }

    [Fact]
    public async Task ShiftUpdate_AfterGetLoadedTheSameRow_SavesInsteadOfThrowing()
    {
        await using var context = NewContext();
        context.ScheduleShifts.Add(NewShift(5, "Before"));
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var service = new ScheduleShiftService(context, NullLogger<ScheduleShiftService>.Instance);

        await service.Get(CompanyId, 5);
        var updated = await service.Update(NewShift(5, "After"));

        Assert.Equal("After", updated.Notes);
        context.ChangeTracker.Clear();
        Assert.Equal("After", (await context.ScheduleShifts.SingleAsync()).Notes);
    }
}
