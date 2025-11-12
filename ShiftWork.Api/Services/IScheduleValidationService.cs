using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services;

public interface IScheduleValidationService
{
    Task<ValidationResult> ValidateScheduleShift(string companyId, ScheduleShift shift, int personId);
    Task<bool> IsWithinDailyHoursLimit(string companyId, int personId, DateTime date, decimal hoursToAdd);
    Task<bool> IsWithinWeeklyHoursLimit(string companyId, int personId, DateTime date, decimal hoursToAdd);
    Task<bool> ExceedsConsecutiveWorkDays(string companyId, int personId, DateTime date);
    Task<bool> HasSufficientRestTime(string companyId, int personId, DateTime shiftStart);
    Task<bool> WouldOverlapExistingShift(string companyId, int personId, DateTime shiftStart, DateTime shiftEnd);
}

public class ValidationResult
{
    public bool IsValid { get; set; }
    public List<string> Errors { get; set; } = new List<string>();
    public List<string> Warnings { get; set; } = new List<string>();
}
