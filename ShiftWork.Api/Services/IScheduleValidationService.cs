using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services;

public interface IScheduleValidationService
{
    Task<ValidationResult> ValidateScheduleShift(string companyId, ScheduleShift shift, int personId, int? ignoreScheduleShiftId = null);
    Task<ValidationResult> ValidateSchedule(string companyId, Schedule schedule, int personId, int? ignoreScheduleId = null);
    Task<bool> IsWithinDailyHoursLimit(string companyId, int personId, DateTime date, decimal hoursToAdd, int? ignoreScheduleShiftId = null);
    Task<bool> IsWithinWeeklyHoursLimit(string companyId, int personId, DateTime date, decimal hoursToAdd, int? ignoreScheduleShiftId = null);
    Task<bool> ExceedsConsecutiveWorkDays(string companyId, int personId, DateTime date, int? ignoreScheduleShiftId = null);
    Task<bool> HasSufficientRestTime(string companyId, int personId, DateTime shiftStart, int? ignoreScheduleShiftId = null);
    Task<bool> WouldOverlapExistingShift(string companyId, int personId, DateTime shiftStart, DateTime shiftEnd, int? ignoreScheduleShiftId = null);
    Task<bool> IsWithinDailyHoursLimitForSchedule(string companyId, int personId, DateTime date, decimal hoursToAdd, int? ignoreScheduleId = null);
    Task<bool> IsWithinWeeklyHoursLimitForSchedule(string companyId, int personId, DateTime date, decimal hoursToAdd, int? ignoreScheduleId = null);
    Task<bool> ExceedsConsecutiveWorkDaysForSchedule(string companyId, int personId, DateTime date, int? ignoreScheduleId = null);
    Task<bool> HasSufficientRestTimeForSchedule(string companyId, int personId, DateTime shiftStart, int? ignoreScheduleId = null);
    Task<bool> WouldOverlapExistingSchedule(string companyId, int personId, DateTime shiftStart, DateTime shiftEnd, int? ignoreScheduleId = null);
}

public class ValidationResult
{
    public bool IsValid { get; set; }
    public List<string> Errors { get; set; } = new List<string>();
    public List<string> Warnings { get; set; } = new List<string>();
}
