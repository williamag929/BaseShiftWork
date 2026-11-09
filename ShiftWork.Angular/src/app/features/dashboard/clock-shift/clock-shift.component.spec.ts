import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, of } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { AwsS3Service } from 'src/app/core/services/aws-s3.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { ShiftEventService } from 'src/app/core/services/shift-event.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { KioskService } from '../../kiosk/core/services/kiosk.service';
import { TimerService } from '../../kiosk/core/services/timer.service';
import { ClockShiftComponent } from './clock-shift.component';

describe('ClockShiftComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<ClockShiftComponent>;
  let status: string | null;
  const el = () => fixture.nativeElement as HTMLElement;

  afterEach(() => selectActiveCompany.clearResult());

  async function setup(opts: { user?: boolean; status?: string | null; schedule?: boolean } = {}) {
    TestBed.resetTestingModule();
    status = opts.status ?? null;
    const today = new Date();
    const person = {
      personId: 7, companyId: 'c1', name: 'Ana Ruiz', email: 'ana@x.com', status,
      scheduleDetails: opts.schedule ? [{ personId: 7, startDate: today, endDate: new Date(today.getTime() + 3600000), location: { name: 'Pier 4' } }] : [],
    };
    await TestBed.configureTestingModule({
      imports: [ClockShiftComponent],
      providers: [
        provideNoopAnimations(),
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'c1' } }] }),
        { provide: AuthService, useValue: { user$: new BehaviorSubject(opts.user === false ? null : { email: 'ana@x.com' }) } },
        { provide: PeopleService, useValue: { getPersonByEmail: () => of(person), getPersonStatus: () => of(status) } },
        { provide: ShiftEventService, useValue: {} },
        { provide: AwsS3Service, useValue: {} },
        { provide: ToastrService, useValue: { error: () => undefined, success: () => undefined } },
        { provide: MatDialog, useValue: {} },
        { provide: KioskService, useValue: {} },
        { provide: TimerService, useValue: { countdown: of(0), startTimer: () => undefined } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ClockShiftComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders one h1 with the employee name and a not-on-shift chip with text, and a single primary Start shift', async () => {
    await setup({ status: 'Off' });
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Clock in and out');
    expect(el().querySelector('lz-page-header')!.textContent).toContain('Ana Ruiz');
    expect(el().querySelector('[data-testid="shift-state"]')!.textContent!.trim()).toBe('Not on shift');
    const primary = el().querySelectorAll('[variant="primary"]');
    expect(primary.length).toBe(1);
    expect(primary[0].textContent).toContain('Start shift');
    expect(el().querySelector('i.fa, .btn, .clock-shift-container')).toBeNull();
  });

  it('on shift offers End shift as the only primary action plus break buttons', async () => {
    await setup({ status: 'OnShift' });
    expect(el().querySelector('[data-testid="shift-state"]')!.textContent!.trim()).toBe('On shift');
    const primary = el().querySelectorAll('[variant="primary"]');
    expect(primary.length).toBe(1);
    expect(primary[0].textContent).toContain('End shift');
    const text = el().textContent!;
    expect(text).toContain('Start break');
    expect(text).toContain('End break');
    expect(text).not.toContain('Start shift');
  });

  it('shows today\'s schedule in an lz-panel with sentence case labels', async () => {
    await setup({ status: 'Off', schedule: true });
    const panel = el().querySelector('lz-panel')!;
    expect(panel.querySelector('h2')!.textContent).toContain("Today's schedule");
    expect(panel.textContent).toContain('Pier 4');
    expect(panel.textContent).toContain('Start time');
  });

  it('asks the person to log in when there is no user, without action buttons', async () => {
    await setup({ user: false });
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-empty-state')!.textContent).toContain('Please log in to continue');
    expect(el().querySelector('button')).toBeNull();
  });

  it('keeps action buttons at least 48px tall and the heading at 26px', async () => {
    await setup({ status: 'OnShift' });
    el().querySelectorAll('button').forEach(b => expect(b.getBoundingClientRect().height).toBeGreaterThanOrEqual(48));
    expect(getComputedStyle(el().querySelector('h1')!).fontSize).toBe('26px');
  });
});
