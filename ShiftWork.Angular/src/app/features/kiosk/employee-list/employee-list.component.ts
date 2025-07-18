import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { People as Person } from 'src/app/core/models/people.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { Company } from 'src/app/core/models/company.model';
import { ToastrService } from 'ngx-toastr';

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

  constructor(
    private peopleService: PeopleService,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.authService.activeCompany$.subscribe((company: Company) => {
      if (company) {
        this.loading = true;
        this.peopleService.getPeople(company.companyId).subscribe(
          people => {
            this.employees = people.filter(p => p.companyId === company.companyId);
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
    this.router.navigate(['/kiosk/photo-schedule', employee.personId]);
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