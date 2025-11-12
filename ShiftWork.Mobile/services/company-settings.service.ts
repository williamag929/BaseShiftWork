import { apiClient } from './api-client';

export interface CompanySettings {
  settingsId: number;
  companyId: string;

  // Time & Regional Settings
  defaultTimeZone: string;
  defaultLanguage: string;
  firstDayOfWeek: string;
  dateFormat: string;
  timeFormat: string;
  currencySymbol: string;

  // Pay & Overtime Settings
  minimumHourlyRate: number;
  regularOvertimePercentage: number;
  nightShiftOvertimePercentage: number;
  holidayOvertimePercentage: number;
  weekendOvertimePercentage: number;
  nightShiftStartTime: string;
  nightShiftEndTime: string;
  dailyOvertimeThreshold: number;
  weeklyOvertimeThreshold: number;

  // PTO/Leave Settings
  defaultPtoAccrualRate: number;
  maximumPtoBalance: number | null;
  ptoRolloverAllowed: boolean;
  maximumPtoRollover: number | null;
  sickLeaveAccrualRate: number;
  sickLeaveMaximumBalance: number | null;
  requireManagerApprovalForPto: boolean;
  minimumNoticeDaysForPto: number;

  // Scheduling Settings
  autoApproveShifts: boolean;
  allowEmployeeShiftSwaps: boolean;
  requireManagerApprovalForSwaps: boolean;
  maximumConsecutiveWorkDays: number | null;
  minimumHoursBetweenShifts: number | null;
  maximumDailyHours: number | null;
  maximumWeeklyHours: number | null;
  allowOverlappingShifts: boolean;

  // Clock-In/Out Settings
  gracePeriodLateClockIn: number;
  autoClockOutAfter: number;
  requireGeoLocationForClockIn: boolean;
  geoFenceRadius: number;
  allowEarlyClockIn: number;
  requireBreakClocks: boolean;
  minimumBreakDuration: number;

  // Notification Settings
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  notifyOnShiftAssignment: boolean;
  notifyOnShiftChanges: boolean;
  notifyOnTimeOffApproval: boolean;
  notifyOnReplacementRequest: boolean;
  reminderHoursBeforeShift: number;

  // System Settings
  fiscalYearStartMonth: number;
  payrollPeriod: string;
  employeeIdPrefix: string;
  requireTwoFactorAuth: boolean;
  sessionTimeout: number;
  passwordExpirationDays: number;
  minimumPasswordLength: number;

  // Kiosk Settings
  kioskModeEnabled: boolean;
  kioskPinLength: number;
  requirePhotoOnClockIn: boolean;
  showEmployeePhotosOnKiosk: boolean;
  kioskTimeout: number;
  allowQuestionResponsesOnClockIn: boolean;
}

class CompanySettingsService {
  private settingsCache: Map<string, CompanySettings> = new Map();

  /**
   * Get company settings (creates defaults if none exist)
   */
  async getSettings(companyId: string): Promise<CompanySettings> {
    // Check cache first
    if (this.settingsCache.has(companyId)) {
      return this.settingsCache.get(companyId)!;
    }

    const response = await apiClient.get<CompanySettings>(
      `/companies/${companyId}/settings`
    );
    
    // Cache the settings
    this.settingsCache.set(companyId, response.data);
    return response.data;
  }

  /**
   * Update company settings
   */
  async updateSettings(companyId: string, settings: CompanySettings): Promise<CompanySettings> {
    const response = await apiClient.put<CompanySettings>(
      `/companies/${companyId}/settings`,
      settings
    );
    
    // Update cache
    this.settingsCache.set(companyId, response.data);
    return response.data;
  }

  /**
   * Clear settings cache
   */
  clearCache(companyId?: string): void {
    if (companyId) {
      this.settingsCache.delete(companyId);
    } else {
      this.settingsCache.clear();
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Format date according to company settings
   */
  formatDate(date: Date, settings: CompanySettings): string {
    const format = settings.dateFormat || 'MM/DD/YYYY';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();

    switch (format) {
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'MM/DD/YYYY':
      default:
        return `${month}/${day}/${year}`;
    }
  }

  /**
   * Format time according to company settings
   */
  formatTime(date: Date, settings: CompanySettings): string {
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeFormat = settings.timeFormat || '12';

    if (timeFormat === '24') {
      return `${String(hours).padStart(2, '0')}:${minutes}`;
    } else {
      const hour12 = hours % 12 || 12;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      return `${hour12}:${minutes} ${ampm}`;
    }
  }

  /**
   * Format currency according to company settings
   */
  formatCurrency(amount: number, settings: CompanySettings): string {
    const symbol = settings.currencySymbol || '$';
    return `${symbol}${amount.toFixed(2)}`;
  }

  /**
   * Check if geo-location is required for clock-in
   */
  isGeoLocationRequired(settings: CompanySettings): boolean {
    return settings.requireGeoLocationForClockIn;
  }

  /**
   * Get geo-fence radius in meters
   */
  getGeoFenceRadius(settings: CompanySettings): number {
    return settings.geoFenceRadius || 100;
  }

  /**
   * Get grace period for late clock-in (minutes)
   */
  getGracePeriod(settings: CompanySettings): number {
    return settings.gracePeriodLateClockIn || 5;
  }

  /**
   * Check if notifications are enabled
   */
  areNotificationsEnabled(settings: CompanySettings): boolean {
    return settings.pushNotificationsEnabled;
  }

  /**
   * Get reminder hours before shift
   */
  getReminderHours(settings: CompanySettings): number {
    return settings.reminderHoursBeforeShift || 24;
  }

  /**
   * Check if shift swaps are allowed
   */
  areShiftSwapsAllowed(settings: CompanySettings): boolean {
    return settings.allowEmployeeShiftSwaps;
  }

  /**
   * Check if manager approval is required for swaps
   */
  isApprovalRequiredForSwaps(settings: CompanySettings): boolean {
    return settings.requireManagerApprovalForSwaps;
  }

  /**
   * Get minimum notice days for PTO
   */
  getMinimumNoticeDaysForPto(settings: CompanySettings): number {
    return settings.minimumNoticeDaysForPto || 3;
  }
}

export const companySettingsService = new CompanySettingsService();
