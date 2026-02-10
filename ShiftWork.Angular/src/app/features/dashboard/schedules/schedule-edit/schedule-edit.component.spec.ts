import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

import { ScheduleEditComponent } from './schedule-edit.component';
import { ScheduleService } from 'src/app/core/services/schedule.service';
import { LocationService } from 'src/app/core/services/location.service';
import { AreaService } from 'src/app/core/services/area.service';

describe('ScheduleEditComponent', () => {
  let component: ScheduleEditComponent;
  let fixture: ComponentFixture<ScheduleEditComponent>;

  beforeEach(async () => {
    const dialogRefStub = { close: jasmine.createSpy('close') };
    const scheduleServiceStub = {
      createSchedule: () => of({}),
      updateSchedule: () => of({})
    };
    const locationServiceStub = { getLocations: () => of([]) };
    const areaServiceStub = { getAreas: () => of([]) };

    await TestBed.configureTestingModule({
      imports: [ScheduleEditComponent],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefStub },
        { provide: MAT_DIALOG_DATA, useValue: { schedule: null, people: [], locations: [], areas: [], companyId: 'test' } },
        { provide: ScheduleService, useValue: scheduleServiceStub },
        { provide: LocationService, useValue: locationServiceStub },
        { provide: AreaService, useValue: areaServiceStub }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScheduleEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
