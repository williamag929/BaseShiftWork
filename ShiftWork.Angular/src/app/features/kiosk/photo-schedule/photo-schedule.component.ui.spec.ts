import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideMockStore } from '@ngrx/store/testing';
import { Subject, of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

import { PhotoScheduleComponent } from './photo-schedule.component';
import { KioskService } from '../core/services/kiosk.service';
import { TimerService } from '../core/services/timer.service';
import { WakeLockService } from '../core/services/wake-lock.service';
import { ShiftEventService } from 'src/app/core/services/shift-event.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { ScheduleShiftService } from 'src/app/core/services/schedule-shift.service';
import { AwsS3Service } from 'src/app/core/services/aws-s3.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';

describe('PhotoScheduleComponent (design system)', () => {
  let fixture: ComponentFixture<PhotoScheduleComponent>;
  let status: string;
  let questionsClosed: Subject<any>;
  let dialogOpen: jasmine.Spy;
  const el = () => fixture.nativeElement as HTMLElement;

  async function setup(width = 1280): Promise<void> {
    questionsClosed = new Subject();
    const employee = { personId: 7, name: 'Test Employee', companyId: 'co-1', scheduleDetails: [], statusShiftWork: status };
    await TestBed.configureTestingModule({
      imports: [PhotoScheduleComponent],
      providers: [
        provideNoopAnimations(),
        { provide: KioskService, useValue: { getSelectedEmployee: () => employee, getSelectedLocation: () => null, emitStatusUpdate: () => undefined, getKioskQuestions: () => of([{ kioskQuestionId: 1, questionText: 'Q?' }]) } },
        { provide: TimerService, useValue: { countdown: of(0), startTimer: () => undefined } },
        { provide: Router, useValue: { navigate: () => undefined } },
        { provide: ShiftEventService, useValue: { getShiftEventsByPersonId: () => of([]), createShiftEvent: () => of({}) } },
        { provide: PeopleService, useValue: { getPersonStatusShiftWork: () => of(status) } },
        { provide: ScheduleShiftService, useValue: {} },
        { provide: AwsS3Service, useValue: { uploadFile: () => of({ url: 'x' }) } },
        { provide: ToastrService, useValue: { success: () => undefined, error: () => undefined, warning: () => undefined } },
        { provide: WakeLockService, useValue: { request: () => undefined, release: () => undefined, isSupported: () => true, isActive: () => false } },
        provideMockStore({ initialState: {}, selectors: [{ selector: selectActiveCompany, value: { companyId: 'co-1' } }] }),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(PhotoScheduleComponent);
    dialogOpen = spyOn(fixture.debugElement.injector.get(MatDialog), 'open').and.returnValue({ afterClosed: () => questionsClosed } as any);
    (fixture.nativeElement as HTMLElement).style.display = 'block';
    (fixture.nativeElement as HTMLElement).style.width = `${width}px`;
    fixture.detectChanges();
  }

  const actionButtons = () => Array.from(el().querySelectorAll<HTMLButtonElement>('button[lzbutton], button.rounded-control'));

  it('shows the employee name as the only heading and no bootstrap classes', async () => {
    status = 'OnShift:OnTime';
    await setup();
    expect(el().querySelectorAll('h1').length).toBe(0);
    expect(el().querySelector('h2')!.textContent).toContain('Test Employee');
    expect(el().querySelector('.btn, .badge, [class*="fa-"], [class*="bi-"]')).toBeNull();
  });

  it('keeps every action at 56px with text-xl and an icon that is hidden from assistive tech', async () => {
    status = 'OnShift:OnTime';
    await setup();
    const buttons = actionButtons();
    expect(buttons.length).toBe(4);
    for (const button of buttons) {
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(56);
      expect(parseFloat(getComputedStyle(button).fontSize)).toBeGreaterThanOrEqual(20);
      expect(button.querySelector('mat-icon')!.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('has exactly one primary button and demotes it while the question dialog is open', async () => {
    status = 'OnShift:OnTime';
    await setup();
    expect(el().querySelectorAll('button[variant="primary"]').length).toBe(1);
    const endShift = el().querySelector('button[variant="primary"]') as HTMLButtonElement;
    endShift.click();
    fixture.detectChanges();
    expect(dialogOpen).toHaveBeenCalled();
    expect(el().querySelectorAll('button[variant="primary"]').length).toBe(0);
  });

  it('shows no primary action when off shift without a published schedule', async () => {
    status = 'OffShift';
    await setup();
    expect(el().querySelectorAll('button[variant="primary"]').length).toBe(0);
  });

  it('has no horizontal overflow at 768px and 1280px', async () => {
    status = 'OnShift:OnTime';
    for (const width of [768, 1280]) {
      TestBed.resetTestingModule();
      await setup(width);
      expect(el().scrollWidth).toBeLessThanOrEqual(el().clientWidth);
    }
  });

  it('sets scheduling before the countdown starts', async () => {
    status = 'OnShift:OnTime';
    await setup();
    const c = fixture.componentInstance as any;
    spyOn(c, 'startCountdown').and.callFake(() => expect(c.scheduling).toBeTrue());
    spyOn(window, 'setTimeout').and.returnValue(0 as any);
    c.startScheduling();
    expect(c.startCountdown).toHaveBeenCalled();
  });
});
