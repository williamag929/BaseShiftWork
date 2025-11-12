using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShiftWork.Api.Models;

public class CompanySettings : BaseEntity
{
    [Key]
    public int SettingsId { get; set; }

    [Required]
    public string CompanyId { get; set; }

    // Navigation
    public Company Company { get; set; }

    // ==================== Time & Regional Settings ====================
    public string DefaultTimeZone { get; set; } = "UTC";
    public string DefaultLanguage { get; set; } = "en";
    public string FirstDayOfWeek { get; set; } = "Sunday"; // Sunday, Monday
    public string DateFormat { get; set; } = "MM/DD/YYYY"; // MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
    public string TimeFormat { get; set; } = "12"; // 12, 24
    public string CurrencySymbol { get; set; } = "$";

    // ==================== Pay & Overtime Settings ====================
    public decimal MinimumHourlyRate { get; set; } = 15.00m;
    public decimal RegularOvertimePercentage { get; set; } = 150.00m; // 150% = 1.5x
    public decimal NightShiftOvertimePercentage { get; set; } = 125.00m;
    public decimal HolidayOvertimePercentage { get; set; } = 200.00m;
    public decimal WeekendOvertimePercentage { get; set; } = 150.00m;
    public TimeSpan NightShiftStartTime { get; set; } = new TimeSpan(22, 0, 0); // 10:00 PM
    public TimeSpan NightShiftEndTime { get; set; } = new TimeSpan(6, 0, 0); // 6:00 AM
    public decimal DailyOvertimeThreshold { get; set; } = 8.0m; // hours
    public decimal WeeklyOvertimeThreshold { get; set; } = 40.0m; // hours

    // ==================== PTO/Leave Settings ====================
    public decimal DefaultPtoAccrualRate { get; set; } = 10.0m; // hours per month
    public decimal? MaximumPtoBalance { get; set; } = 240.0m; // hours
    public bool PtoRolloverAllowed { get; set; } = true;
    public decimal? MaximumPtoRollover { get; set; } = 80.0m; // hours
    public decimal SickLeaveAccrualRate { get; set; } = 8.0m; // hours per month
    public decimal? SickLeaveMaximumBalance { get; set; } = 120.0m; // hours
    public bool RequireManagerApprovalForPto { get; set; } = true;
    public int MinimumNoticeDaysForPto { get; set; } = 3; // days

    // ==================== Scheduling Settings ====================
    public bool AutoApproveShifts { get; set; } = false;
    public bool AllowEmployeeShiftSwaps { get; set; } = true;
    public bool RequireManagerApprovalForSwaps { get; set; } = true;
    public int? MaximumConsecutiveWorkDays { get; set; } = 6;
    public decimal? MinimumHoursBetweenShifts { get; set; } = 8.0m;
    public decimal? MaximumDailyHours { get; set; } = 12.0m;
    public decimal? MaximumWeeklyHours { get; set; } = 60.0m;
    public bool AllowOverlappingShifts { get; set; } = false;

    // ==================== Clock-In/Out Settings ====================
    public int GracePeriodLateClockIn { get; set; } = 5; // minutes
    public int AutoClockOutAfter { get; set; } = 12; // hours
    public bool RequireGeoLocationForClockIn { get; set; } = false;
    public int GeoFenceRadius { get; set; } = 100; // meters
    public int AllowEarlyClockIn { get; set; } = 15; // minutes before shift
    public bool RequireBreakClocks { get; set; } = false;
    public int MinimumBreakDuration { get; set; } = 30; // minutes

    // ==================== Notification Settings ====================
    public bool EmailNotificationsEnabled { get; set; } = true;
    public bool SmsNotificationsEnabled { get; set; } = false;
    public bool PushNotificationsEnabled { get; set; } = true;
    public bool NotifyOnShiftAssignment { get; set; } = true;
    public bool NotifyOnShiftChanges { get; set; } = true;
    public bool NotifyOnTimeOffApproval { get; set; } = true;
    public bool NotifyOnReplacementRequest { get; set; } = true;
    public int ReminderHoursBeforeShift { get; set; } = 24; // hours

    // ==================== System Settings ====================
    public int FiscalYearStartMonth { get; set; } = 1; // January
    public string PayrollPeriod { get; set; } = "BiWeekly"; // Weekly, BiWeekly, SemiMonthly, Monthly
    public string EmployeeIdPrefix { get; set; } = "EMP";
    public bool RequireTwoFactorAuth { get; set; } = false;
    public int SessionTimeout { get; set; } = 60; // minutes
    public int PasswordExpirationDays { get; set; } = 90;
    public int MinimumPasswordLength { get; set; } = 8;

    // ==================== Kiosk Settings ====================
    public bool KioskModeEnabled { get; set; } = true;
    public int KioskPinLength { get; set; } = 4;
    public bool RequirePhotoOnClockIn { get; set; } = false;
    public bool ShowEmployeePhotosOnKiosk { get; set; } = true;
    public int KioskTimeout { get; set; } = 30; // seconds
    public bool AllowQuestionResponsesOnClockIn { get; set; } = false;
}
