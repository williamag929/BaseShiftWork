import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { People as Person } from 'src/app/core/models/people.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { KioskService } from '../core/services/kiosk.service';
import { ScheduleService } from 'src/app/core/services/schedule.service';
import { MatDialog } from '@angular/material/dialog';
import { PinDialogComponent } from '../pin-dialog/pin-dialog.component';
import { Company } from 'src/app/core/models/company.model';
import { FormControl } from '@angular/forms';
import { startWith, map } from 'rxjs/operators';
import { SettingsHelperService } from 'src/app/core/services/settings-helper.service';
import { CompanySettings } from 'src/app/core/models/company-settings.model';

@Component({
  selector: 'app-employee-list',
  templateUrl: './employee-list.component.html',
  styleUrls: ['./employee-list.component.css'],
  standalone: false
})
export class EmployeeListComponent implements OnInit {
  employees: Person[] = [];
  filteredEmployees: Person[] = [];
  loading = false;
  error: any = null;
  activeCompany$: Observable<Company | null>;
  activeCompany: Company | null = null;
  searchControl = new FormControl('');
  settings: CompanySettings | null = null;
  showEmployeePhotos = true;
  kioskTimeout = 30000; // milliseconds

  constructor(
    private peopleService: PeopleService,
    private readonly kioskService: KioskService,
    private scheduleService: ScheduleService,
    private router: Router,
    private toastr: ToastrService,
    private store: Store<AppState>,
    private dialog: MatDialog,
    private settingsHelper: SettingsHelperService
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {
    this.activeCompany$.subscribe((company: Company | null) => {
      if (company) {
        this.activeCompany = company;
        
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
  }

  loadPublishedSchedulesForToday(): void {
    if (!this.activeCompany) {
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Load all schedules for today
    this.scheduleService.getSchedules(this.activeCompany.companyId).subscribe(
      (schedules: any[]) => {
        // Filter for today's published schedules
        const todayPublishedSchedules = schedules.filter((s: any) => {
          const scheduleDate = new Date(s.startDate);
          scheduleDate.setHours(0, 0, 0, 0);
          return scheduleDate.getTime() === today.getTime() &&
                 s.status && s.status.toLowerCase() === 'published';
        });

        // Map schedules to employees
        this.employees.forEach(employee => {
          employee.scheduleDetails = todayPublishedSchedules.filter((s: any) => 
            s.personId === employee.personId
          );
        });
      },
      (error: any) => {
        console.error('Error loading published schedules', error);
      }
    );
  }

  private _filter(value: string): Person[] {
    const filterValue = value.toLowerCase();
    return this.employees.filter(employee => employee.name.toLowerCase().includes(filterValue));
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
        today.setHours(0, 0, 0, 0);
        employee.scheduleDetails = schedules || [];

        if (schedules && schedules.length > 0) {
          // Filter for today's published schedules only
          employee.scheduleDetails = schedules.filter((s: any) => {
            const scheduleDate = new Date(s.startDate);
            scheduleDate.setHours(0, 0, 0, 0);
            return s.personId === employee.personId && 
                   scheduleDate.getTime() === today.getTime() &&
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
}
