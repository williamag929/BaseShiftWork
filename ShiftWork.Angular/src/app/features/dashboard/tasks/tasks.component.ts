import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TaskShift } from 'src/app/core/models/task-shift.model';
import { TaskShiftService } from 'src/app/core/services/task-shift.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { Location } from 'src/app/core/models/location.model';
import { LocationService } from 'src/app/core/services/location.service';
import { Area } from 'src/app/core/models/area.model';
import { AreaService } from 'src/app/core/services/area.service';
import { People } from 'src/app/core/models/people.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { ToastrService } from 'ngx-toastr';
import { ReactiveFormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/shared/shared.module';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { Observable, Subject, forkJoin } from 'rxjs';
import { filter, switchMap, takeUntil, tap } from 'rxjs/operators';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule, SharedModule,NgbModule]
})
export class TasksComponent implements OnInit, OnDestroy {
  activeCompany$: Observable<any>;
  activeCompany: any;
  tasks: TaskShift[] = [];
  taskForm!: FormGroup;
  locations: Location[] = [];
  selectedTask: TaskShift | null = null;
  areas: Area[] = [];
  people: People[] = [];
  loading = false;
  error: any = null;
  private destroy$ = new Subject<void>();

  constructor(
    private taskShiftService: TaskShiftService,
    private authService: AuthService,
    private locationService: LocationService,
    private areaService: AreaService,
    private peopleService: PeopleService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private store: Store<AppState>
  ) {

    this.activeCompany$ = this.store.select(selectActiveCompany);
   }

  ngOnInit(): void {
    this.taskForm = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      locationId: ['', Validators.required],
      areaId: ['', Validators.required],
      personId: [''],
      status: ['Active', Validators.required],
    });

    this.activeCompany$.pipe(
      filter(company => !!company),
      tap(company => {
        this.activeCompany = company;
        this.loading = true;
        console.log('Active company set:', this.activeCompany);
      }),
      switchMap(company =>
        forkJoin({
          tasks: this.taskShiftService.getTaskShifts(company.companyId),
          locations: this.locationService.getLocations(company.companyId),
          areas: this.areaService.getAreas(company.companyId),
          people: this.peopleService.getPeople(company.companyId)
        })
      ),
      takeUntil(this.destroy$)
    ).subscribe({
      next: ({ tasks, locations, areas, people }) => {
        this.tasks = tasks;
        this.locations = locations;
        this.areas = areas;
        this.people = people;
        this.loading = false;
      },
      error: err => {
        this.error = err;
        this.loading = false;
        this.toastr.error('Failed to load initial data for tasks.');
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  editTask(task: TaskShift): void {
    this.selectedTask = task;
    this.taskForm.patchValue(task);
  }

  cancelEdit(): void {
    this.selectedTask = null;
    this.taskForm.reset({
      title: '',
      description: '',
      locationId: '',
      areaId: '',
      personId: '',
      status: 'Active',
    });
  }

  saveTask(): void {
    if (!this.taskForm.valid) {
      return;
    }

    if (this.selectedTask) {
      const updatedTask: TaskShift = {
        ...this.selectedTask,
        ...this.taskForm.value,
      };
      // Note: You will need to implement `updateTaskShift` in your TaskShiftService.
      this.taskShiftService
        .updateTaskShift(this.activeCompany.companyId, updatedTask.taskShiftId, updatedTask)
        .subscribe(
          (result) => {
            console.log('Task updated:', result);
            const index = this.tasks.findIndex((t) => t.taskShiftId === result.taskShiftId);
            if (index > -1) {
              const updatedTasks = [...this.tasks];
              updatedTasks[index] = result;
              this.tasks = updatedTasks;
            }
            this.toastr.success('Task updated successfully.');
            this.cancelEdit();
          },
          () => this.toastr.error('Failed to update task.')
        );
    } else {
      const newTask: Omit<TaskShift, 'taskShiftId'> = {
        ...this.taskForm.value,
        companyId: this.activeCompany.companyId,
      };
      this.taskShiftService.createTaskShift(this.activeCompany.companyId, newTask as TaskShift).subscribe(task => {
        this.tasks = [...this.tasks, task];
        this.cancelEdit();
        this.toastr.success('Task created successfully');
      },
      () => this.toastr.error('Failed to create Task.')
      );
    }
  }
}