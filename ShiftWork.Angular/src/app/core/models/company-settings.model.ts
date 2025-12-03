export interface CompanySettings {
  settingsId: number;
  companyId: string;

  // ==================== Time & Regional Settings ====================
  defaultTimeZone: string;
  defaultLanguage: string;
  firstDayOfWeek: string;
  dateFormat: string;
  timeFormat: string;
  currencySymbol: string;

  // ==================== Pay & Overtime Settings ====================
  minimumHourlyRate: number;
  regularOvertimePercentage: number;
  nightShiftOvertimePercentage: number;
  holidayOvertimePercentage: number;
  weekendOvertimePercentage: number;
  nightShiftStartTime: string; // HH:mm:ss format
  nightShiftEndTime: string; // HH:mm:ss format
  dailyOvertimeThreshold: number;
  weeklyOvertimeThreshold: number;

  // ==================== PTO/Leave Settings ====================
  defaultPtoAccrualRate: number;
  maximumPtoBalance: number | null;
  ptoRolloverAllowed: boolean;
  maximumPtoRollover: number | null;
  sickLeaveAccrualRate: number;
  sickLeaveMaximumBalance: number | null;
  requireManagerApprovalForPto: boolean;
  minimumNoticeDaysForPto: number;

  // ==================== Scheduling Settings ====================
  autoApproveShifts: boolean;
  allowEmployeeShiftSwaps: boolean;
  requireManagerApprovalForSwaps: boolean;
  maximumConsecutiveWorkDays: number | null;
  minimumHoursBetweenShifts: number | null;
  maximumDailyHours: number | null;
  maximumWeeklyHours: number | null;
  allowOverlappingShifts: boolean;

  // ==================== Clock-In/Out Settings ====================
  gracePeriodLateClockIn: number;
  autoClockOutAfter: number;
  requireGeoLocationForClockIn: boolean;
  geoFenceRadius: number;
  allowEarlyClockIn: number;
  requireBreakClocks: boolean;
  minimumBreakDuration: number;

  // ==================== Notification Settings ====================
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  notifyOnShiftAssignment: boolean;
  notifyOnShiftChanges: boolean;
  notifyOnTimeOffApproval: boolean;
  notifyOnReplacementRequest: boolean;
  reminderHoursBeforeShift: number;

  // ==================== System Settings ====================
  fiscalYearStartMonth: number;
  payrollPeriod: string;
  employeeIdPrefix: string;
  requireTwoFactorAuth: boolean;
  sessionTimeout: number;
  passwordExpirationDays: number;
  minimumPasswordLength: number;

  // ==================== Kiosk Settings ====================
  kioskModeEnabled: boolean;
  kioskPinLength: number;
  requirePhotoOnClockIn: boolean;
  showEmployeePhotosOnKiosk: boolean;
  kioskTimeout: number;
  allowQuestionResponsesOnClockIn: boolean;
}
