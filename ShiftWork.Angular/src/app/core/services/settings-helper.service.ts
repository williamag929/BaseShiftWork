import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { CompanySettingsService } from './company-settings.service';
import { CompanySettings } from '../models/company-settings.model';

@Injectable({
  providedIn: 'root'
})
export class SettingsHelperService {
  private settingsCache = new Map<string, CompanySettings>();
  private settingsSubject$ = new BehaviorSubject<CompanySettings | null>(null);
  
  public settings$ = this.settingsSubject$.asObservable();

  constructor(private companySettingsService: CompanySettingsService) {}

  /**
   * Load settings for a company (uses cache if available)
   */
  loadSettings(companyId: string, forceRefresh = false): Observable<CompanySettings> {
    if (!forceRefresh && this.settingsCache.has(companyId)) {
      const cached = this.settingsCache.get(companyId)!;
      this.settingsSubject$.next(cached);
      return new Observable(observer => {
        observer.next(cached);
        observer.complete();
      });
    }

    return this.companySettingsService.getSettings(companyId).pipe(
      tap(settings => {
        this.settingsCache.set(companyId, settings);
        this.settingsSubject$.next(settings);
      })
    );
  }

  /**
   * Get cached settings synchronously
   */
  getCachedSettings(companyId: string): CompanySettings | null {
    return this.settingsCache.get(companyId) || null;
  }

  /**
   * Clear cache (useful after settings update)
   */
  clearCache(companyId?: string): void {
    if (companyId) {
      this.settingsCache.delete(companyId);
    } else {
      this.settingsCache.clear();
    }
    this.settingsSubject$.next(null);
  }

  // ==================== Kiosk Settings Helpers ====================
  
  getKioskPinLength(settings: CompanySettings): number {
    return settings.kioskPinLength || 4;
  }

  isKioskPhotoRequired(settings: CompanySettings): boolean {
    return settings.requirePhotoOnClockIn;
  }

  getKioskTimeout(settings: CompanySettings): number {
    return (settings.kioskTimeout || 30) * 1000; // Convert to milliseconds
  }

  shouldShowEmployeePhotos(settings: CompanySettings): boolean {
    return settings.showEmployeePhotosOnKiosk;
  }

  areKioskQuestionsEnabled(settings: CompanySettings): boolean {
    return settings.allowQuestionResponsesOnClockIn;
  }

  // ==================== Clock-In/Out Helpers ====================
  
  getGracePeriodMinutes(settings: CompanySettings): number {
    return settings.gracePeriodLateClockIn || 5;
  }

  getAutoClockOutHours(settings: CompanySettings): number {
    return settings.autoClockOutAfter || 12;
  }

  isGeoLocationRequired(settings: CompanySettings): boolean {
    return settings.requireGeoLocationForClockIn;
  }

  getGeoFenceRadius(settings: CompanySettings): number {
    return settings.geoFenceRadius || 100;
  }

  getEarlyClockInMinutes(settings: CompanySettings): number {
    return settings.allowEarlyClockIn || 15;
  }

  areBreakClocksRequired(settings: CompanySettings): boolean {
    return settings.requireBreakClocks;
  }

  getMinimumBreakDuration(settings: CompanySettings): number {
    return settings.minimumBreakDuration || 30;
  }

  // ==================== Scheduling Helpers ====================
  
  shouldAutoApproveShifts(settings: CompanySettings): boolean {
    return settings.autoApproveShifts;
  }

  areShiftSwapsAllowed(settings: CompanySettings): boolean {
    return settings.allowEmployeeShiftSwaps;
  }

  isManagerApprovalRequiredForSwaps(settings: CompanySettings): boolean {
    return settings.requireManagerApprovalForSwaps;
  }

  getMaxConsecutiveWorkDays(settings: CompanySettings): number | null {
    return settings.maximumConsecutiveWorkDays;
  }

  getMinHoursBetweenShifts(settings: CompanySettings): number | null {
    return settings.minimumHoursBetweenShifts;
  }

  getMaxDailyHours(settings: CompanySettings): number | null {
    return settings.maximumDailyHours;
  }

