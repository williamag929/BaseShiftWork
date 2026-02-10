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

    public async Task<ValidationResult> ValidateScheduleShift(string companyId, ScheduleShift shift, int personId, int? ignoreScheduleShiftId = null)
    {
        var result = new ValidationResult { IsValid = true };
        var settings = await _settingsService.GetOrCreateSettings(companyId);

        // Check overlapping shifts
        if (!settings.AllowOverlappingShifts)
        {
            var hasOverlap = await WouldOverlapExistingShift(companyId, personId, shift.StartDate, shift.EndDate, ignoreScheduleShiftId);
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
            var hasSufficientRest = await HasSufficientRestTime(companyId, personId, shift.StartDate, ignoreScheduleShiftId);
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
            var isWithinDaily = await IsWithinDailyHoursLimit(companyId, personId, shift.StartDate.Date, shiftHours, ignoreScheduleShiftId);
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
            var isWithinWeekly = await IsWithinWeeklyHoursLimit(companyId, personId, shift.StartDate, shiftHours, ignoreScheduleShiftId);
            if (!isWithinWeekly)
            {
                result.Warnings.Add($"Would exceed maximum weekly hours of {maxWeeklyHours}");
            }
        }

        // Check consecutive work days
        var maxConsecutiveDays = settings.MaximumConsecutiveWorkDays;
        if (maxConsecutiveDays.HasValue)
        {
            var exceedsConsecutive = await ExceedsConsecutiveWorkDays(companyId, personId, shift.StartDate.Date, ignoreScheduleShiftId);
            if (exceedsConsecutive)
            {
                result.Warnings.Add($"Would exceed maximum consecutive work days of {maxConsecutiveDays}");
            }
        }

        return result;
    }

    public async Task<ValidationResult> ValidateSchedule(string companyId, Schedule schedule, int personId, int? ignoreScheduleId = null)
    {
        var result = new ValidationResult { IsValid = true };
        var settings = await _settingsService.GetOrCreateSettings(companyId);

        if (!settings.AllowOverlappingShifts)
        {
            var hasOverlap = await WouldOverlapExistingSchedule(companyId, personId, schedule.StartDate, schedule.EndDate, ignoreScheduleId);
            if (hasOverlap)
            {
                result.IsValid = false;
                result.Errors.Add("This shift overlaps with an existing shift");
            }
        }

        var minHoursBetween = settings.MinimumHoursBetweenShifts;
        if (minHoursBetween.HasValue)
        {
            var hasSufficientRest = await HasSufficientRestTimeForSchedule(companyId, personId, schedule.StartDate, ignoreScheduleId);
            if (!hasSufficientRest)
            {
                result.IsValid = false;
                result.Errors.Add($"Requires at least {minHoursBetween} hours between shifts");
            }
        }

        var maxDailyHours = settings.MaximumDailyHours;
        if (maxDailyHours.HasValue)
        {
            var shiftHours = (decimal)(schedule.EndDate - schedule.StartDate).TotalHours;
            var isWithinDaily = await IsWithinDailyHoursLimitForSchedule(companyId, personId, schedule.StartDate.Date, shiftHours, ignoreScheduleId);
            if (!isWithinDaily)
            {
                result.IsValid = false;
                result.Errors.Add($"Would exceed maximum daily hours of {maxDailyHours}");
            }
        }

        var maxWeeklyHours = settings.MaximumWeeklyHours;
        if (maxWeeklyHours.HasValue)
        {
            var shiftHours = (decimal)(schedule.EndDate - schedule.StartDate).TotalHours;
            var isWithinWeekly = await IsWithinWeeklyHoursLimitForSchedule(companyId, personId, schedule.StartDate, shiftHours, ignoreScheduleId);
            if (!isWithinWeekly)
            {
                result.Warnings.Add($"Would exceed maximum weekly hours of {maxWeeklyHours}");
            }
        }

        var maxConsecutiveDays = settings.MaximumConsecutiveWorkDays;
        if (maxConsecutiveDays.HasValue)
        {
            var exceedsConsecutive = await ExceedsConsecutiveWorkDaysForSchedule(companyId, personId, schedule.StartDate.Date, ignoreScheduleId);
            if (exceedsConsecutive)
            {
                result.Warnings.Add($"Would exceed maximum consecutive work days of {maxConsecutiveDays}");
            }
        }

        return result;
    }

    public async Task<bool> IsWithinDailyHoursLimit(string companyId, int personId, DateTime date, decimal hoursToAdd, int? ignoreScheduleShiftId = null)
    {
        var settings = await _settingsService.GetOrCreateSettings(companyId);
        var maxDailyHours = settings.MaximumDailyHours;
        
        if (!maxDailyHours.HasValue) return true;

        var startOfDay = date.Date;
        var endOfDay = startOfDay.AddDays(1);

        var query = _context.ScheduleShifts
            .Where(s => s.CompanyId == companyId && 
                       s.PersonId == personId &&
                       s.StartDate >= startOfDay &&
                       s.StartDate < endOfDay);

        if (ignoreScheduleShiftId.HasValue)
        {
            query = query.Where(s => s.ScheduleShiftId != ignoreScheduleShiftId.Value);
        }

        var existingMinutes = await query
            .SumAsync(s => EF.Functions.DateDiffMinute(s.StartDate, s.EndDate));

        var existingHours = existingMinutes / 60m;

        return (existingHours + hoursToAdd) <= maxDailyHours.Value;
    }

    public async Task<bool> IsWithinWeeklyHoursLimit(string companyId, int personId, DateTime date, decimal hoursToAdd, int? ignoreScheduleShiftId = null)
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

        var query = _context.ScheduleShifts
            .Where(s => s.CompanyId == companyId && 
                       s.PersonId == personId &&
                       s.StartDate >= weekStart &&
                       s.StartDate < weekEnd);

        if (ignoreScheduleShiftId.HasValue)
        {
            query = query.Where(s => s.ScheduleShiftId != ignoreScheduleShiftId.Value);
        }

        var existingMinutes = await query
            .SumAsync(s => EF.Functions.DateDiffMinute(s.StartDate, s.EndDate));

        var existingHours = existingMinutes / 60m;

        return (existingHours + hoursToAdd) <= maxWeeklyHours.Value;
    }

    public async Task<bool> ExceedsConsecutiveWorkDays(string companyId, int personId, DateTime date, int? ignoreScheduleShiftId = null)
    {
        var settings = await _settingsService.GetOrCreateSettings(companyId);
        var maxConsecutiveDays = settings.MaximumConsecutiveWorkDays;
        
        if (!maxConsecutiveDays.HasValue) return false;

        // Count consecutive days before this date
        var consecutiveDays = 1; // Include the proposed day
        var checkDate = date.Date.AddDays(-1);

        for (int i = 0; i < maxConsecutiveDays.Value; i++)
        {
            var query = _context.ScheduleShifts
                .Where(s => s.CompanyId == companyId && 
                              s.PersonId == personId &&
                              s.StartDate.Date == checkDate);

            if (ignoreScheduleShiftId.HasValue)
            {
                query = query.Where(s => s.ScheduleShiftId != ignoreScheduleShiftId.Value);
            }

            var hasShift = await query.AnyAsync();

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

    public async Task<bool> HasSufficientRestTime(string companyId, int personId, DateTime shiftStart, int? ignoreScheduleShiftId = null)
    {
        var settings = await _settingsService.GetOrCreateSettings(companyId);
        var minHoursBetween = settings.MinimumHoursBetweenShifts;
        
        if (!minHoursBetween.HasValue) return true;

        var query = _context.ScheduleShifts
            .Where(s => s.CompanyId == companyId && 
                       s.PersonId == personId &&
                       s.EndDate < shiftStart);

        if (ignoreScheduleShiftId.HasValue)
        {
            query = query.Where(s => s.ScheduleShiftId != ignoreScheduleShiftId.Value);
        }

        var previousShift = await query
            .OrderByDescending(s => s.EndDate)
            .FirstOrDefaultAsync();

        if (previousShift == null) return true;

    var hoursBetween = (shiftStart - previousShift.EndDate).TotalHours;
        return hoursBetween >= (double)minHoursBetween.Value;
    }

    public async Task<bool> WouldOverlapExistingShift(string companyId, int personId, DateTime shiftStart, DateTime shiftEnd, int? ignoreScheduleShiftId = null)
    {
        var query = _context.ScheduleShifts
            .Where(s => s.CompanyId == companyId && 
                          s.PersonId == personId &&
                          ((s.StartDate < shiftEnd && s.EndDate > shiftStart)));

        if (ignoreScheduleShiftId.HasValue)
        {
            query = query.Where(s => s.ScheduleShiftId != ignoreScheduleShiftId.Value);
        }

        return await query.AnyAsync();
    }

    public async Task<bool> IsWithinDailyHoursLimitForSchedule(string companyId, int personId, DateTime date, decimal hoursToAdd, int? ignoreScheduleId = null)
    {
        var settings = await _settingsService.GetOrCreateSettings(companyId);
        var maxDailyHours = settings.MaximumDailyHours;

        if (!maxDailyHours.HasValue) return true;

        var startOfDay = date.Date;
        var endOfDay = startOfDay.AddDays(1);

        var query = _context.Schedules
            .Where(s => s.CompanyId == companyId &&
                        s.PersonId == personId.ToString() &&
                        s.StartDate >= startOfDay &&
                        s.StartDate < endOfDay);

        if (ignoreScheduleId.HasValue)
        {
            query = query.Where(s => s.ScheduleId != ignoreScheduleId.Value);
        }

        var existingMinutes = await query
            .SumAsync(s => EF.Functions.DateDiffMinute(s.StartDate, s.EndDate));

        var existingHours = existingMinutes / 60m;

        return (existingHours + hoursToAdd) <= maxDailyHours.Value;
    }

    public async Task<bool> IsWithinWeeklyHoursLimitForSchedule(string companyId, int personId, DateTime date, decimal hoursToAdd, int? ignoreScheduleId = null)
    {
        var settings = await _settingsService.GetOrCreateSettings(companyId);
        var maxWeeklyHours = settings.MaximumWeeklyHours;

        if (!maxWeeklyHours.HasValue) return true;

        var firstDayOfWeek = settings.FirstDayOfWeek == "Monday" ? DayOfWeek.Monday : DayOfWeek.Sunday;
        var daysFromFirstDay = ((int)date.DayOfWeek - (int)firstDayOfWeek + 7) % 7;
        var weekStart = date.Date.AddDays(-daysFromFirstDay);
        var weekEnd = weekStart.AddDays(7);

        var query = _context.Schedules
            .Where(s => s.CompanyId == companyId &&
                        s.PersonId == personId.ToString() &&
                        s.StartDate >= weekStart &&
                        s.StartDate < weekEnd);

        if (ignoreScheduleId.HasValue)
        {
            query = query.Where(s => s.ScheduleId != ignoreScheduleId.Value);
        }

        var existingMinutes = await query
            .SumAsync(s => EF.Functions.DateDiffMinute(s.StartDate, s.EndDate));

        var existingHours = existingMinutes / 60m;

        return (existingHours + hoursToAdd) <= maxWeeklyHours.Value;
    }

    public async Task<bool> ExceedsConsecutiveWorkDaysForSchedule(string companyId, int personId, DateTime date, int? ignoreScheduleId = null)
    {
        var settings = await _settingsService.GetOrCreateSettings(companyId);
        var maxConsecutiveDays = settings.MaximumConsecutiveWorkDays;

        if (!maxConsecutiveDays.HasValue) return false;

        var consecutiveDays = 1;
        var checkDate = date.Date.AddDays(-1);

        for (int i = 0; i < maxConsecutiveDays.Value; i++)
        {
            var query = _context.Schedules
                .Where(s => s.CompanyId == companyId &&
                            s.PersonId == personId.ToString() &&
                            s.StartDate.Date == checkDate);

            if (ignoreScheduleId.HasValue)
            {
                query = query.Where(s => s.ScheduleId != ignoreScheduleId.Value);
            }

            var hasShift = await query.AnyAsync();

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

    public async Task<bool> HasSufficientRestTimeForSchedule(string companyId, int personId, DateTime shiftStart, int? ignoreScheduleId = null)
    {
        var settings = await _settingsService.GetOrCreateSettings(companyId);
        var minHoursBetween = settings.MinimumHoursBetweenShifts;

        if (!minHoursBetween.HasValue) return true;

        var query = _context.Schedules
            .Where(s => s.CompanyId == companyId &&
                        s.PersonId == personId.ToString() &&
                        s.EndDate < shiftStart);

        if (ignoreScheduleId.HasValue)
        {
            query = query.Where(s => s.ScheduleId != ignoreScheduleId.Value);
        }

        var previousShift = await query
            .OrderByDescending(s => s.EndDate)
            .FirstOrDefaultAsync();

        if (previousShift == null) return true;

        var hoursBetween = (shiftStart - previousShift.EndDate).TotalHours;
        return hoursBetween >= (double)minHoursBetween.Value;
    }

    public async Task<bool> WouldOverlapExistingSchedule(string companyId, int personId, DateTime shiftStart, DateTime shiftEnd, int? ignoreScheduleId = null)
    {
        var query = _context.Schedules
            .Where(s => s.CompanyId == companyId &&
                        s.PersonId == personId.ToString() &&
                        s.StartDate < shiftEnd && s.EndDate > shiftStart);

        if (ignoreScheduleId.HasValue)
        {
            query = query.Where(s => s.ScheduleId != ignoreScheduleId.Value);
        }

        return await query.AnyAsync();
    }
}
