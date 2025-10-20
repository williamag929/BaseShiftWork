import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { People as Person } from 'src/app/core/models/people.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { KioskService } from '../core/services/kiosk.service';
import { ScheduleService } from 'src/app/core/services/schedule.service';
import { MatDialog } from '@angular/material/dialog';
import { PinDialogComponent } from '../pin-dialog/pin-dialog.component';
import { ScheduleDetail } from 'src/app/core/models/schedule-detail.model';

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
  activeCompany$: Observable<any>;
  activeCompany: any;

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
    this.activeCompany$.subscribe((company: { companyId: string }) => {
      if (company) {
        this.activeCompany = company;
        console.log('Active company set:', this.activeCompany);
        this.loading = true;
        this.peopleService.getPeople(company.companyId).subscribe(
          people => {
            this.employees = people.filter(p => p.companyId === company.companyId);
            console.log('Employees loaded:', this.employees);
            this.loading = false;
          },
          error => {
            this.error = error;
            this.loading = false;
            this.toastr.error('Error loading employees');
          }
        );
      }
    });
  }

  selectEmployee(employee: Person): void {
    console.log('Selected employee:', employee);

    if (!employee || !employee.id) {
      this.toastr.error('Invalid employee selected');
      return;
    }

    //todo: load the schedule details for the selected employee from schedule service search filtering the 
    //current date 
    //this.scheduleService.search(this.activeCompany.companyId, new Date().toISOString(), new Date().toISOString(), '', employee.id).subscribe(
    this.scheduleService.search(this.activeCompany.companyId, '', '', '', employee.id).subscribe(
      schedules => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        employee.scheduleDetails = schedules || [];

        //const employeeSchedule =  schedules.find(s => {
        //  const scheduleDate = new Date(s.startDate);
        //  scheduleDate.setHours(0, 0, 0, 0);
        //  return s.personId === employee.id && scheduleDate.getTime() === today.getTime();
        //}) || null;
        if (schedules && schedules.length > 0) {   
        employee.scheduleDetails = schedules.filter(s => 
          {
            const scheduleDate = new Date(s.startDate);
            scheduleDate.setHours(0, 0, 0, 0);
            return s.personId === employee.id && scheduleDate.getTime() === today.getTime();
          }) || [];
        const dialogRef = this.dialog.open(PinDialogComponent, {
          width: '250px',
          data: { name: employee.name, personId: employee.id }
        });

        dialogRef.afterClosed().subscribe(verified => {
          if (verified) {
            this.kioskService.setSelectedEmployee(employee);
            this.router.navigate(['/kiosk/photo-schedule'], { state: { employee } });
          }
        });
        } else {
          this.toastr.warning('No schedule found for today');
          this.kioskService.setSelectedEmployee(employee);
          this.router.navigate(['/kiosk/photo-schedule'], { state: { employee } })
            .then(() => {
              console.log('Navigated to photo schedule for employee:', employee);
            })
            .catch(error => {
              console.error('Navigation error:', error);
              this.toastr.error('Error navigating to photo schedule');
            });
        }
      },
      error => {
        console.error('Error loading schedules:', error);
        this.toastr.error('Error loading schedules');
      }
    );
  }


  private formatDateForInput(date: Date | string | undefined): string {
    if (!date) {
      return '';
    }
    const d = new Date(date);
    // Format to 'yyyy-MM-ddTHH:mm' which is required for datetime-local input
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
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