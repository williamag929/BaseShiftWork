import { Component, OnInit } from '@angular/core';
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
import { Observable } from 'rxjs/internal/Observable';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule, SharedModule,NgbModule]
})
export class TasksComponent implements OnInit {
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
    
        this.activeCompany$.subscribe((company:any) => {
          if (company) {
            this.activeCompany = company;
            console.log('Active company set:', this.activeCompany);
          } else {
            console.log('No active company found');
          }
        });

   }

  ngOnInit(): void {
    this.activeCompany$.subscribe((company:any) => {
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
          }
        );
        this.locationService.getLocations(company.companyId).subscribe(locations => {
          this.locations = locations.filter(l => l.companyId === company.companyId);
        });
        this.areaService.getAreas(company.companyId).subscribe(areas => {
          this.areas = areas.filter(a => a.companyId === company.companyId);
        });
        this.peopleService.getPeople(company.companyId).subscribe(people => {
          this.people = people.filter(p => p.companyId === company.companyId);
        });
      }
    });

    this.taskForm = this.fb.group({
      name: ['', Validators.required],
      title: ['', Validators.required],
      description: ['', Validators.required],
      locationId: ['', Validators.required],
      areaId: ['', Validators.required],
      personId: [''],
      status: ['Active', Validators.required],
    });
  }

  editTask(task: TaskShift): void {
    this.selectedTask = task;
    this.taskForm.patchValue(task);
  }

  cancelEdit(): void {
    this.selectedTask = null;
    this.taskForm.reset({
      name: '',
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
            const index = this.tasks.findIndex((t) => t.taskShiftId === result.taskShiftId);
            if (index > -1) {
              this.tasks[index] = result;
            }
            this.toastr.success('Task updated successfully.');
            this.cancelEdit();
          },
          () => this.toastr.error('Failed to update task.')
        );
    } else {
      const newTask: TaskShift = {
        id: null,
        ...this.taskForm.value,
        companyId: this.activeCompany.companyId,
      };
      this.taskShiftService.createTaskShift(this.activeCompany.companyId, newTask).subscribe(task => {
        this.tasks.push(task);
        this.cancelEdit();
        this.toastr.success('Task created successfully');
      });
    }
  }
}