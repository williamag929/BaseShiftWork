import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Schedule } from 'src/app/core/models/schedule.model';
import { People } from 'src/app/core/models/people.model';
import { Location } from 'src/app/core/models/location.model';
import { Area } from 'src/app/core/models/area.model';
import { ScheduleService } from 'src/app/core/services/schedule.service';
import { LocationService } from 'src/app/core/services/location.service';
import { AreaService } from 'src/app/core/services/area.service';
import { SharedModule } from 'src/app/shared/shared.module';

@Component({
  selector: 'app-schedule-edit',
  templateUrl: './schedule-edit.component.html',
  styleUrls: ['./schedule-edit.component.css'],
  imports: [SharedModule],
})
export class ScheduleEditComponent implements OnInit {
  form: FormGroup;
  people: People[] = [];
  locations: Location[] = [];
  areas: Area[] = [];
  companyId: string;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ScheduleEditComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { schedule: Schedule, people: People[], locations: Location[], areas: Area[], companyId: string },
    private scheduleService: ScheduleService,
    private locationService: LocationService,
    private areaService: AreaService
  ) {
    this.people = data.people;
    this.companyId = data.companyId;

    this.form = this.fb.group({
      scheduleId: [data.schedule ? data.schedule.scheduleId : 0],
      personId: [data.schedule ? data.schedule.personId : '', Validators.required],
      locationId: [data.schedule ? data.schedule.locationId : '', Validators.required],
      areaId: [data.schedule ? data.schedule.areaId : '', Validators.required],
      startTime: [data.schedule ? data.schedule.startDate : '', Validators.required],
      endTime: [data.schedule ? data.schedule.endDate : '', Validators.required],
      status: [data.schedule ? data.schedule.status : 'pending', Validators.required],
      companyId: [this.companyId]
    });
  }

  ngOnInit(): void {
    this.locationService.getLocations(this.companyId).subscribe(locations => {
        this.locations = locations;
    });
    this.areaService.getAreas(this.companyId).subscribe(areas => {
        this.areas = areas;
    });
  }

  save() {
    if (this.form.valid) {
      const schedule: Schedule = this.form.value;
      if (schedule.scheduleId) {
        this.scheduleService.updateSchedule(this.companyId, schedule.scheduleId, schedule).subscribe(() => {
          this.dialogRef.close(true);
        });
      } else {
        this.scheduleService.createSchedule(this.companyId, schedule).subscribe(() => {
          this.dialogRef.close(true);
        });
      }
    }
  }

  close() {
    this.dialogRef.close();
  }
}
