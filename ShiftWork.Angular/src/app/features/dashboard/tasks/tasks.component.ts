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
import { paginate } from 'src/app/shared/ui';
import { AuditHistoryButtonComponent } from '../../kiosk/audit-history/audit-history-button.component';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, SharedModule, NgbModule, AuditHistoryButtonComponent]
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
  saving = false;
  panelOpen = false;
  openerEl: HTMLElement | null = null;
  page = 1;
  pageSize = 25;
  readonly paginate = paginate;
  readonly titleRequired = $localize`:@@tasks.title_error:Task title is required`;
  readonly descriptionRequired = $localize`:@@tasks.desc_error:Description is required`;
  readonly locationRequired = $localize`:@@tasks.location_error:Location is required`;
  readonly addLabel = $localize`:@@tasks.add_btn:Add task`;
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
      areaId: [''],
      personId: [''],
      status: ['Active', Validators.required],
    });

    this.activeCompany$.pipe(
      filter(company => !!company),
      tap(company => {
        this.activeCompany = company;
        this.loading = true;
        this.error = null;
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
        this.page = Math.min(this.page, Math.max(1, Math.ceil(tasks.length / this.pageSize)));
      },
      error: err => {
        this.error = err;
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  addTask(): void {
    this.cancelEdit();
    this.panelOpen = true;
  }

  editLabel(task: TaskShift): string {
    return $localize`:@@tasks.edit_aria:Edit ${task.title || task.description || ''}:name:`;
  }

  editTask(task: TaskShift): void {
    this.panelOpen = true;
    this.selectedTask = task;
    this.taskForm.patchValue({
      ...task,
      description: task.description ?? '',
      locationId: task.locationId ?? '',
      areaId: task.areaId ?? '',
      personId: task.personId ?? '',
      status: task.status ?? 'Active',
    });
  }

  cancelEdit(): void {
    this.panelOpen = false;
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

  private optionalId(raw: unknown): number | null {
    return raw === '' || raw === null || raw === undefined ? null : Number(raw);
  }

  private payload(): Partial<TaskShift> {
    const raw = this.taskForm.value;
    return {
      ...raw,
      locationId: this.optionalId(raw.locationId),
      areaId: this.optionalId(raw.areaId),
      personId: this.optionalId(raw.personId),
    } as Partial<TaskShift>;
  }

  saveTask(): void {
    if (!this.taskForm.valid || this.saving) {
      return;
    }
    this.saving = true;

    if (this.selectedTask) {
      const updatedTask = { ...this.selectedTask, ...this.payload() } as TaskShift;
      this.taskShiftService
        .updateTaskShift(this.activeCompany.companyId, updatedTask.taskShiftId, updatedTask)
        .subscribe(
          (result) => {
            const index = this.tasks.findIndex((t) => t.taskShiftId === result.taskShiftId);
            if (index > -1) {
              const updatedTasks = [...this.tasks];
              updatedTasks[index] = result;
              this.tasks = updatedTasks;
            }
            this.saving = false;
            this.toastr.success($localize`:@@tasks.toast_updated:Task updated.`);
            this.cancelEdit();
          },
          () => {
            this.saving = false;
            this.toastr.error($localize`:@@tasks.toast_update_failed:Could not update the task.`);
          }
        );
    } else {
      const newTask = { ...this.payload(), companyId: this.activeCompany.companyId } as Omit<TaskShift, 'taskShiftId'>;
      this.taskShiftService.createTaskShift(this.activeCompany.companyId, newTask as TaskShift).subscribe(
        task => {
          this.saving = false;
          this.tasks = [...this.tasks, task];
          this.cancelEdit();
          this.toastr.success($localize`:@@tasks.toast_created:Task created.`);
        },
        () => {
          this.saving = false;
          this.toastr.error($localize`:@@tasks.toast_create_failed:Could not create the task.`);
        }
      );
    }
  }

  getLocationName(locationId: number | undefined): string {
    if (locationId === undefined) return '';
    const location = this.locations.find(l => l.locationId === locationId);
    return location ? location.name : '';
  }

  getAreaName(areaId: number | undefined): string {
    if (areaId === undefined) return '';
    const area = this.areas.find(a => a.areaId === areaId);
    return area ? area.name : '';
  }

  getPersonName(personId: number | undefined): string {
    if (personId === undefined) return '';
    const person = this.people.find(p => p.personId === personId);
    return person ? person.name : '';
  }
}