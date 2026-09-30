using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Lineup;

public class LineupTimeTests
{
    private static readonly TimeZoneInfo Ny = LineupTime.Resolve("America/New_York");

    private static DateTime Z(int y, int m, int d, int h, int min = 0) => new(y, m, d, h, min, 0, DateTimeKind.Utc);

    [Fact]
    public void Day_window_for_normal_day_is_24h_in_utc()
    {
        var (s, e) = LineupTime.DayWindowUtc(new DateOnly(2026, 10, 1), Ny);
        Assert.Equal(Z(2026, 10, 1, 4), s);
        Assert.Equal(Z(2026, 10, 2, 4), e);
    }

    [Fact]
    public void Day_window_on_fall_back_day_is_25h()
    {
        var (s, e) = LineupTime.DayWindowUtc(new DateOnly(2026, 11, 1), Ny);
        Assert.Equal(Z(2026, 11, 1, 4), s);
        Assert.Equal(Z(2026, 11, 2, 5), e);
    }

    [Fact]
    public void Time_inside_spring_forward_gap_does_not_throw()
    {
        var utc = LineupTime.ToUtc(new DateOnly(2026, 3, 8), new TimeOnly(2, 30), Ny);
        Assert.Equal(Z(2026, 3, 8, 7, 30), utc);
    }

    [Fact]
    public void Overnight_wall_shift_ends_next_day_with_same_digits()
    {
        var (s, e) = LineupTime.WallShiftWindow(new DateOnly(2026, 10, 1), new TimeOnly(22, 0), new TimeOnly(6, 0));
        Assert.Equal(Z(2026, 10, 1, 22), s);
        Assert.Equal(Z(2026, 10, 2, 6), e);
        Assert.Equal(DateTimeKind.Utc, s.Kind);
        Assert.Equal(DateTimeKind.Utc, e.Kind);
    }

    [Fact]
    public void Wall_day_window_is_midnight_to_midnight_labelled_utc()
    {
        var (s, e) = LineupTime.WallDayWindow(new DateOnly(2026, 10, 1));
        Assert.Equal(Z(2026, 10, 1, 0), s);
        Assert.Equal(Z(2026, 10, 2, 0), e);
    }

    [Fact]
    public void Wall_day_window_is_24h_even_on_fall_back_day()
    {
        var (s, e) = LineupTime.WallDayWindow(new DateOnly(2026, 11, 1));
        Assert.Equal(TimeSpan.FromHours(24), e - s);
    }

    [Fact]
    public void Wall_to_instant_reads_the_digits_as_local_time()
    {
        var wall = new DateTime(2026, 10, 1, 7, 0, 0, DateTimeKind.Utc);
        Assert.Equal(Z(2026, 10, 1, 11), LineupTime.WallToInstantUtc(wall, Ny));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Not/AZone")]
    public void Unknown_zone_falls_back_to_utc(string? id) =>
        Assert.Equal(TimeZoneInfo.Utc.Id, LineupTime.Resolve(id).Id);
}
