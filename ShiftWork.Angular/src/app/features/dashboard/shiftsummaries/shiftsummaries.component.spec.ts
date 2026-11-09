import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';

import { ShiftsummariesComponent } from './shiftsummaries.component';
import { SummaryShift, SummaryShiftService } from 'src/app/core/services/summary-shift.service';
import { LocationService } from 'src/app/core/services/location.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';

describe('ShiftsummariesComponent (Loqzen design system)', () => {
  let component: ShiftsummariesComponent;
  let fixture: ComponentFixture<ShiftsummariesComponent>;
  let summaryService: { getSummaryShifts: jasmine.Spy; upsertApproval: jasmine.Spy };
  const el = () => fixture.nativeElement as HTMLElement;

  const shift = (i: number, overrides: Partial<SummaryShift> = {}): SummaryShift => ({
    day: '2026-11-02T00:00:00Z',
    personId: i,
    personName: `Person ${i}`,
    locationId: 1,
    locationName: 'Dock A',
    areaId: 1,
    areaName: 'Bay',
    minStartTime: '2026-11-02T08:00:00Z',
    maxEndTime: '2026-11-02T16:00:00Z',
    breakTime: 30,
    totalHours: 7.5,
    status: 'shifted',
    ...overrides,
  });

  async function setup(shifts: SummaryShift[]) {
    summaryService = {
      getSummaryShifts: jasmine.createSpy('getSummaryShifts').and.returnValue(of(shifts)),
      upsertApproval: jasmine.createSpy('upsertApproval').and.returnValue(of({})),
    };
    await TestBed.configureTestingModule({
      imports: [ShiftsummariesComponent],
      providers: [
        { provide: SummaryShiftService, useValue: summaryService },
        { provide: LocationService, useValue: { getLocations: () => of([{ locationId: 1, name: 'Dock A' }]) } },
        { provide: PeopleService, useValue: { getPeople: () => of([{ personId: 1, name: 'Person 1' }]) } },
        { provide: AuthService, useValue: { user$: of({ personId: 1 }) } },
        provideMockStore({ initialState: {}, selectors: [{ selector: selectActiveCompany, value: { companyId: 'test' } }] }),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ShiftsummariesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const showTable = () => {
    (el().querySelectorAll('[role="group"][aria-label="View"] button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  it('should create', async () => {
    await setup([]);
    expect(component).toBeTruthy();
  });

  it('has one h1 from lz-page-header and no legacy icons or old card classes', async () => {
    await setup([shift(1)]);
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')).not.toBeNull();
    expect(el().querySelector('i.fas, i.fa, .filters-card, .summary-card, .btn-apply, .toggle-btn')).toBeNull();
  });

  it('fetches the list once per Apply, not once per async-pipe binding', async () => {
    await setup([shift(1)]);
    expect(summaryService.getSummaryShifts).toHaveBeenCalledTimes(1);
  });

  it('shows the table inside lz-table-scroll with a text status chip per row', async () => {
    await setup([shift(1), shift(2, { status: 'approved' })]);
    showTable();
    const scroll = el().querySelector('lz-table-scroll') as HTMLElement;
    expect(scroll).not.toBeNull();
    expect(scroll.querySelector('table')).not.toBeNull();
    expect(getComputedStyle(scroll).overflowX).toBe('auto');
    const rows = scroll.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(Array.from(rows).map(r => r.querySelector('lz-status-chip')!.textContent!.trim())).toEqual(['Shifted', 'Approved']);
  });

  it('hides the inactive view by removing it, not with the hidden attribute', async () => {
    await setup([shift(1)]);
    expect(el().querySelector('lz-table-scroll')).toBeNull();
    expect(el().querySelectorAll('[hidden]').length).toBe(0);
    showTable();
    expect(el().querySelector('[data-testid="shift-cards"]')).toBeNull();
  });

  it('shows lz-empty-state instead of the table when there are no results', async () => {
    await setup([]);
    showTable();
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    expect(el().querySelector('lz-table-scroll')).toBeNull();
  });

  it('pages lists longer than 25 rows with lz-pager + paginate', async () => {
    await setup(Array.from({ length: 30 }, (_, i) => shift(i + 1)));
    showTable();
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
    const pager = el().querySelector('lz-pager')!;
    expect(pager.textContent).toContain('1–25 of 30');
    (pager.querySelector('button[aria-label="Next page"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelectorAll('tbody tr').length).toBe(5);
  });

  it('keeps one primary action (Apply filters) and >=48px controls', async () => {
    await setup([shift(1)]);
    const primaries = Array.from(el().querySelectorAll('button[lzButton]')).filter(b => b.classList.contains('bg-ink'));
    expect(primaries.length).toBe(1);
    expect(primaries[0].getAttribute('type')).toBe('submit');
    el().querySelectorAll('button[lzButton], select[lzField], input[lzField]').forEach(c =>
      expect(c.getBoundingClientRect().height).toBeGreaterThanOrEqual(48));
  });

  it('labels every filter control and the per-row status select', async () => {
    await setup([shift(1)]);
    showTable();
    ['startDate', 'endDate', 'locationId', 'personId'].forEach(id => {
      expect(el().querySelector(`label[for="${id}"]`)).not.toBeNull();
    });
    expect(el().querySelector('tbody select')!.getAttribute('aria-label')).toBeTruthy();
  });

  it('changing a row status still upserts the approval', async () => {
    await setup([shift(1)]);
    showTable();
    const select = el().querySelector('tbody select') as HTMLSelectElement;
    select.value = select.options[2].value;
    select.dispatchEvent(new Event('change'));
    expect(summaryService.upsertApproval).toHaveBeenCalled();
  });
});
