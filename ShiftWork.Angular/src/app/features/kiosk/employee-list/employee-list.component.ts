import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { People as Person } from 'src/app/core/models/people.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subscription, interval, from, of } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { KioskService } from '../core/services/kiosk.service';
import { ScheduleService } from 'src/app/core/services/schedule.service';
import { MatDialog } from '@angular/material/dialog';
import { PinDialogComponent } from '../pin-dialog/pin-dialog.component';
import { Company } from 'src/app/core/models/company.model';
import { FormControl } from '@angular/forms';
import { startWith, map, mergeMap, catchError, finalize } from 'rxjs/operators';
import { SettingsHelperService } from 'src/app/core/services/settings-helper.service';
import { CompanySettings } from 'src/app/core/models/company-settings.model';
import { environment } from 'src/environments/environment';
import { ActivatedRoute } from '@angular/router';
import { WakeLockService } from '../core/services/wake-lock.service';
import { ShiftEventService } from 'src/app/core/services/shift-event.service';

@Component({
  selector: 'app-employee-list',
  templateUrl: './employee-list.component.html',
  styleUrls: ['./employee-list.component.css'],
  standalone: false
})
export class EmployeeListComponent implements OnInit, OnDestroy {
  employees: Person[] = [];
  filteredEmployees: Person[] = [];
  loading = false;
  refreshing = false;
  error: any = null;
  activeCompany$: Observable<Company | null>;
  activeCompany: Company | null = null;
  searchControl = new FormControl('');
  settings: CompanySettings | null = null;
  showEmployeePhotos = true;
  kioskTimeout = 30000; // milliseconds
  private statusRefreshSub: Subscription = Subscription.EMPTY;
  lastUpdated: Date | null = null;
  private refreshIntervalMs = environment.kioskStatusRefreshMs || 45000;
  showLegend = true;
  completedScheduleCounts: Record<number, number> = {};