  getMaxWeeklyHours(settings: CompanySettings): number | null {
    return settings.maximumWeeklyHours;
  }

  areOverlappingShiftsAllowed(settings: CompanySettings): boolean {
    return settings.allowOverlappingShifts;
  }

  // ==================== Pay & Overtime Helpers ====================
  
  getMinimumHourlyRate(settings: CompanySettings): number {
    return settings.minimumHourlyRate || 15.00;
  }

  getOvertimeMultiplier(settings: CompanySettings, shiftType: 'regular' | 'night' | 'holiday' | 'weekend'): number {
    const percentages = {
      regular: settings.regularOvertimePercentage || 150,
      night: settings.nightShiftOvertimePercentage || 125,
      holiday: settings.holidayOvertimePercentage || 200,
      weekend: settings.weekendOvertimePercentage || 150
    };
    return percentages[shiftType] / 100;
  }

  isNightShift(settings: CompanySettings, time: Date): boolean {
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const timeValue = hours * 60 + minutes;
    
    // Parse night shift times (format: HH:mm:ss)
    const startParts = settings.nightShiftStartTime.split(':');
    const endParts = settings.nightShiftEndTime.split(':');
    
    const startValue = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const endValue = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
    
    // Handle night shifts that cross midnight
    if (startValue > endValue) {
      return timeValue >= startValue || timeValue < endValue;
    } else {
      return timeValue >= startValue && timeValue < endValue;
    }
  }

  getDailyOvertimeThreshold(settings: CompanySettings): number {
    return settings.dailyOvertimeThreshold || 8.0;
  }

  getWeeklyOvertimeThreshold(settings: CompanySettings): number {
    return settings.weeklyOvertimeThreshold || 40.0;
  }

  // ==================== Time & Regional Helpers ====================
  
  getTimeZone(settings: CompanySettings): string {
    return settings.defaultTimeZone || 'UTC';
  }

  getLanguage(settings: CompanySettings): string {
    return settings.defaultLanguage || 'en';
  }

  getFirstDayOfWeek(settings: CompanySettings): 0 | 1 {
    return settings.firstDayOfWeek === 'Monday' ? 1 : 0;
  }

  getDateFormat(settings: CompanySettings): string {
    return settings.dateFormat || 'MM/DD/YYYY';
  }

  getTimeFormat(settings: CompanySettings): '12' | '24' {
    return (settings.timeFormat || '12') as '12' | '24';
  }

  getCurrencySymbol(settings: CompanySettings): string {
    return settings.currencySymbol || '$';
  }

  // ==================== Notification Helpers ====================
  
  isEmailEnabled(settings: CompanySettings): boolean {
    return settings.emailNotificationsEnabled;
  }

  isSmsEnabled(settings: CompanySettings): boolean {
    return settings.smsNotificationsEnabled;
  }

  isPushEnabled(settings: CompanySettings): boolean {
    return settings.pushNotificationsEnabled;
  }

  shouldNotifyOnShiftAssignment(settings: CompanySettings): boolean {
    return settings.notifyOnShiftAssignment;
  }

  shouldNotifyOnShiftChanges(settings: CompanySettings): boolean {
    return settings.notifyOnShiftChanges;
  }

  shouldNotifyOnTimeOffApproval(settings: CompanySettings): boolean {
    return settings.notifyOnTimeOffApproval;
  }

  shouldNotifyOnReplacementRequest(settings: CompanySettings): boolean {
    return settings.notifyOnReplacementRequest;
  }

  getReminderHoursBeforeShift(settings: CompanySettings): number {
    return settings.reminderHoursBeforeShift || 24;
  }

  // ==================== PTO Helpers ====================
  
  getDefaultPtoAccrualRate(settings: CompanySettings): number {
    return settings.defaultPtoAccrualRate || 10.0;
  }

  isPtoRolloverAllowed(settings: CompanySettings): boolean {
    return settings.ptoRolloverAllowed;
  }

  isManagerApprovalRequiredForPto(settings: CompanySettings): boolean {
    return settings.requireManagerApprovalForPto;
  }

  getMinimumNoticeDaysForPto(settings: CompanySettings): number {
    return settings.minimumNoticeDaysForPto || 3;
  }
}
