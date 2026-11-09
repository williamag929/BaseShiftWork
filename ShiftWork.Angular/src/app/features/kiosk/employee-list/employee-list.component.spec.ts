import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { KioskModule } from '../kiosk.module';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideMockStore } from '@ngrx/store/testing';
import { Subject, of, throwError } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

import { EmployeeListComponent } from './employee-list.component';
import { PinDialogComponent } from '../pin-dialog/pin-dialog.component';
import { KioskService } from '../core/services/kiosk.service';
import { WakeLockService } from '../core/services/wake-lock.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { ScheduleService } from 'src/app/core/services/schedule.service';
import { SettingsHelperService } from 'src/app/core/services/settings-helper.service';
import { ShiftEventService } from 'src/app/core/services/shift-event.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';

describe('EmployeeListComponent (design system)', () => {
  let fixture: ComponentFixture<EmployeeListComponent>;
  let people: any[];
  let peopleResult: () => any;
  let dialogOpen: jasmine.Spy;
  const company = { companyId: 'co-1' } as any;

  const person = (id: number, name: string, status?: string) =>
    ({ personId: id, name, companyId: 'co-1', statusShiftWork: status, scheduleDetails: [] }) as any;
  const el = () => fixture.nativeElement as HTMLElement;

  async function setup(result?: () => any, width = 1280): Promise<void> {
    peopleResult = result ?? (() => of(people));
    dialogOpen = jasmine.createSpy('open').and.returnValue({ afterClosed: () => of(false) });
    await TestBed.configureTestingModule({
      imports: [KioskModule, RouterTestingModule],
      providers: [
        provideNoopAnimations(),
        provideMockStore({ initialState: {}, selectors: [{ selector: selectActiveCompany, value: company }] }),
        { provide: PeopleService, useValue: { getPeople: () => peopleResult(), getPersonStatusShiftWork: (_c: string, id: number) => of(people.find(p => p.personId === id)?.statusShiftWork ?? 'OffShift') } },
        { provide: ScheduleService, useValue: { getSchedules: () => of([]), search: () => of([]) } },
        { provide: ShiftEventService, useValue: { getShiftEventsByPersonId: () => of([]) } },
        { provide: KioskService, useValue: { statusUpdate$: new Subject(), setSelectedEmployee: () => undefined } },
        { provide: SettingsHelperService, useValue: { loadSettings: () => of({}), shouldShowEmployeePhotos: () => true, getKioskTimeout: () => 30000 } },
        { provide: ToastrService, useValue: { error: jasmine.createSpy('error') } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: WakeLockService, useValue: { request: () => undefined, release: () => undefined, isSupported: () => true, isActive: () => true } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(EmployeeListComponent);
    (fixture.nativeElement as HTMLElement).style.display = 'block';
    (fixture.nativeElement as HTMLElement).style.width = `${width}px`;
    fixture.detectChanges();
    fixture.detectChanges();
  }

  beforeEach(() => {
    people = [person(1, 'Ana Perez', 'OnShift:Late'), person(2, 'Luis Gomez'), person(3, 'Maria Diaz', 'OnShift:OnTime')];
  });

  it('renders each employee as a button card of at least 48px with large text', async () => {
    await setup();
    const cards = el().querySelectorAll<HTMLButtonElement>('ul button');
    expect(cards.length).toBe(3);
    for (const card of Array.from(cards)) {
      expect(card.getAttribute('type')).toBe('button');
      expect(card.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
      expect(card.getBoundingClientRect().width).toBeGreaterThanOrEqual(48);
    }
    const name = cards[0].querySelector('.text-lg') as HTMLElement;
    expect(parseFloat(getComputedStyle(name).fontSize)).toBeGreaterThanOrEqual(18);
  });

  it('keeps toolbar controls at 56px and the search input labelled', async () => {
    await setup();
    const search = el().querySelector('input[type="search"]') as HTMLInputElement;
    expect(search.getAttribute('aria-label')).toBeTruthy();
    expect(search.getBoundingClientRect().height).toBeGreaterThanOrEqual(56);
    for (const button of Array.from(el().querySelectorAll<HTMLElement>('.flex-wrap > button'))) {
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(56);
    }
  });

  it('shows timing as text, not by color alone', async () => {
    await setup();
    const text = el().textContent!;
    expect(text).toContain('Late');
    expect(text).toContain('On time');
    expect(text).toContain('On shift');
  });

  it('has no primary button on the list screen and no bootstrap classes', async () => {
    await setup();
    expect(el().querySelectorAll('button[variant="primary"]').length).toBe(0);
    expect(el().querySelector('.btn, .badge, .alert, .spinner-border, [class*="bi-"], [class*="fa-"]')).toBeNull();
  });

  it('opens the PIN dialog in the kiosk panel when a card is tapped', async () => {
    await setup();
    (el().querySelector('ul button') as HTMLButtonElement).click();
    expect(dialogOpen).toHaveBeenCalledWith(
      PinDialogComponent,
      jasmine.objectContaining({ panelClass: 'lz-dialog-surface', data: jasmine.objectContaining({ personId: 1 }) }),
    );
  });

  it('shows the empty state, never together with the error alert', async () => {
    people = [];
    await setup();
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    expect(el().querySelector('lz-alert')).toBeNull();
  });

  it('shows a danger alert, never together with the empty state, when loading fails', async () => {
    await setup(() => throwError(() => new Error('boom')));
    const alert = el().querySelector('lz-alert') as HTMLElement;
    expect(alert.getAttribute('role')).toBe('alert');
    expect(el().querySelector('lz-empty-state')).toBeNull();
  });

  it('shows loading, not the empty state, before the company has emitted', async () => {
    await setup();
    const c = TestBed.createComponent(EmployeeListComponent).componentInstance;
    expect(c.loading).toBeTrue();
  });

  it('shows a loading status while employees load and neither empty nor error', async () => {
    const pending = new Subject<any[]>();
    await setup(() => pending);
    expect(el().querySelector('[role="status"]')).not.toBeNull();
    expect(el().querySelector('lz-empty-state')).toBeNull();
    expect(el().querySelector('lz-alert')).toBeNull();
  });

  it('toggles the legend with aria-expanded', async () => {
    await setup();
    const toggle = el().querySelector('button[aria-controls="kiosk-legend"]') as HTMLButtonElement;
    const initial = toggle.getAttribute('aria-expanded');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).not.toBe(initial);
  });

  for (const width of [768, 1280]) {
    it(`has no horizontal overflow at ${width}px`, async () => {
      await setup(undefined, width);
      const host = el();
      expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
    });
  }
});
