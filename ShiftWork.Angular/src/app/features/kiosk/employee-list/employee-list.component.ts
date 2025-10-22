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

@Component({
  selector: 'app-employee-list',
  templateUrl: './employee-list.component.html',
  styleUrls: ['./employee-list.component.css'],
  standalone: false
})
export class EmployeeListComponent implements OnInit {
  employees: Person[] = [];
  loading = false;
  error: any = null;
  activeCompany$: Observable<Company | null>;
  activeCompany: Company | null = null;

  constructor(
    private peopleService: PeopleService,
    private readonly kioskService: KioskService,
    private scheduleService: ScheduleService,
    private router: Router,
    private toastr: ToastrService,
    private store: Store<AppState>,
    private dialog: MatDialog
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {
    this.activeCompany$.subscribe((company: Company | null) => {
      if (company) {
        this.activeCompany = company;
        this.loading = true;
        this.peopleService.getPeople(company.companyId).subscribe(
          (people: Person[]) => {
            this.employees = people.filter(p => p.companyId === company.companyId);
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
          employee.scheduleDetails = schedules.filter((s: any) => {
            const scheduleDate = new Date(s.startDate);
            scheduleDate.setHours(0, 0, 0, 0);
            return s.personId === employee.personId && scheduleDate.getTime() === today.getTime();
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
}