  constructor(
    private peopleService: PeopleService,
    private readonly kioskService: KioskService,
    private scheduleService: ScheduleService,
    private router: Router,
    private toastr: ToastrService,
    private store: Store<AppState>,
    private dialog: MatDialog,
    private settingsHelper: SettingsHelperService,
    private route: ActivatedRoute,
    public wakeLock: WakeLockService,
    private shiftEventService: ShiftEventService
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {
    // Acquire wake lock for kiosk list view
    this.wakeLock.request();
    // Default legend collapsed on small screens; allow persisted preference to override
    const isMobile = window.matchMedia('(max-width: 767.98px)').matches;
    this.showLegend = !isMobile; // temporary default until company is known
    // Optional override via query param (?refreshMs=60000)
    const qpMs = Number(this.route.snapshot.queryParamMap.get('refreshMs'));
    if (!isNaN(qpMs) && qpMs >= 5000) {
      this.refreshIntervalMs = qpMs;
    }
    this.activeCompany$.subscribe((company: Company | null) => {
      if (company) {
        this.activeCompany = company;
        // Re-evaluate legend preference per company
        try {
          const key = `employeeListLegendOpen_${company.companyId}`;
          const storedPerCompany = localStorage.getItem(key);
          if (storedPerCompany === null) {
            this.showLegend = !isMobile; // default based on device
          } else {
            this.showLegend = storedPerCompany === 'true';
          }
        } catch {
          // ignore storage errors
        }
        
        // Load settings
        this.settingsHelper.loadSettings(company.companyId).subscribe(settings => {
          this.settings = settings;
          this.showEmployeePhotos = this.settingsHelper.shouldShowEmployeePhotos(settings);
          this.kioskTimeout = this.settingsHelper.getKioskTimeout(settings);
        });
        
        this.loading = true;
        this.peopleService.getPeople(company.companyId).subscribe(
          (people: Person[]) => {
            this.employees = people.filter(p => p.companyId === company.companyId);
            this.filteredEmployees = this.employees;
            
            // Load published schedules for today for all employees
            this.loadPublishedSchedulesForToday();

            // Start periodic status refresh (initial + interval)
            this.startStatusRefresh();
            
            this.searchControl.valueChanges.pipe(
              startWith(''),
              map(value => this._filter(value || ''))
            ).subscribe(filtered => {
              this.filteredEmployees = filtered;
            });
            this.loading = false;
          },
          (error: any) => {
            this.error = error;
            this.loading = false;
            this.toastr.error('Error loading employees');
          }
        );
      }
    });

    // Apply immediate status updates from the photo-schedule flow
    this.kioskService.statusUpdate$.subscribe(({ personId, status }) => {
      const e = this.employees.find(p => p.personId === personId);
      if (e) e.statusShiftWork = status;
      const f = this.filteredEmployees.find(p => p.personId === personId);
      if (f) f.statusShiftWork = status;
      this.lastUpdated = new Date();
    });
  }

  ngOnDestroy(): void {
    // Release wake lock when leaving kiosk view
    this.wakeLock.release();
    this.stopStatusRefresh();
  }

  private startStatusRefresh(): void {
    this.stopStatusRefresh();
    // Immediate run, then every 45 seconds
    this.refreshStatuses();
    this.statusRefreshSub = interval(this.refreshIntervalMs).subscribe(() => this.refreshStatuses());
  }

  private stopStatusRefresh(): void {
    if (this.statusRefreshSub) {
      this.statusRefreshSub.unsubscribe();
    }
    this.statusRefreshSub = Subscription.EMPTY;
  }

  refreshStatuses(): void {
    if (!this.activeCompany || !this.filteredEmployees?.length) return;
    this.refreshing = true;
    const companyId = this.activeCompany.companyId;
    // Limit to first 50 currently filtered employees to avoid excessive requests
    const target = this.filteredEmployees.slice(0, 50);
    from(target)
      .pipe(
        mergeMap(
          (emp: Person) =>
            this.peopleService
              .getPersonStatusShiftWork(companyId, emp.personId)
              .pipe(
                map((status: string) => ({ personId: emp.personId, status })),
                catchError(() => of({ personId: emp.personId, status: emp.statusShiftWork || null }))
              ),
          5 // concurrency limit
        ),
        finalize(() => {
          this.refreshing = false;
          this.lastUpdated = new Date();
        })
      )
      .subscribe(({ personId, status }) => {
        // Update in employees array
        const e = this.employees.find(p => p.personId === personId);
        if (e) e.statusShiftWork = status || undefined;
        const f = this.filteredEmployees.find(p => p.personId === personId);
        if (f) f.statusShiftWork = status || undefined;
      });
  }

  loadPublishedSchedulesForToday(): void {
    if (!this.activeCompany) {
      return;
    }

    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth();
    const todayD = today.getDate();

    // Load all schedules for today
    this.scheduleService.getSchedules(this.activeCompany.companyId).subscribe(
      (schedules: any[]) => {
        // Filter for today's published schedules (compare using UTC date to match wall-clock storage)
        const todayPublishedSchedules = schedules.filter((s: any) => {
          const scheduleDate = new Date(s.startDate);
          return scheduleDate.getUTCFullYear() === todayY &&
                 scheduleDate.getUTCMonth() === todayM &&
                 scheduleDate.getUTCDate() === todayD &&
                 s.status && s.status.toLowerCase() === 'published';
        });

        // Map schedules to employees
        this.employees.forEach(employee => {
          employee.scheduleDetails = todayPublishedSchedules.filter((s: any) => 
            s.personId === employee.personId
          );
        });

        this.updateCompletedCountsForToday();
      },
      (error: any) => {
        console.error('Error loading published schedules', error);
      }
    );
  }

  private updateCompletedCountsForToday(): void {
    if (!this.activeCompany) return;
    const companyId = this.activeCompany.companyId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const target = this.employees.filter(e => (e.scheduleDetails?.length || 0) > 0).slice(0, 50);
    from(target)
      .pipe(
        mergeMap(
          (emp: Person) =>
            this.shiftEventService.getShiftEventsByPersonId(companyId, emp.personId).pipe(
              map(events => {
                const todays = (events || []).filter(ev => {
                  const dt = new Date(ev.eventDate);
                  return dt >= today && dt < endOfDay;
                });
                const clockIns = todays.filter(ev => (ev.eventType || '').toLowerCase() === 'clockin').length;
                const clockOuts = todays.filter(ev => (ev.eventType || '').toLowerCase() === 'clockout').length;
                const completed = Math.min(clockIns, clockOuts);
                return { personId: emp.personId, completed };
              }),
              catchError(() => of({ personId: emp.personId, completed: 0 }))
            ),
          5
        )
      )
      .subscribe(({ personId, completed }) => {
        this.completedScheduleCounts[personId] = completed;
      });
  }

  private _filter(value: string): Person[] {
    const filterValue = value.toLowerCase();
    return this.employees.filter(employee => employee.name.toLowerCase().includes(filterValue));
  }

  // Status helpers for enriched StatusShiftWork like "OnShift:Late|Early|OnTime|NoSchedule"
  isOnShift(status?: string): boolean {
    return !!status && status.startsWith('OnShift');
  }

  getTiming(status?: string): string | null {
    if (!status) return null;
    const parts = status.split(':');
    const timing = parts.length > 1 ? parts[1] : null;
    // If timing is NoSchedule but we have a published schedule, suppress NoSchedule
    // so the badge doesn't conflict with a valid schedule.
    if (timing === 'NoSchedule') {
      return null;
    }
    return timing;
  }

  getTimingBadgeClass(timing: string | null): string {
    switch (timing) {
      case 'OnTime':
        return 'bg-success';
      case 'Early':
        return 'bg-warning text-dark';
      case 'Late':
        return 'bg-danger';
      case 'NoSchedule':
        return 'bg-secondary';
      default:
        return 'bg-secondary';
    }
  }

  selectEmployee(employee: Person): void {
    if (!employee || !employee.personId) {
      this.toastr.error('Invalid employee selected');
      return;
    }

    if (!this.activeCompany) {
      this.toastr.error('No active company selected');
      return;
    }

    this.scheduleService.search(this.activeCompany.companyId, '', '', '', employee.personId).subscribe(
      (schedules: any) => {
        const today = new Date();
        const todayY = today.getFullYear();
        const todayM = today.getMonth();
        const todayD = today.getDate();
        employee.scheduleDetails = schedules || [];

        if (schedules && schedules.length > 0) {
          // Filter for today's published schedules only (UTC date = wall-clock date)
          employee.scheduleDetails = schedules.filter((s: any) => {
            const scheduleDate = new Date(s.startDate);
            return s.personId === employee.personId && 
                   scheduleDate.getUTCFullYear() === todayY &&
                   scheduleDate.getUTCMonth() === todayM &&
                   scheduleDate.getUTCDate() === todayD &&
                   s.status && s.status.toLowerCase() === 'published';
          }) || [];
        }

        const dialogRef = this.dialog.open(PinDialogComponent, {
          width: '250px',
          data: { name: employee.name, personId: employee.personId }
        });

        dialogRef.afterClosed().subscribe((verified: boolean) => {
          if (verified) {
            this.kioskService.setSelectedEmployee(employee);
            this.router.navigate(['/kiosk/photo-schedule'], { state: { employee } });
          }
        });
      },
      (error: any) => {
        this.toastr.error('Error loading schedules');
      }
    );
  }

  // Quick actions: Start/End shift directly from the list
  canStartShift(employee: Person): boolean {
    return !this.isOnShift(employee.statusShiftWork) && this.hasPublishedScheduleToday(employee);
  }

  canEndShift(employee: Person): boolean {
    return this.isOnShift(employee.statusShiftWork);
  }

  startShift(employee: Person): void {
    // Navigate to photo-schedule with selected employee; action is handled there
    this.kioskService.setSelectedEmployee(employee);
    this.router.navigate(['/kiosk/photo-schedule'], { state: { employee } });
  }

  endShift(employee: Person): void {
    this.kioskService.setSelectedEmployee(employee);
    this.router.navigate(['/kiosk/photo-schedule'], { state: { employee } });
  }

  toggleLegend(): void {
    this.showLegend = !this.showLegend;
    try {
      const key = this.activeCompany ? `employeeListLegendOpen_${this.activeCompany.companyId}` : 'employeeListLegendOpen';
      localStorage.setItem(key, this.showLegend ? 'true' : 'false');
    } catch {
      // ignore storage errors (e.g., private mode)
    }
  }

  getInitials(name: string): string {
    if (!name) {
      return '';
    }
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  hasPublishedScheduleToday(employee: Person): boolean {
    if (!this.activeCompany) {
      return false;
    }

    // Check if employee has scheduleDetails populated with published schedules
    return !!(employee.scheduleDetails && employee.scheduleDetails.length > 0);
  }

  getPendingScheduleCount(employee: Person): number {
    const scheduled = employee.scheduleDetails?.length || 0;
    const completed = this.completedScheduleCounts[employee.personId] || 0;
    return Math.max(0, scheduled - completed);
  }

  hasPendingScheduleToday(employee: Person): boolean {
    return this.getPendingScheduleCount(employee) > 0;
  }
}
