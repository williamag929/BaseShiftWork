using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using Xunit;

namespace ShiftWork.Api.Tests.Billing;

public class StripeProcessedEventModelTests
{
    [Fact]
    public async Task ProcessedEvent_IsKeyedByEventId()
    {
        var ctx = new ShiftWorkContext(new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        ctx.StripeProcessedEvents.Add(new StripeProcessedEvent { EventId = "evt_1", Type = "x", ProcessedAt = DateTime.UtcNow });
        await ctx.SaveChangesAsync();

        var key = ctx.Model.FindEntityType(typeof(StripeProcessedEvent))!.FindPrimaryKey()!;
        Assert.Equal(nameof(StripeProcessedEvent.EventId), Assert.Single(key.Properties).Name);

        var customerIndex = ctx.Model.FindEntityType(typeof(Company))!.GetIndexes()
            .Single(i => i.Properties.Single().Name == nameof(Company.StripeCustomerId));
        Assert.True(customerIndex.IsUnique);
    }
}
