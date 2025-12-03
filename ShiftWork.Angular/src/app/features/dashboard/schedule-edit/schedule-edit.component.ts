import { Component, Input, OnInit } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { People } from 'src/app/core/models/people.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { Schedule } from 'src/app/core/models/schedule.model';
import { CommonModule } from '@angular/common';
import { SharedModule } from 'src/app/shared/shared.module';
import { Observable } from 'rxjs';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { ToastrService } from 'ngx-toastr';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { LocationService } from 'src/app/core/services/location.service';
import { AreaService } from 'src/app/core/services/area.service';

@Component({
  selector: 'app-schedule-edit',
  templateUrl: './schedule-edit.component.html',
  styleUrls: ['./schedule-edit.component.css'],
  imports: [ ReactiveFormsModule,CommonModule,SharedModule ],
  standalone: true
})
export class ScheduleEditComponent implements OnInit {
  @Input() schedule: Schedule = {} as Schedule;
  scheduleForm!: FormGroup;
  people: People[] = [];
  activeCompany$: Observable<any>;
  activeCompany: any;
  loading = false;
  error: any = null;
  locations: any;
  areas: any;

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private peopleService: PeopleService,
    private authService: AuthService,
    private store: Store<AppState>,
    private toastr: ToastrService,
    private locationService: LocationService,
    private areaService: AreaService    
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);

    this.activeCompany$.subscribe((company: any) => {
      if (company) {
        this.activeCompany = company;
        console.log('Active company set:', this.activeCompany);
      } else {
        console.log('No active company found');
      }
    });

   }

  ngOnInit(): void {
    this.activeCompany$.subscribe((company: any) => {
      if (company) {
        this.activeCompany = company;
        this.loading = true;
        this.peopleService.getPeople(this.activeCompany.companyId).subscribe(people => {
          this.people = people.filter(p => p.companyId === company.companyId);
        });
        this.locationService.getLocations(this.activeCompany.companyId).subscribe(locations => {
            this.locations = locations;
        });
        this.areaService.getAreas(this.activeCompany.companyId).subscribe(areas => {
            this.areas = areas;
        });
        this.loading = false;

      }
    });

    this.scheduleForm = this.fb.group({
      personId: [this.schedule?.personId, Validators.required],
      name: [this.schedule?.name, Validators.required],
      locationId: [this.schedule?.locationId, Validators.required],
      areaId: [this.schedule?.areaId, Validators.required],
      startDate: [this.formatDateForInput(this.schedule?.startDate), Validators.required],
      endDate: [this.formatDateForInput(this.schedule?.endDate), Validators.required],
      //startTime: [this.schedule?.startTime, Validators.required],
      //endTime: [this.schedule?.endTime, Validators.required],
      description: [this.schedule?.description],
      status: [this.schedule?.status, Validators.required],
      color: [this.schedule?.color],
      timezone: [this.schedule?.timezone],
      type: [this.schedule?.type]
    });
  this.scheduleForm.get('locationId')?.valueChanges.subscribe(locationId => {
      const selectedLocation = this.locations.find((_location: { locationId: number }) => _location.locationId === +locationId);
      if (selectedLocation && selectedLocation.timezone) {
        this.scheduleForm.get('timezone')?.setValue(selectedLocation.timezone);
      }
    });
  }
  companyId(companyId: any) {
    throw new Error('Method not implemented.');
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

  save(): void {
    if (this.scheduleForm.valid) {
      this.activeModal.close({ ...this.schedule, ...this.scheduleForm.value });
    }
  }
}
