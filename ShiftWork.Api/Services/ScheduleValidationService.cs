using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services;

public class ScheduleValidationService : IScheduleValidationService
{
    private readonly ShiftWorkContext _context;
    private readonly ICompanySettingsService _settingsService;

    public ScheduleValidationService(
        ShiftWorkContext context,
        ICompanySettingsService settingsService)
    {
        _context = context;
        _settingsService = settingsService;
    }

    public async Task<ValidationResult> ValidateScheduleShift(string companyId, ScheduleShift shift, int personId)
    {
        var result = new ValidationResult { IsValid = true };
        var settings = await _settingsService.GetOrCreateSettings(companyId);

        // Check overlapping shifts
        if (!settings.AllowOverlappingShifts)
        {
            var hasOverlap = await WouldOverlapExistingShift(companyId, personId, shift.StartDate, shift.EndDate);
            if (hasOverlap)
            {
                result.IsValid = false;
                result.Errors.Add("This shift overlaps with an existing shift");
            }
        }

        // Check rest time between shifts
        var minHoursBetween = settings.MinimumHoursBetweenShifts;
        if (minHoursBetween.HasValue)
        {
            var hasSufficientRest = await HasSufficientRestTime(companyId, personId, shift.StartDate);
            if (!hasSufficientRest)
            {
                result.IsValid = false;
                result.Errors.Add($"Requires at least {minHoursBetween} hours between shifts");
            }
        }

        // Check daily hours limit
        var maxDailyHours = settings.MaximumDailyHours;
        if (maxDailyHours.HasValue)
        {
            var shiftHours = (decimal)(shift.EndDate - shift.StartDate).TotalHours;
            var isWithinDaily = await IsWithinDailyHoursLimit(companyId, personId, shift.StartDate.Date, shiftHours);
            if (!isWithinDaily)
            {
                result.IsValid = false;
                result.Errors.Add($"Would exceed maximum daily hours of {maxDailyHours}");
            }
        }

        // Check weekly hours limit
        var maxWeeklyHours = settings.MaximumWeeklyHours;
        if (maxWeeklyHours.HasValue)
        {
            var shiftHours = (decimal)(shift.EndDate - shift.StartDate).TotalHours;
            var isWithinWeekly = await IsWithinWeeklyHoursLimit(companyId, personId, shift.StartDate, shiftHours);
            if (!isWithinWeekly)
            {
                result.Warnings.Add($"Would exceed maximum weekly hours of {maxWeeklyHours}");
            }
        }

        // Check consecutive work days
        var maxConsecutiveDays = settings.MaximumConsecutiveWorkDays;
        if (maxConsecutiveDays.HasValue)
        {
            var exceedsConsecutive = await ExceedsConsecutiveWorkDays(companyId, personId, shift.StartDate.Date);
            if (exceedsConsecutive)
            {
                result.Warnings.Add($"Would exceed maximum consecutive work days of {maxConsecutiveDays}");
            }
        }

        return result;
    }

    public async Task<bool> IsWithinDailyHoursLimit(string companyId, int personId, DateTime date, decimal hoursToAdd)
    {
        var settings = await _settingsService.GetOrCreateSettings(companyId);
        var maxDailyHours = settings.MaximumDailyHours;
        
        if (!maxDailyHours.HasValue) return true;

        var startOfDay = date.Date;
        var endOfDay = startOfDay.AddDays(1);

        var existingHours = await _context.ScheduleShifts
            .Where(s => s.CompanyId == companyId && 
                       s.PersonId == personId &&
                       s.StartDate >= startOfDay &&
                       s.StartDate < endOfDay)
            .SumAsync(s => (decimal)(s.EndDate - s.StartDate).TotalHours);

        return (existingHours + hoursToAdd) <= maxDailyHours.Value;
    }

    public async Task<bool> IsWithinWeeklyHoursLimit(string companyId, int personId, DateTime date, decimal hoursToAdd)
    {
        var settings = await _settingsService.GetOrCreateSettings(companyId);
        var maxWeeklyHours = settings.MaximumWeeklyHours;
        
        if (!maxWeeklyHours.HasValue) return true;

        // Get first day of week based on settings
        var firstDayOfWeek = settings.FirstDayOfWeek == "Monday" ? DayOfWeek.Monday : DayOfWeek.Sunday;
        
        // Calculate week start
        var daysFromFirstDay = ((int)date.DayOfWeek - (int)firstDayOfWeek + 7) % 7;
        var weekStart = date.Date.AddDays(-daysFromFirstDay);
        var weekEnd = weekStart.AddDays(7);

        var existingHours = await _context.ScheduleShifts
            .Where(s => s.CompanyId == companyId && 
                       s.PersonId == personId &&
                       s.StartDate >= weekStart &&
                       s.StartDate < weekEnd)
            .SumAsync(s => (decimal)(s.EndDate - s.StartDate).TotalHours);

        return (existingHours + hoursToAdd) <= maxWeeklyHours.Value;
    }

    public async Task<bool> ExceedsConsecutiveWorkDays(string companyId, int personId, DateTime date)
    {
        var settings = await _settingsService.GetOrCreateSettings(companyId);
        var maxConsecutiveDays = settings.MaximumConsecutiveWorkDays;
        
        if (!maxConsecutiveDays.HasValue) return false;

        // Count consecutive days before this date
        var consecutiveDays = 1; // Include the proposed day
        var checkDate = date.Date.AddDays(-1);

        for (int i = 0; i < maxConsecutiveDays.Value; i++)
        {
            var hasShift = await _context.ScheduleShifts
                .AnyAsync(s => s.CompanyId == companyId && 
                              s.PersonId == personId &&
                              s.StartDate.Date == checkDate);

            if (hasShift)
            {
                consecutiveDays++;
                checkDate = checkDate.AddDays(-1);
            }
            else
            {
                break;
            }
        }

        return consecutiveDays > maxConsecutiveDays.Value;
    }

    public async Task<bool> HasSufficientRestTime(string companyId, int personId, DateTime shiftStart)
    {
        var settings = await _settingsService.GetOrCreateSettings(companyId);
        var minHoursBetween = settings.MinimumHoursBetweenShifts;
        
        if (!minHoursBetween.HasValue) return true;

        // Find the most recent shift before this one
        var previousShift = await _context.ScheduleShifts
            .Where(s => s.CompanyId == companyId && 
                       s.PersonId == personId &&
                       s.EndDate < shiftStart)
            .OrderByDescending(s => s.EndDate)
            .FirstOrDefaultAsync();

        if (previousShift == null) return true;

    var hoursBetween = (shiftStart - previousShift.EndDate).TotalHours;
        return hoursBetween >= (double)minHoursBetween.Value;
    }

    public async Task<bool> WouldOverlapExistingShift(string companyId, int personId, DateTime shiftStart, DateTime shiftEnd)
    {
        return await _context.ScheduleShifts
            .AnyAsync(s => s.CompanyId == companyId && 
                          s.PersonId == personId &&
                          ((s.StartDate < shiftEnd && s.EndDate > shiftStart)));
    }
}
