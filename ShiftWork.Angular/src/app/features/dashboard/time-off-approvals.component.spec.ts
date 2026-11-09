import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideMockStore } from '@ngrx/store/testing';
import { Observable, of, throwError } from 'rxjs';
import { TimeOffRequest } from 'src/app/core/models/time-off-request.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { PtoService } from 'src/app/core/services/pto.service';
import { TimeOffRequestService } from 'src/app/core/services/time-off-request.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { TimeOffApprovalsComponent } from './time-off-approvals.component';

describe('TimeOffApprovalsComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<TimeOffApprovalsComponent>;
  let service: { getTimeOffRequests: jasmine.Spy; approveTimeOffRequest: jasmine.Spy };
  const el = () => fixture.nativeElement as HTMLElement;

  const request = (id: number, overrides: Partial<TimeOffRequest> = {}): TimeOffRequest => ({
    timeOffRequestId: id,
    companyId: 'c1',
    personId: id,
    personName: `Person ${id}`,
    type: 'Vacation',
    startDate: new Date('2026-12-01'),
    endDate: new Date('2026-12-03'),
    isPartialDay: false,
    status: 'Pending',
    createdAt: new Date('2026-11-01'),
    hoursRequested: 16,
    ...overrides,
  } as TimeOffRequest);

  async function setup(list: TimeOffRequest[] | Observable<TimeOffRequest[]>) {
    service = {
      getTimeOffRequests: jasmine.createSpy('getTimeOffRequests').and.returnValue(Array.isArray(list) ? of(list) : list),
      approveTimeOffRequest: jasmine.createSpy('approveTimeOffRequest').and.returnValue(of({})),
    };
    await TestBed.configureTestingModule({
      imports: [TimeOffApprovalsComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'c1' } }] }),
        { provide: TimeOffRequestService, useValue: service },
        { provide: PeopleService, useValue: { getPeople: () => of([{ personId: 1, name: 'Person 1' }]) } },
        { provide: PtoService, useValue: { getBalance: () => of({ balance: 8 }) } },
        { provide: MatSnackBar, useValue: { open: jasmine.createSpy('open') } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TimeOffApprovalsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('uses lz-page-header with one h1 and no legacy icon or card classes', async () => {
    await setup([request(1)]);
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')).not.toBeNull();
    expect(el().querySelector('i.fa, .request-card, .filters-card, .btn')).toBeNull();
  });

  it('lists requests in a table inside lz-table-scroll that scrolls horizontally at 360px', async () => {
    await setup([request(1), request(2)]);
    const scroll = el().querySelector('lz-table-scroll') as HTMLElement;
    expect(scroll).not.toBeNull();
    expect(scroll.querySelectorAll('tbody tr').length).toBe(2);
    expect(getComputedStyle(scroll).overflowX).toBe('auto');
    fixture.nativeElement.style.width = '360px';
    fixture.nativeElement.style.display = 'block';
    expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
  });

  it('shows the status of each row as an lz-status-chip with a text label and the right tone', async () => {
    await setup([request(1), request(2, { status: 'Approved' }), request(3, { status: 'Denied' })]);
    const rows = Array.from(el().querySelectorAll('tbody tr'));
    const chips = rows.map(r => r.querySelector('lz-status-chip[data-testid="status"]')!);
    expect(chips.map(c => c.textContent!.trim())).toEqual(['Pending', 'Approved', 'Denied']);
    const bg = chips.map(c => getComputedStyle(c.firstElementChild as HTMLElement).backgroundColor);
    expect(new Set(bg).size).toBe(3);
  });

  it('shows an lz-empty-state when there are no requests', async () => {
    await setup([]);
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    expect(el().querySelector('lz-table-scroll')).toBeNull();
  });

  it('shows an lz-alert with the error and no table when loading fails', async () => {
    spyOn(console, 'error');
    await setup(throwError(() => new Error('boom')));
    const alert = el().querySelector('lz-alert');
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toContain('Failed to load time-off requests');
    expect(el().querySelector('lz-table-scroll')).toBeNull();
  });

  it('pages long lists with lz-pager and paginate', async () => {
    await setup(Array.from({ length: 23 }, (_, i) => request(i + 1)));
    expect(el().querySelectorAll('tbody tr').length).toBe(10);
    const pager = el().querySelector('lz-pager')!;
    expect(pager.textContent).toContain('1–10 of 23');
    (pager.querySelector('button[aria-label="Next page"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelectorAll('tbody tr').length).toBe(10);
    expect(el().querySelector('lz-pager')!.textContent).toContain('11–20 of 23');
  });

  it('approve and deny act on the row and use >=48px buttons; only pending rows are actionable', async () => {
    await setup([request(1), request(2, { status: 'Approved' })]);
    const rows = Array.from(el().querySelectorAll('tbody tr'));
    const approve = rows[0].querySelector('[data-testid="approve"]') as HTMLButtonElement;
    const deny = rows[0].querySelector('[data-testid="deny"]') as HTMLButtonElement;
    expect(approve.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect(deny.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect((rows[1].querySelector('[data-testid="approve"]') as HTMLButtonElement).disabled).toBeTrue();
    const note = rows[0].querySelector('textarea') as HTMLTextAreaElement;
    note.value = 'ok';
    note.dispatchEvent(new Event('input'));
    approve.click();
    expect(service.approveTimeOffRequest).toHaveBeenCalledWith('c1', 1, true, 'ok');
  });

  it('flags insufficient PTO balance with text, not colour alone', async () => {
    await setup([request(1, { hoursRequested: 16 })]);
    expect(el().querySelector('tbody')!.textContent).toContain('Insufficient');
  });

  it('labels every row control for assistive tech', async () => {
    await setup([request(1)]);
    const note = el().querySelector('tbody textarea')!;
    expect(note.getAttribute('aria-label') || note.id).toBeTruthy();
    expect(el().querySelectorAll('label[for], input[aria-label], select[aria-label]').length).toBeGreaterThan(0);
  });
});
