namespace ShiftWork.Api.DTOs;

public class CompanySettingsDto
{
    public int SettingsId { get; set; }
    public string CompanyId { get; set; }

    // ==================== Time & Regional Settings ====================
    public string DefaultTimeZone { get; set; }
    public string DefaultLanguage { get; set; }
    public string FirstDayOfWeek { get; set; }
    public string DateFormat { get; set; }
    public string TimeFormat { get; set; }
    public string CurrencySymbol { get; set; }

    // ==================== Pay & Overtime Settings ====================
    public decimal MinimumHourlyRate { get; set; }
    public decimal RegularOvertimePercentage { get; set; }
    public decimal NightShiftOvertimePercentage { get; set; }
    public decimal HolidayOvertimePercentage { get; set; }
    public decimal WeekendOvertimePercentage { get; set; }
    public TimeSpan NightShiftStartTime { get; set; }
    public TimeSpan NightShiftEndTime { get; set; }
    public decimal DailyOvertimeThreshold { get; set; }
    public decimal WeeklyOvertimeThreshold { get; set; }

    // ==================== PTO/Leave Settings ====================
    public decimal DefaultPtoAccrualRate { get; set; }
    public decimal? MaximumPtoBalance { get; set; }
    public bool PtoRolloverAllowed { get; set; }
    public decimal? MaximumPtoRollover { get; set; }
    public decimal SickLeaveAccrualRate { get; set; }
    public decimal? SickLeaveMaximumBalance { get; set; }
    public bool RequireManagerApprovalForPto { get; set; }
    public int MinimumNoticeDaysForPto { get; set; }

    // ==================== Scheduling Settings ====================
    public bool AutoApproveShifts { get; set; }
    public bool AllowEmployeeShiftSwaps { get; set; }
    public bool RequireManagerApprovalForSwaps { get; set; }
    public int? MaximumConsecutiveWorkDays { get; set; }
    public decimal? MinimumHoursBetweenShifts { get; set; }
    public decimal? MaximumDailyHours { get; set; }
    public decimal? MaximumWeeklyHours { get; set; }
    public bool AllowOverlappingShifts { get; set; }

    // ==================== Clock-In/Out Settings ====================
    public int GracePeriodLateClockIn { get; set; }
    public int AutoClockOutAfter { get; set; }
    public bool RequireGeoLocationForClockIn { get; set; }
    public int GeoFenceRadius { get; set; }
    public int AllowEarlyClockIn { get; set; }
    public bool RequireBreakClocks { get; set; }
    public int MinimumBreakDuration { get; set; }

    // ==================== Notification Settings ====================
    public bool EmailNotificationsEnabled { get; set; }
    public bool SmsNotificationsEnabled { get; set; }
    public bool PushNotificationsEnabled { get; set; }
    public bool NotifyOnShiftAssignment { get; set; }
    public bool NotifyOnShiftChanges { get; set; }
    public bool NotifyOnTimeOffApproval { get; set; }
    public bool NotifyOnReplacementRequest { get; set; }
    public int ReminderHoursBeforeShift { get; set; }

    // ==================== System Settings ====================
    public int FiscalYearStartMonth { get; set; }
    public string PayrollPeriod { get; set; }
    public string EmployeeIdPrefix { get; set; }
    public bool RequireTwoFactorAuth { get; set; }
    public int SessionTimeout { get; set; }
    public int PasswordExpirationDays { get; set; }
    public int MinimumPasswordLength { get; set; }

    // ==================== Kiosk Settings ====================
    public bool KioskModeEnabled { get; set; }
    public int KioskPinLength { get; set; }
    public bool RequirePhotoOnClockIn { get; set; }
    public bool ShowEmployeePhotosOnKiosk { get; set; }
    public int KioskTimeout { get; set; }
    public bool AllowQuestionResponsesOnClockIn { get; set; }
}
