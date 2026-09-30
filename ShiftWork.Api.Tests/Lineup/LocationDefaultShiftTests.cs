using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class LocationDefaultShiftTests
{
    [Fact]
    public void Parses_default_shift_and_ignores_other_keys()
    {
        var d = LocationDefaultShift.TryParse("""{"theme":"x","defaultShift":{"start":"07:00","end":"15:30","areaId":12}}""");
        Assert.NotNull(d);
        Assert.Equal(new TimeOnly(7, 0), d!.Start);
        Assert.Equal(new TimeOnly(15, 30), d.End);
        Assert.Equal(12, d.AreaId);
    }

    [Fact]
    public void Area_is_optional()
    {
        var d = LocationDefaultShift.TryParse("""{"defaultShift":{"start":"22:00","end":"06:00"}}""");
        Assert.Null(d!.AreaId);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("{}")]
    [InlineData("""{"defaultShift":{"start":"7am","end":"15:30"}}""")]
    [InlineData("""{"defaultShift":{"start":"07:00"}}""")]
    public void Missing_or_malformed_returns_null(string? json) =>
        Assert.Null(LocationDefaultShift.TryParse(json));
}
