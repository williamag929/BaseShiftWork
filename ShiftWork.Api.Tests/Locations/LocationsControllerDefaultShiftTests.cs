using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using AutoMapper;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Locations;

public class LocationsControllerDefaultShiftTests
{
    private const string Co = "co-1";
    private const int LocId = 7;
    private static readonly DefaultShiftDto Input = new("07:00", "15:30", 12);

    private static LocationsController Build(out Mock<ILocationService> svc, out MemoryCache cache)
    {
        svc = new Mock<ILocationService>();
        cache = new MemoryCache(new MemoryCacheOptions());
        cache.Set($"locations_{Co}", new object());
        cache.Set($"location_{Co}_{LocId}", new object());
        return new LocationsController(svc.Object, new Mock<IMapper>().Object, cache,
            NullLogger<LocationsController>.Instance, new Mock<IWebhookService>().Object);
    }

    [Fact]
    public void Default_shift_routes_require_locations_update()
    {
        string Policy(string method) =>
            typeof(LocationsController).GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>()!.Policy!;
        Assert.Equal("locations.update", Policy(nameof(LocationsController.PutDefaultShift)));
        Assert.Equal("locations.update", Policy(nameof(LocationsController.DeleteDefaultShift)));
    }

    [Fact]
    public async Task Put_returns_404_when_location_not_found()
    {
        var c = Build(out var svc, out _);
        svc.Setup(s => s.SetDefaultShiftAsync(Co, LocId, Input)).ReturnsAsync((DefaultShiftDto?)null);
        Assert.IsType<NotFoundObjectResult>(await c.PutDefaultShift(Co, LocId, Input));
    }

    [Fact]
    public async Task Put_returns_400_with_the_exception_message()
    {
        var c = Build(out var svc, out _);
        svc.Setup(s => s.SetDefaultShiftAsync(Co, LocId, Input)).ThrowsAsync(new ArgumentException("bad times"));

        var bad = Assert.IsType<BadRequestObjectResult>(await c.PutDefaultShift(Co, LocId, Input));
        var message = bad.Value!.GetType().GetProperty("message")!.GetValue(bad.Value);
        Assert.Equal("bad times", message);
    }

    [Fact]
    public async Task Put_returns_200_with_the_stored_dto_and_evicts_the_cache()
    {
        var c = Build(out var svc, out var cache);
        var stored = new DefaultShiftDto("07:00", "15:30", 12);
        svc.Setup(s => s.SetDefaultShiftAsync(Co, LocId, Input)).ReturnsAsync(stored);

        var ok = Assert.IsType<OkObjectResult>(await c.PutDefaultShift(Co, LocId, Input));
        Assert.Same(stored, ok.Value);
        Assert.False(cache.TryGetValue($"locations_{Co}", out _));
        Assert.False(cache.TryGetValue($"location_{Co}_{LocId}", out _));
    }

    [Fact]
    public async Task Delete_returns_404_when_location_not_found()
    {
        var c = Build(out var svc, out _);
        svc.Setup(s => s.ClearDefaultShiftAsync(Co, LocId)).ReturnsAsync(false);
        Assert.IsType<NotFoundObjectResult>(await c.DeleteDefaultShift(Co, LocId));
    }

    [Fact]
    public async Task Delete_returns_204_and_evicts_the_cache()
    {
        var c = Build(out var svc, out var cache);
        svc.Setup(s => s.ClearDefaultShiftAsync(Co, LocId)).ReturnsAsync(true);

        Assert.IsType<NoContentResult>(await c.DeleteDefaultShift(Co, LocId));
        Assert.False(cache.TryGetValue($"locations_{Co}", out _));
        Assert.False(cache.TryGetValue($"location_{Co}_{LocId}", out _));
    }
}
