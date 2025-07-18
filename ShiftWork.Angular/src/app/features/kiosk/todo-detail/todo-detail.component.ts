import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TaskShift } from 'src/app/core/models/task-shift.model';
import { AuthService } from 'src/app/core/services/auth.service';
import { TaskShiftService } from 'src/app/core/services/task-shift.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-todo-detail',
  templateUrl: './todo-detail.component.html',
  styleUrls: ['./todo-detail.component.css'],
  standalone: false
})
export class TodoDetailComponent implements OnInit {
  task: TaskShift | null = null;
  loading = false;
  error: any = null;

  constructor(
    private route: ActivatedRoute,
    private taskShiftService: TaskShiftService,
    private toastr: ToastrService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    const taskId = this.route.snapshot.paramMap.get('id');
    if (taskId) {
      this.loading = true;
      this.authService.activeCompany$.subscribe((company: any) => {
        if (company) {
          this.taskShiftService.getTaskShift(company.companyId, +taskId).subscribe(
            task => {
              this.task = task;
            },
            error => {
              this.error = error;
              this.loading = false;
              this.toastr.error('Error loading task');
            }
          );
        }
      });
    }
  }
}
