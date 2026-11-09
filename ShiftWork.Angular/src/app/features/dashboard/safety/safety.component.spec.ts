import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Observable, of, throwError } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { SafetyComponent } from './safety.component';
import './safety.module';
import { SafetyService } from 'src/app/core/services/safety.service';
import { LocationService } from 'src/app/core/services/location.service';
import { PermissionService } from 'src/app/core/services/permission.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { PagedResult } from 'src/app/core/models/paged-result.model';
import { SafetyContent } from 'src/app/core/models/safety.model';
import { SharedModule } from 'src/app/shared/shared.module';

const content = (id: number, over: Partial<SafetyContent> = {}): SafetyContent => ({
  safetyContentId: `s${id}`, companyId: 'co-test', title: `Talk ${id}`, description: 'Weekly talk', type: 'ToolboxTalk',
  status: 'Published', isAcknowledgmentRequired: true, isAcknowledgedByCurrentUser: false,
  createdAt: '2026-01-01T00:00:00Z', createdByName: 'Admin', ...over
});
const many = (n: number) => Array.from({ length: n }, (_, i) => content(i + 1));
const paged = (items: SafetyContent[], totalCount = items.length): PagedResult<SafetyContent> => ({ items, totalCount, page: 1, pageSize: 25 });

describe('SafetyComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<SafetyComponent>;
  let svc: Record<string, jasmine.Spy>;
  const el = () => fixture.nativeElement as HTMLElement;
  const panel = () => document.querySelector('lz-side-panel [role="dialog"]') as HTMLElement | null;
  const dialog = () => document.querySelector('[role="alertdialog"]') as HTMLElement | null;
  const archiveBtn = (n: number) => el().querySelector(`[aria-label="Archive Talk ${n}"]`) as HTMLElement;
  const confirmBtn = () => Array.from(dialog()!.querySelectorAll('button')).find(b => b.textContent!.includes('Archive content'))!;

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  async function click(target: Element | null) {
    (target as HTMLElement).click();
    await settle();
  }

  async function setup(result: PagedResult<SafetyContent> | Observable<PagedResult<SafetyContent>>, opts: { page?: number } = {}) {
    svc = {
      getContents: jasmine.createSpy('getContents').and.returnValue(result instanceof Observable ? result : of(result)),
      acknowledge: jasmine.createSpy('acknowledge').and.returnValue(of(undefined)),
      createContent: jasmine.createSpy('createContent').and.callFake((_c: string, dto: any) => of(content(99, { title: dto.title }))),
      archiveContent: jasmine.createSpy('archiveContent').and.returnValue(of(undefined)),
      getAcknowledgmentStatus: jasmine.createSpy('getAcknowledgmentStatus').and.returnValue(of({
        totalAssigned: 10, totalCompleted: 4, completionRate: 0.4, completed: [], pending: [{ personId: 1, name: 'Ana Ruiz' }]
      })),
    };
    await TestBed.configureTestingModule({
      declarations: [SafetyComponent],
      imports: [ReactiveFormsModule, NoopAnimationsModule, SharedModule],
      providers: [
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'co-test' } }] }),
        { provide: SafetyService, useValue: svc },
        { provide: LocationService, useValue: { getLocations: () => of([]) } },
        { provide: PermissionService, useValue: { hasPermission: () => true } },
        { provide: ToastrService, useValue: { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(SafetyComponent);
    if (opts.page) fixture.componentInstance.page = opts.page;
    await settle();
  }

  it('renders one h1 through lz-page-header and exactly one primary button', async () => {
    await setup(paged([content(1)]));
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Safety');
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    expect(el().querySelector('[variant="primary"]')!.textContent).toContain('New content');
    expect(el().querySelector('.page-container, .filter-btn, mat-paginator, mat-progress-bar')).toBeNull();
  });

  it('shows acknowledgment states as lz-status-chip with text', async () => {
    await setup(paged([
      content(1),
      content(2, { isAcknowledgedByCurrentUser: true }),
      content(3, { isAcknowledgmentRequired: false })
    ]));
    const chips = Array.from(el().querySelectorAll('tbody tr')).map(r => r.querySelector('lz-status-chip')!.textContent!.trim());
    expect(chips).toEqual(['Action required', 'Acknowledged', 'Not required']);
  });

  it('shows compliance progress as a text chip with a percentage', async () => {
    await setup(paged([content(1)]));
    await click(el().querySelector('[aria-label="View compliance for Talk 1"]'));
    const row = el().querySelector('[data-testid="compliance-row"]')!;
    expect(row.querySelector('lz-status-chip')!.textContent).toContain('4 / 10 acknowledged (40%)');
    expect(row.textContent).toContain('Ana Ruiz');
    expect(el().querySelector('[aria-label="Hide compliance for Talk 1"]')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('lists in lz-table-scroll with scoped headers', async () => {
    await setup(paged([content(1)]));
    expect(el().querySelector('lz-table-scroll table')).not.toBeNull();
    el().querySelectorAll('thead th').forEach(th => expect(th.getAttribute('scope')).toBe('col'));
  });

  it('shows lz-empty-state with a focus-opening add button when there is no content', async () => {
    await setup(paged([]));
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    expect(el().querySelector('lz-table-scroll')).toBeNull();
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    const emptyAdd = el().querySelector('lz-empty-state button') as HTMLElement;
    emptyAdd.focus();
    await click(emptyAdd);
    await click(panel()!.querySelector('[aria-label="Close"]'));
    await settle();
    expect(document.activeElement).toBe(emptyAdd);
  });

  it('shows an lz-alert and no empty state when loading fails', async () => {
    await setup(throwError(() => new Error('boom')));
    expect(el().querySelector('lz-alert[role="alert"]')!.textContent).toContain('Could not load safety content.');
    expect(el().querySelector('lz-empty-state')).toBeNull();
  });

  it('the pending tab lists only items needing acknowledgment and its empty state has no add button', async () => {
    await setup(paged([content(1, { isAcknowledgedByCurrentUser: true })]));
    await click(Array.from(el().querySelectorAll('lz-segmented button')).find(b => b.textContent!.includes('Pending'))!);
    expect(el().querySelector('lz-empty-state')!.textContent).toContain('All caught up!');
    expect(el().querySelector('lz-empty-state button')).toBeNull();
  });

  it('acknowledging calls the service and flips the chip', async () => {
    await setup(paged([content(1)]));
    await click(el().querySelector('[aria-label="I acknowledge Talk 1"]'));
    expect(svc['acknowledge']).toHaveBeenCalledWith('co-test', 's1');
    expect(el().querySelector('tbody lz-status-chip')!.textContent).toContain('Acknowledged');
  });

  it('shows the safety text and the acknowledge prompt by default, only for required unacknowledged items', async () => {
    await setup(paged([
      content(1, { textContent: 'Line one\nLine two' }),
      content(2, { isAcknowledgedByCurrentUser: true }),
      content(3, { isAcknowledgmentRequired: false })
    ]));
    const rows = el().querySelectorAll('tbody tr');
    const text = rows[0].querySelector('[data-testid="content-text"]') as HTMLElement;
    expect(text.textContent).toContain('Line one');
    expect(text.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(getComputedStyle(text).whiteSpace).toBe('pre-line');
    expect(rows[0].querySelector('[data-testid="ack-prompt"]')!.textContent).toContain('Please review and acknowledge this safety content before continuing.');
    expect(rows[1].querySelector('[data-testid="ack-prompt"]')).toBeNull();
    expect(rows[2].querySelector('[data-testid="ack-prompt"]')).toBeNull();
    expect(rows[1].querySelector('[data-testid="content-text"]')).toBeNull();
  });

  it('the compliance toggle is its own control and does not hide the text', async () => {
    await setup(paged([content(1, { textContent: 'Body text' })]));
    const toggle = el().querySelector('[aria-label="View compliance for Talk 1"]') as HTMLElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await click(toggle);
    expect(el().querySelector('[data-testid="content-text"]')!.textContent).toContain('Body text');
    expect(el().querySelector('[data-testid="compliance-row"] [data-testid="content-text"]')).toBeNull();
  });

  it('a failed acknowledgment keeps the item unacknowledged and toasts an error', async () => {
    await setup(paged([content(1)]));
    svc['acknowledge'].and.returnValue(throwError(() => new Error('boom')));
    await click(el().querySelector('[aria-label="I acknowledge Talk 1"]'));
    expect((TestBed.inject(ToastrService) as any).error).toHaveBeenCalledWith('Could not save your acknowledgment.');
    expect(el().querySelector('tbody lz-status-chip')!.textContent).toContain('Action required');
    expect(el().querySelector('[data-testid="ack-prompt"]')).not.toBeNull();
    expect(el().querySelector('[aria-label="I acknowledge Talk 1"]')).not.toBeNull();
  });

  it('shows an error state in the expanded row when compliance fails to load', async () => {
    await setup(paged([content(1)]));
    svc['getAcknowledgmentStatus'].and.returnValue(throwError(() => new Error('boom')));
    await click(el().querySelector('[aria-label="View compliance for Talk 1"]'));
    const row = el().querySelector('[data-testid="compliance-row"]')!;
    expect(row.textContent).toContain('Could not load compliance data.');
    expect(row.textContent).not.toContain('Loading compliance');
    expect(row.querySelector('lz-alert[role="alert"]')).not.toBeNull();
  });

  it('shows the scheduled date with the locale medium format', async () => {
    await setup(paged([content(1, { scheduledFor: '2026-03-05T12:00:00Z' })]));
    expect(el().querySelector('tbody tr')!.textContent).toContain('Mar 5, 2026');
  });

  it('converts scheduledFor from local midnight to ISO on submit and sends null when empty', async () => {
    await setup(paged([]));
    await click(el().querySelector('lz-page-header button'));
    for (const [id, value] of [['#safety-title', 'T'], ['#safety-description', 'D']]) {
      const input = panel()!.querySelector(id) as HTMLInputElement;
      input.value = value; input.dispatchEvent(new Event('input'));
    }
    await settle();
    await click(panel()!.querySelector('button[type="submit"]'));
    expect(svc['createContent'].calls.mostRecent().args[1].scheduledFor).toBeNull();
    await click(el().querySelector('lz-page-header button'));
    for (const [id, value] of [['#safety-title', 'T'], ['#safety-description', 'D'], ['#safety-scheduled', '2026-12-01']]) {
      const input = panel()!.querySelector(id) as HTMLInputElement;
      input.value = value; input.dispatchEvent(new Event('input'));
    }
    await settle();
    await click(panel()!.querySelector('button[type="submit"]'));
    expect(svc['createContent'].calls.mostRecent().args[1].scheduledFor).toBe(new Date('2026-12-01T00:00:00').toISOString());
  });

  it('renders no form until the panel opens and only inside lz-side-panel', async () => {
    await setup(paged([content(1)]));
    expect(el().querySelector('form')).toBeNull();
    expect(document.querySelector('form')).toBeNull();
    await click(el().querySelector('lz-page-header button'));
    expect(panel()!.querySelector('form')).not.toBeNull();
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(0);
  });

  it('marks required fields via lz-field, keeps the checkbox at 24px with a 48px row, and publishes', async () => {
    await setup(paged([]));
    await click(el().querySelector('lz-page-header button'));
    const required = Array.from(panel()!.querySelectorAll('lz-field')).filter(f => f.querySelector('label span[aria-hidden]')).map(f => f.querySelector('label')!.textContent!.trim());
    expect(required).toEqual(['Title *', 'Description *']);
    const box = (panel()!.querySelector('input[type="checkbox"]') as HTMLElement).getBoundingClientRect();
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
    expect((panel()!.querySelector('input[type="checkbox"]')!.closest('label') as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect((panel()!.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBeTrue();
    for (const [id, value] of [['#safety-title', 'Ladders'], ['#safety-description', 'Use them well']]) {
      const input = panel()!.querySelector(id) as HTMLInputElement;
      input.value = value; input.dispatchEvent(new Event('input'));
    }
    await settle();
    await click(panel()!.querySelector('button[type="submit"]'));
    expect(svc['createContent'].calls.mostRecent().args[1].title).toBe('Ladders');
    expect(panel()).toBeNull();
  });

  it('renders only 25 rows when the server reports 120 and requests the next page', async () => {
    await setup(paged(many(25), 120));
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
    expect(el().querySelector('lz-pager')!.textContent).toContain('1–25 of 120');
    svc['getContents'].and.returnValue(of(paged([content(26)], 120)));
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(svc['getContents'].calls.mostRecent().args.slice(4)).toEqual([2, 25]);
  });

  it('clamps an out-of-range page after load by reloading the last page', async () => {
    await setup(paged([], 25), { page: 3 });
    expect(svc['getContents'].calls.allArgs().map((a: any[]) => a[4])).toEqual([3, 1]);
    expect(fixture.componentInstance.page).toBe(1);
  });

  it('archiving the only row on the last page falls back one page', async () => {
    await setup(paged([content(26)], 26), { page: 2 });
    svc['getContents'].and.returnValue(of(paged(many(25), 25)));
    await click(archiveBtn(26));
    await click(confirmBtn());
    expect(fixture.componentInstance.page).toBe(1);
    expect(svc['getContents'].calls.mostRecent().args.slice(4)).toEqual([1, 25]);
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
  });

  it('archiving asks in an alertdialog and only archives after confirming', async () => {
    await setup(paged([content(1)]));
    await click(archiveBtn(1));
    expect(dialog()!.textContent).toContain('Archive Talk 1?');
    expect(svc['archiveContent']).not.toHaveBeenCalled();
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    await click(confirmBtn());
    expect(svc['archiveContent']).toHaveBeenCalledWith('co-test', 's1');
    expect(dialog()).toBeNull();
  });

  it('Cancel and Escape close the archive dialog and return focus to the trigger', async () => {
    await setup(paged([content(1)]));
    const trigger = archiveBtn(1);
    trigger.focus();
    await click(trigger);
    await click(Array.from(dialog()!.querySelectorAll('button')).find(b => b.textContent!.trim() === 'Cancel')!);
    expect(document.activeElement).toBe(trigger);
    await click(trigger);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(dialog()).toBeNull();
    expect(svc['archiveContent']).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it('a failed archive keeps the row, toasts an error and refocuses the trigger', async () => {
    await setup(paged([content(1)]));
    svc['archiveContent'].and.returnValue(throwError(() => new Error('boom')));
    const trigger = archiveBtn(1);
    trigger.focus();
    await click(trigger);
    await click(confirmBtn());
    expect(dialog()).toBeNull();
    expect(el().querySelectorAll('tbody tr').length).toBe(1);
    expect((TestBed.inject(ToastrService) as any).error).toHaveBeenCalledWith('Could not archive the safety content.');
    expect(document.activeElement).toBe(trigger);
  });

  it('after a successful archive focus moves to the New content button', async () => {
    await setup(paged([content(1)]));
    await click(archiveBtn(1));
    await click(confirmBtn());
    await settle();
    expect(document.activeElement).toBe(el().querySelector('lz-page-header button'));
  });

  it('keeps row action targets at 48px and the heading at 26px', async () => {
    await setup(paged([content(1)]));
    const box = archiveBtn(1).getBoundingClientRect();
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(getComputedStyle(el().querySelector('h1')!).fontSize).toBe('26px');
    expect((el().querySelector('[aria-label="I acknowledge Talk 1"]') as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
  });

  for (const width of [360, 768]) {
    it(`contains the table inside lz-table-scroll without page overflow at ${width}px`, async () => {
      await setup(paged(many(3)));
      const host = el();
      host.style.display = 'block';
      host.style.width = `${width}px`;
      const scroll = host.querySelector('lz-table-scroll') as HTMLElement;
      expect(getComputedStyle(scroll).overflowX).toBe('auto');
      expect(scroll.clientWidth).toBeLessThanOrEqual(width);
      expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
    });
  }
});
