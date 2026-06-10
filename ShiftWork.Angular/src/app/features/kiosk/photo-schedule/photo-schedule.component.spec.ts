import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';

import { PhotoScheduleComponent } from './photo-schedule.component';
import { KioskService } from '../core/services/kiosk.service';
import { TimerService } from '../core/services/timer.service';
import { ShiftEventService } from 'src/app/core/services/shift-event.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { ScheduleShiftService } from 'src/app/core/services/schedule-shift.service';
import { AwsS3Service } from 'src/app/core/services/aws-s3.service';
import { ToastrService } from 'ngx-toastr';
import { WakeLockService } from '../core/services/wake-lock.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { ScheduleDetail } from 'src/app/core/models/schedule-detail.model';

describe('PhotoScheduleComponent local-day and UTC-wall-clock matching', () => {
  let component: PhotoScheduleComponent;
  let fixture: ComponentFixture<PhotoScheduleComponent>;

  let selectedEmployee: any;
  let shiftEvents: any[];

  const activeCompany = { companyId: 'co-1' } as any;

  const kioskServiceStub = {
    getSelectedEmployee: () => selectedEmployee,
    getSelectedLocation: () => null,
    emitStatusUpdate: jasmine.createSpy('emitStatusUpdate'),
    getKioskQuestions: () => of([]),
  };

  const timerServiceStub = {
    countdown: of(0),
    startTimer: jasmine.createSpy('startTimer'),
  };

  const shiftEventServiceStub = {
    getShiftEventsByPersonId: () => of(shiftEvents),
    createShiftEvent: () => of({}),
  };

  const peopleServiceStub = {
    getPersonStatusShiftWork: () => of('OffShift'),
  };

  const scheduleShiftServiceStub = {};
  const awsS3ServiceStub = { uploadFile: () => of({ url: 'https://example.com/file.jpg' }) };
  const toastrStub = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') };
  const dialogStub = { open: jasmine.createSpy('open') };
  const routerStub = { navigate: jasmine.createSpy('navigate') };
  const wakeLockStub = { request: jasmine.createSpy('request'), release: jasmine.createSpy('release') };

  beforeEach(async () => {
    shiftEvents = [];
    selectedEmployee = {
      personId: 7,
      name: 'Test Employee',
      companyId: 'co-1',
      email: 'test@example.com',
      scheduleDetails: [],
      statusShiftWork: 'OffShift',
    };

    await TestBed.configureTestingModule({
      imports: [PhotoScheduleComponent],
      providers: [
        { provide: KioskService, useValue: kioskServiceStub },
        { provide: TimerService, useValue: timerServiceStub },
        { provide: Router, useValue: routerStub },
        { provide: ShiftEventService, useValue: shiftEventServiceStub },
        { provide: PeopleService, useValue: peopleServiceStub },
        { provide: ScheduleShiftService, useValue: scheduleShiftServiceStub },
        { provide: AwsS3Service, useValue: awsS3ServiceStub },
        { provide: ToastrService, useValue: toastrStub },
        { provide: MatDialog, useValue: dialogStub },
        { provide: WakeLockService, useValue: wakeLockStub },
        provideMockStore({ initialState: {}, selectors: [{ selector: selectActiveCompany, value: activeCompany }] }),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PhotoScheduleComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    try {
      jasmine.clock().uninstall();
    } catch {
      // No-op when a test didn't install jasmine clock.
    }
  });

  it('matches today schedule when UTC calendar date equals local day', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-03-12T12:00:00'));

    const localNow = new Date();
    const matchingSchedule = {
      personId: 7,
      startDate: new Date(Date.UTC(localNow.getFullYear(), localNow.getMonth(), localNow.getDate(), 9, 0, 0)),
      endDate: new Date(Date.UTC(localNow.getFullYear(), localNow.getMonth(), localNow.getDate(), 17, 0, 0)),
    } as ScheduleDetail;

    selectedEmployee.scheduleDetails = [matchingSchedule];

    fixture.detectChanges();

    expect(component.employeeSchedule).toBeTruthy();
    expect(component.employeeSchedule?.personId).toBe(7);
  });

  it('does not match schedule for adjacent UTC calendar day (edge case)', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-03-12T12:00:00'));

    const localNow = new Date();
    const nextUtcDaySchedule = {
      personId: 7,
      startDate: new Date(Date.UTC(localNow.getFullYear(), localNow.getMonth(), localNow.getDate() + 1, 9, 0, 0)),
      endDate: new Date(Date.UTC(localNow.getFullYear(), localNow.getMonth(), localNow.getDate() + 1, 17, 0, 0)),
    } as ScheduleDetail;

    selectedEmployee.scheduleDetails = [nextUtcDaySchedule];

    fixture.detectChanges();

    expect(component.employeeSchedule).toBeNull();
  });

  it('treats in-progress status from events using local-day boundaries', () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const justBeforeToday = new Date(todayStart.getTime() - 60_000);
    const withinToday = new Date(todayStart.getTime() + 60_000);

    shiftEvents = [
      { eventDate: justBeforeToday.toISOString(), eventType: 'clockin' },
      { eventDate: withinToday.toISOString(), eventType: 'clockin' },
    ];

    fixture.detectChanges();

    expect(component.isOnShiftStatus(null)).toBeTrue();
  });

  it('keeps schedule matching stable on DST transition dates', () => {
    jasmine.clock().install();
    // US spring-forward day. We only care that matching uses calendar date semantics.
    jasmine.clock().mockDate(new Date('2026-03-08T12:00:00'));

    const localNow = new Date();
    selectedEmployee.scheduleDetails = [
      {
        personId: 7,
        startDate: new Date(Date.UTC(localNow.getFullYear(), localNow.getMonth(), localNow.getDate(), 9, 0, 0)),
        endDate: new Date(Date.UTC(localNow.getFullYear(), localNow.getMonth(), localNow.getDate(), 17, 0, 0)),
      } as ScheduleDetail,
    ];

    fixture.detectChanges();

    expect(component.employeeSchedule).toBeTruthy();
  });
});
