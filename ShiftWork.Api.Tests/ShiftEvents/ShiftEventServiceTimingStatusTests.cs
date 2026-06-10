using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Moq;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.ShiftEvents;

public class ShiftEventServiceTimingStatusTests : IDisposable
{
    private readonly ShiftWorkContext _context;
    private readonly Mock<IMapper> _mapperMock = new();
    private readonly Mock<IPeopleService> _peopleServiceMock = new();
    private readonly Mock<ICompanySettingsService> _settingsServiceMock = new();

    public ShiftEventServiceTimingStatusTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _context = new ShiftWorkContext(options);

        _mapperMock
            .Setup(m => m.Map<ShiftEvent>(It.IsAny<ShiftEventDto>()))
            .Returns((ShiftEventDto dto) => new ShiftEvent
            {
                EventLogId = dto.EventLogId == Guid.Empty ? Guid.NewGuid() : dto.EventLogId,
                EventDate = dto.EventDate,
                EventType = dto.EventType,
                CompanyId = dto.CompanyId,
                PersonId = dto.PersonId,
                EventObject = dto.EventObject,
                Description = dto.Description,
                KioskDevice = dto.KioskDevice,
                GeoLocation = dto.GeoLocation,
                PhotoUrl = dto.PhotoUrl,
            });

        _peopleServiceMock
            .Setup(p => p.GetPersonStatusShiftWork(It.IsAny<int>()))
            .ReturnsAsync("OffShift");

        _peopleServiceMock
            .Setup(p => p.UpdatePersonStatusShiftWork(It.IsAny<int>(), It.IsAny<string>()))
            .ReturnsAsync((Person?)null);
    }

    [Theory]
    [InlineData("America/New_York", "2026-01-15T09:00:00Z", "2026-01-15T14:00:00Z")]
    [InlineData("UTC", "2026-01-15T09:00:00Z", "2026-01-15T09:00:00Z")]
    [InlineData("Asia/Tokyo", "2026-01-15T09:00:00Z", "2026-01-15T00:00:00Z")]
    public async Task CreateShiftEvent_ClockIn_OnTimeAcrossTimeZones(string timeZone, string scheduleStartIso, string clockInIso)
    {
        const string companyId = "test-company";
        const int personId = 42;

        await SeedCompanyAndShift(companyId, personId, timeZone, scheduleStartIso, "2026-01-15T17:00:00Z");

        var service = CreateService();
        var dto = BuildClockInDto(companyId, personId, clockInIso);

        await service.CreateShiftEventAsync(dto);

        _peopleServiceMock.Verify(
            p => p.UpdatePersonStatusShiftWork(personId, "OnShift:OnTime"),
            Times.Once);
    }

    [Theory]
    [InlineData("America/New_York", "2026-01-15T09:00:00Z", "2026-01-15T14:10:00Z", "OnShift:Late")]
    [InlineData("UTC", "2026-01-15T09:00:00Z", "2026-01-15T08:50:00Z", "OnShift:Early")]
    public async Task CreateShiftEvent_ClockIn_ReportsEarlyAndLateAcrossZones(
        string timeZone,
        string scheduleStartIso,
        string clockInIso,
        string expectedStatus)
    {
        const string companyId = "test-company-2";
        const int personId = 77;

        await SeedCompanyAndShift(companyId, personId, timeZone, scheduleStartIso, "2026-01-15T17:00:00Z");

        var service = CreateService();
        var dto = BuildClockInDto(companyId, personId, clockInIso);

        await service.CreateShiftEventAsync(dto);

        _peopleServiceMock.Verify(
            p => p.UpdatePersonStatusShiftWork(personId, expectedStatus),
            Times.Once);
    }

    [Theory]
    [InlineData("2026-03-08T09:00:00Z", "2026-03-08T13:00:00Z")] // US DST starts (UTC-4 after jump)
    [InlineData("2026-11-01T09:00:00Z", "2026-11-01T14:00:00Z")] // US DST ends (UTC-5 after fallback)
    public async Task CreateShiftEvent_ClockIn_OnTimeAcrossDstTransitions(string scheduleStartIso, string clockInIso)
    {
        const string companyId = "dst-company";
        const int personId = 99;

        await SeedCompanyAndShift(companyId, personId, "America/New_York", scheduleStartIso, "2026-11-01T17:00:00Z");

        var service = CreateService();
        var dto = BuildClockInDto(companyId, personId, clockInIso);

        await service.CreateShiftEventAsync(dto);

        _peopleServiceMock.Verify(
            p => p.UpdatePersonStatusShiftWork(personId, "OnShift:OnTime"),
            Times.Once);
    }

    private ShiftEventService CreateService() =>
        new(_context, _mapperMock.Object, _peopleServiceMock.Object, _settingsServiceMock.Object);

    private ShiftEventDto BuildClockInDto(string companyId, int personId, string eventDateIso) =>
        new()
        {
            EventLogId = Guid.NewGuid(),
            CompanyId = companyId,
            PersonId = personId,
            EventType = "clockin",
            EventDate = DateTime.Parse(eventDateIso, null, System.Globalization.DateTimeStyles.AdjustToUniversal),
        };

    private async Task SeedCompanyAndShift(
        string companyId,
        int personId,
        string timeZone,
        string scheduleStartIso,
        string scheduleEndIso)
    {
        _context.Companies.Add(new Company
        {
            CompanyId = companyId,
            Name = $"Company {companyId}",
            Email = $"{companyId}@example.com",
            PhoneNumber = string.Empty,
            Address = string.Empty,
            TimeZone = timeZone,
        });

        _context.Locations.Add(new Location
        {
            LocationId = personId,
            CompanyId = companyId,
            Name = "Main",
            Address = string.Empty,
            City = string.Empty,
            State = string.Empty,
            Country = "US",
            ZipCode = "00000",
            GeoCoordinates = "{}",
            RatioMax = 1,
            Status = "Active",
            TimeZone = timeZone,
        });

        _context.ScheduleShifts.Add(new ScheduleShift
        {
            ScheduleShiftId = personId,
            ScheduleId = 1,
            CompanyId = companyId,
            PersonId = personId,
            LocationId = personId,
            AreaId = 1,
            StartDate = DateTime.Parse(scheduleStartIso, null, System.Globalization.DateTimeStyles.AdjustToUniversal),
            EndDate = DateTime.Parse(scheduleEndIso, null, System.Globalization.DateTimeStyles.AdjustToUniversal),
            Status = "open",
        });

        await _context.SaveChangesAsync();
    }

    public void Dispose() => _context.Dispose();
}
