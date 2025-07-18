import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Company } from 'src/app/core/models/company.model';
import { TaskShiftService } from 'src/app/core/services/task-shift.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-todo-list',
  templateUrl: './todo-list.component.html',
  styleUrls: ['./todo-list.component.css'],
  standalone: false
})
export class TodoListComponent implements OnInit {
  tasks: any[] = [];
  loading = false;
  error: any = null;

  constructor(
    private taskShiftService: TaskShiftService,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.authService.activeCompany$.subscribe((company: Company) => {
      if (company) {
        this.loading = true;
        this.taskShiftService.getTaskShifts(company.companyId).subscribe(
          tasks => {
            this.tasks = tasks.filter(t => t.companyId === company.companyId);
            this.loading = false;
          },
          error => {
            this.error = error;
            this.loading = false;
            this.toastr.error('Error loading tasks');
          }
        );
      }
    });
  }

  viewTask(task: any): void {
    this.router.navigate(['/kiosk/todo-detail', task.id]);
  }
}