import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Observable, of, throwError } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { BulletinsComponent } from './bulletins.component';
import './bulletins.module';
import { BulletinService } from 'src/app/core/services/bulletin.service';
import { LocationService } from 'src/app/core/services/location.service';
import { PermissionService } from 'src/app/core/services/permission.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { PagedResult } from 'src/app/core/models/paged-result.model';
import { Bulletin } from 'src/app/core/models/bulletin.model';
import { SharedModule } from 'src/app/shared/shared.module';

const bulletin = (id: number, over: Partial<Bulletin> = {}): Bulletin => ({
  bulletinId: `b${id}`, companyId: 'co-test', title: `Bulletin ${id}`, content: 'Body', type: 'General', priority: 'Normal',
  status: 'Published', isReadByCurrentUser: false, totalReads: 0, publishedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z', createdByName: 'Admin', ...over
});
const many = (n: number) => Array.from({ length: n }, (_, i) => bulletin(i + 1));
const paged = (items: Bulletin[], totalCount = items.length): PagedResult<Bulletin> => ({ items, totalCount, page: 1, pageSize: 25 });

describe('BulletinsComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<BulletinsComponent>;
  let svc: Record<string, jasmine.Spy>;
  let perms: Set<string>;
  const el = () => fixture.nativeElement as HTMLElement;
  const panel = () => document.querySelector('lz-side-panel [role="dialog"]') as HTMLElement | null;
  const dialog = () => document.querySelector('[role="alertdialog"]') as HTMLElement | null;
  const archiveBtn = (n: number) => el().querySelector(`[aria-label="Archive Bulletin ${n}"]`) as HTMLElement;

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  async function click(target: Element | null) {
    (target as HTMLElement).click();
    await settle();
  }

  async function setup(result: PagedResult<Bulletin> | Observable<PagedResult<Bulletin>>, opts: { page?: number } = {}) {
    perms = new Set(['bulletins.create', 'bulletins.delete']);
    svc = {
      getBulletins: jasmine.createSpy('getBulletins').and.returnValue(result instanceof Observable ? result : of(result)),
      markAsRead: jasmine.createSpy('markAsRead').and.returnValue(of(undefined)),
      createBulletin: jasmine.createSpy('createBulletin').and.callFake((_c: string, dto: any) => of(bulletin(99, { title: dto.title }))),
      archiveBulletin: jasmine.createSpy('archiveBulletin').and.returnValue(of(undefined)),
    };
    await TestBed.configureTestingModule({
      declarations: [BulletinsComponent],
      imports: [ReactiveFormsModule, NoopAnimationsModule, SharedModule],
      providers: [
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'co-test' } }] }),
        { provide: BulletinService, useValue: svc },
        { provide: LocationService, useValue: { getLocations: () => of([{ locationId: 7, name: 'HQ', status: 'Active' }]) } },
        { provide: PermissionService, useValue: { hasPermission: (k: string) => perms.has(k) } },
        { provide: ToastrService, useValue: { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(BulletinsComponent);
    if (opts.page) fixture.componentInstance.page = opts.page;
    await settle();
  }

  it('renders one h1 through lz-page-header and exactly one primary button', async () => {
    await setup(paged([bulletin(1)]));
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Bulletins');
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    expect(el().querySelector('[variant="primary"]')!.textContent).toContain('New bulletin');
    expect(el().querySelector('.page-container, .filter-btn, mat-paginator')).toBeNull();
  });

  it('read state and priority render as lz-status-chip with text', async () => {
    await setup(paged([bulletin(1, { priority: 'Critical' }), bulletin(2, { isReadByCurrentUser: true })]));
    const rows = el().querySelectorAll('tbody tr');
    const chips = (i: number) => Array.from(rows[i].querySelectorAll('lz-status-chip')).map(c => c.textContent!.trim());
    expect(chips(0)).toEqual(['Critical', 'Unread']);
    expect(chips(1)).toEqual(['Normal', 'Read']);
  });

  it('lists in lz-table-scroll with scoped headers', async () => {
    await setup(paged([bulletin(1)]));
    expect(el().querySelector('lz-table-scroll table')).not.toBeNull();
    el().querySelectorAll('thead th').forEach(th => expect(th.getAttribute('scope')).toBe('col'));
  });

  it('shows lz-empty-state and no table when there are no bulletins, with a focus-opening add button', async () => {
    await setup(paged([]));
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    expect(el().querySelector('lz-table-scroll')).toBeNull();
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    const emptyAdd = el().querySelector('lz-empty-state button') as HTMLElement;
    emptyAdd.focus();
    await click(emptyAdd);
    expect(panel()).not.toBeNull();
    await click(panel()!.querySelector('[aria-label="Close"]'));
    await settle();
    expect(document.activeElement).toBe(emptyAdd);
  });

  it('shows an lz-alert and no empty state when loading fails, and Retry reloads', async () => {
    await setup(throwError(() => new Error('boom')));
    expect(el().querySelector('lz-alert[role="alert"]')!.textContent).toContain('Could not load bulletins.');
    expect(el().querySelector('lz-empty-state')).toBeNull();
    svc['getBulletins'].and.returnValue(of(paged([bulletin(1)])));
    await click(el().querySelector('lz-alert button'));
    expect(el().querySelectorAll('tbody tr').length).toBe(1);
  });

  it('unread filter shows only unread rows and its empty state has no add button', async () => {
    await setup(paged([bulletin(1, { isReadByCurrentUser: true }), bulletin(2)]));
    const unread = () => Array.from(el().querySelectorAll('lz-segmented button')).find(b => b.textContent!.includes('Unread'))!;
    await click(unread());
    expect(el().querySelectorAll('tbody tr').length).toBe(1);
    fixture.componentInstance.bulletins = [bulletin(1, { isReadByCurrentUser: true })];
    fixture.componentInstance.applyFilter();
    await settle();
    expect(el().querySelector('lz-empty-state')!.textContent).toContain('All caught up');
    expect(el().querySelector('lz-empty-state button')).toBeNull();
  });

  it('renders no form until the panel opens and the form lives only in lz-side-panel', async () => {
    await setup(paged([bulletin(1)]));
    expect(el().querySelector('form')).toBeNull();
    expect(document.querySelector('form')).toBeNull();
    await click(el().querySelector('lz-page-header button'));
    expect(panel()!.querySelector('form')).not.toBeNull();
    expect(el().querySelector('form')).toBeNull();
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(0);
    expect(el().querySelector('lz-page-header [variant="secondary"]')).not.toBeNull();
  });

  it('marks required fields through lz-field and publishes a bulletin', async () => {
    await setup(paged([]));
    await click(el().querySelector('lz-page-header button'));
    const required = Array.from(panel()!.querySelectorAll('lz-field')).filter(f => f.querySelector('label span[aria-hidden]')).map(f => f.querySelector('label')!.textContent!.trim());
    expect(required).toEqual(['Title *', 'Content *']);
    const submit = panel()!.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBeTrue();
    const title = panel()!.querySelector('#bulletin-title') as HTMLInputElement;
    title.value = 'Hello'; title.dispatchEvent(new Event('input'));
    const content = panel()!.querySelector('#bulletin-content') as HTMLTextAreaElement;
    content.value = 'World'; content.dispatchEvent(new Event('input'));
    await settle();
    await click(panel()!.querySelector('button[type="submit"]'));
    expect(svc['createBulletin']).toHaveBeenCalled();
    expect(svc['createBulletin'].calls.mostRecent().args[1].title).toBe('Hello');
    expect(panel()).toBeNull();
    expect(el().textContent).toContain('Hello');
  });

  it('renders only 25 rows when the server reports 120 and requests the next page', async () => {
    await setup(paged(many(25), 120));
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
    expect(el().querySelector('lz-pager')!.textContent).toContain('1–25 of 120');
    svc['getBulletins'].and.returnValue(of(paged([bulletin(26)], 120)));
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(svc['getBulletins'].calls.mostRecent().args.slice(4)).toEqual([2, 25]);
    expect(el().querySelector('tbody tr')!.textContent).toContain('Bulletin 26');
  });

  it('clamps an out-of-range page after load by reloading the last page', async () => {
    await setup(paged([], 25), { page: 3 });
    const calls = svc['getBulletins'].calls.allArgs().map((a: any[]) => a[4]);
    expect(calls).toEqual([3, 1]);
    expect(fixture.componentInstance.page).toBe(1);
  });

  it('archiving the only row on the last page falls back one page', async () => {
    await setup(paged([bulletin(26)], 26), { page: 2 });
    svc['getBulletins'].and.returnValue(of(paged(many(25), 25)));
    await click(archiveBtn(26));
    await click(Array.from(dialog()!.querySelectorAll('button')).find(b => b.textContent!.includes('Archive bulletin'))!);
    expect(fixture.componentInstance.page).toBe(1);
    expect(svc['getBulletins'].calls.mostRecent().args.slice(4)).toEqual([1, 25]);
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
  });

  it('archiving asks in an alertdialog and only archives after confirming', async () => {
    await setup(paged([bulletin(1)]));
    await click(archiveBtn(1));
    expect(dialog()!.textContent).toContain('Archive Bulletin 1?');
    expect(svc['archiveBulletin']).not.toHaveBeenCalled();
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    await click(Array.from(dialog()!.querySelectorAll('button')).find(b => b.textContent!.includes('Archive bulletin'))!);
    expect(svc['archiveBulletin']).toHaveBeenCalledWith('co-test', 'b1');
    expect(dialog()).toBeNull();
  });

  it('Cancel and Escape close the archive dialog and return focus to the trigger', async () => {
    await setup(paged([bulletin(1)]));
    const trigger = archiveBtn(1);
    trigger.focus();
    await click(trigger);
    await click(Array.from(dialog()!.querySelectorAll('button')).find(b => b.textContent!.trim() === 'Cancel')!);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await click(trigger);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(dialog()).toBeNull();
    expect(svc['archiveBulletin']).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it('a failed archive keeps the row, toasts an error and refocuses the trigger', async () => {
    await setup(paged([bulletin(1)]));
    svc['archiveBulletin'].and.returnValue(throwError(() => new Error('boom')));
    const toastr = TestBed.inject(ToastrService) as any;
    const trigger = archiveBtn(1);
    trigger.focus();
    await click(trigger);
    await click(Array.from(dialog()!.querySelectorAll('button')).find(b => b.textContent!.includes('Archive bulletin'))!);
    expect(dialog()).toBeNull();
    expect(el().querySelectorAll('tbody tr').length).toBe(1);
    expect(toastr.error).toHaveBeenCalledWith('Could not archive the bulletin.');
    expect(document.activeElement).toBe(trigger);
  });

  it('after a successful archive focus moves to the New bulletin button', async () => {
    await setup(paged([bulletin(1)]));
    await click(archiveBtn(1));
    await click(Array.from(dialog()!.querySelectorAll('button')).find(b => b.textContent!.includes('Archive bulletin'))!);
    await settle();
    expect(document.activeElement).toBe(el().querySelector('lz-page-header button'));
  });

  it('row actions marking read do not double-fire the row click', async () => {
    await setup(paged([bulletin(1)]));
    await click(el().querySelector('[aria-label="Mark Bulletin 1 as read"]'));
    expect(svc['markAsRead']).toHaveBeenCalledTimes(1);
    await click(archiveBtn(1));
    expect(svc['markAsRead']).toHaveBeenCalledTimes(1);
  });

  it('clicking a row marks it read', async () => {
    await setup(paged([bulletin(1)]));
    await click(el().querySelector('tbody tr'));
    expect(svc['markAsRead']).toHaveBeenCalledWith('co-test', 'b1');
  });

  it('keeps row action targets at 48px and the heading at 26px', async () => {
    await setup(paged([bulletin(1)]));
    const box = archiveBtn(1).getBoundingClientRect();
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(getComputedStyle(el().querySelector('h1')!).fontSize).toBe('26px');
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
