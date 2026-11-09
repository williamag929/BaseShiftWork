import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { ScheduleGridData, ShiftBlock } from 'src/app/core/models/schedule-grid.model';
import { ScheduleGridComponent } from './schedule-grid.component';
import { RepeatPatternModalComponent } from './repeat-pattern-modal.component';
import { ReplacementPanelComponent } from './replacement-panel.component';
import { ScheduleConflictInfo, ScheduleConflictModalComponent } from './schedule-conflict-modal.component';
import { ShiftHistoryModalComponent } from './shift-history-modal.component';
import { SickReportModalComponent } from './sick-report-modal.component';
import { TimeOffRequestModalComponent } from './time-off-request-modal.component';

describe('ScheduleGridComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<ScheduleGridComponent>;
  let component: ScheduleGridComponent;

  const monday = new Date(Date.UTC(2026, 10, 2));
  const day = (offset: number) => new Date(Date.UTC(2026, 10, 2 + offset));

  function shift(overrides: Partial<ShiftBlock> = {}): ShiftBlock {
    return {
      scheduleShiftId: 1,
      personId: 10,
      personName: 'Ana Ruiz',
      startTime: '7am',
      endTime: '3pm',
      startDate: new Date(Date.UTC(2026, 10, 2, 7)),
      endDate: new Date(Date.UTC(2026, 10, 2, 15)),
      areaName: 'Lobby',
      status: 'published',
      ...overrides,
    };
  }

  function grid(stats: Partial<ScheduleGridData['stats']> = {}, shifts: ShiftBlock[] = [shift()]): ScheduleGridData {
    return {
      weekStart: monday,
      weekEnd: day(6),
      locationName: 'HQ',
      teamMembers: [{ personId: 10, initials: 'AR', fullName: 'Ana Ruiz', totalHours: '8h' }],
      days: Array.from({ length: 7 }, (_, i) => ({
        date: day(i),
        dayName: `D${i}`,
        unavailableCount: 0,
        shifts: i === 0 ? shifts : [],
      })),
      stats: {
        empty: 0,
        unpublished: 0,
        published: 0,
        requireConfirmation: 0,
        openShifts: 0,
        warnings: 0,
        leaveApproved: 0,
        leavePending: 0,
        unavailable: 0,
        ...stats,
      },
    };
  }

  async function setup(data: ScheduleGridData) {
    await TestBed.configureTestingModule({
      imports: [ScheduleGridComponent],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: null }] }),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ScheduleGridComponent);
    component = fixture.componentInstance;
    component.gridData = data;
    component.viewMode = 'single';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;

  it('header has exactly one primary button and it publishes', async () => {
    await setup(grid({ unpublished: 7 }));
    const primaries = el().querySelectorAll('button[variant="primary"]');
    expect(primaries.length).toBe(1);
    const publish = primaries[0] as HTMLButtonElement;
    expect(publish.textContent?.replace(/\s+/g, ' ').trim()).toBe('Publish 7 shifts');
    expect(publish.closest('lz-page-header')).not.toBeNull();
    const spy = spyOn(component, 'onPublishAllShifts');
    publish.click();
    expect(spy).toHaveBeenCalled();
  });

  it('uses a singular label for one unpublished shift', async () => {
    await setup(grid({ unpublished: 1 }));
    const publish = el().querySelector('button[variant="primary"]') as HTMLButtonElement;
    expect(publish.textContent?.replace(/\s+/g, ' ').trim()).toBe('Publish 1 shift');
  });

  it('has no More options button and a non-interactive summary strip', async () => {
    await setup(grid({ unpublished: 3 }));
    expect(el().querySelector('[aria-label="More options"]')).toBeNull();
    expect(el().querySelectorAll('lz-summary-strip button').length).toBe(0);
  });

  it('primary button is disabled with "All shifts published" when nothing is unpublished', async () => {
    await setup(grid({ unpublished: 0 }));
    const publish = el().querySelector('button[variant="primary"]') as HTMLButtonElement;
    expect(publish.disabled).toBeTrue();
    expect(publish.textContent?.replace(/\s+/g, ' ').trim()).toBe('All shifts published');
  });

  it('summaryItems omits zero counts', async () => {
    await setup(grid({ unpublished: 3, openShifts: 0, warnings: 2, leavePending: 0, unavailable: 1 }));
    const items = component.summaryItems;
    expect(items.map(i => i.id)).toEqual(['drafts', 'warnings', 'unavailable']);
    expect(items.map(i => i.tone)).toEqual(['draft', 'danger', 'neutral']);
    expect(items[0].count).toBe(3);
    expect(el().querySelector('lz-summary-strip')).not.toBeNull();
  });

  it('summaryItems keeps the same array while counts are unchanged', async () => {
    await setup(grid({ unpublished: 3 }));
    const first = component.summaryItems;
    fixture.detectChanges();
    expect(component.summaryItems).toBe(first);
    component.gridData = grid({ unpublished: 4 });
    expect(component.summaryItems).not.toBe(first);
    expect(component.summaryItems[0].count).toBe(4);
  });

  it('horizon buttons have accessible names containing their visible text', async () => {
    await setup(grid());
    const buttons = Array.from(el().querySelectorAll('[role="group"] button')) as HTMLButtonElement[];
    expect(buttons.length).toBe(4);
    for (const b of buttons) {
      expect(b.getAttribute('aria-label')).toContain(b.textContent!.trim());
    }
    expect(buttons[0].getAttribute('aria-label')).toBe('1W, 1 week');
  });

  it('renders lz-shift-block with mapped status', async () => {
    await setup(grid({}, [shift({ status: 'unpublished' })]));
    const block = el().querySelector('lz-shift-block button') as HTMLButtonElement;
    expect(block).not.toBeNull();
    expect(block.getAttribute('aria-label')).toMatch(/^Draft/);
    expect(el().textContent).not.toContain('LOCKED');
    expect(el().textContent).not.toContain('VOID');
  });

  it('shift block selection toggles without needing a DOM event', async () => {
    await setup(grid());
    const box = el().querySelector('lz-shift-block input[type="checkbox"]') as HTMLInputElement;
    box.click();
    fixture.detectChanges();
    expect(component.selectedShifts.size).toBe(1);
    expect(component.showBulkActions).toBeTrue();
  });

  it('grid scrolls horizontally with a sticky team column', async () => {
    await setup(grid());
    const wrapper = el().querySelector('[role="table"]')?.parentElement as HTMLElement;
    expect(wrapper.classList).toContain('overflow-x-auto');
    const rows = Array.from(el().querySelectorAll('[role="row"]'));
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) {
      const first = row.firstElementChild as HTMLElement;
      expect(first.classList).toContain('sticky');
      expect(first.classList).toContain('left-0');
    }
  });

  it('location picker stays in the header meta slot', async () => {
    await setup(grid());
    const select = el().querySelector('lz-page-header [lzHeaderMeta] select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.options.length).toBeGreaterThanOrEqual(2);
  });

  it('empty cells offer a labelled add-shift button', async () => {
    await setup(grid());
    const add = el().querySelector('button[aria-label="Add shift for Ana Ruiz on D1"]');
    expect(add).not.toBeNull();
  });
});

describe('Schedule dialogs (Loqzen design system)', () => {
  const text = (e: Element | null) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();

  async function create<T>(type: Type<T>, inputs: Record<string, unknown> = {}) {
    await TestBed.configureTestingModule({
      imports: [type],
      providers: [provideNoopAnimations(), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const f = TestBed.createComponent(type);
    for (const [k, v] of Object.entries(inputs)) {
      f.componentRef.setInput(k, v);
    }
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    return f;
  }

  const primaries = (root: HTMLElement) => root.querySelectorAll('button[variant="primary"]');

  const dialogCases: { name: string; make: () => Promise<{ fixture: ComponentFixture<unknown>; closeSpy: jasmine.Spy; title: string; primary: string | null }> }[] = [
    {
      name: 'time off',
      make: async () => {
        const f = await create(TimeOffRequestModalComponent, { personId: 1, personName: 'Ana Ruiz' });
        const closeSpy = jasmine.createSpy('close');
        f.componentInstance.close.subscribe(closeSpy);
        return { fixture: f as ComponentFixture<unknown>, closeSpy, title: 'Request time off', primary: 'Request time off' };
      },
    },
    {
      name: 'sick report',
      make: async () => {
        const f = await create(SickReportModalComponent, { personId: 1, personName: 'Ana Ruiz' });
        const closeSpy = jasmine.createSpy('close');
        f.componentInstance.close.subscribe(closeSpy);
        return { fixture: f as ComponentFixture<unknown>, closeSpy, title: 'Report sick', primary: 'Report sick' };
      },
    },
    {
      name: 'repeat pattern',
      make: async () => {
        const f = await create(RepeatPatternModalComponent, { personId: 1, personName: 'Ana Ruiz' });
        const closeSpy = jasmine.createSpy('close');
        f.componentInstance.close.subscribe(closeSpy);
        return { fixture: f as ComponentFixture<unknown>, closeSpy, title: 'Repeat shift pattern', primary: 'Create shifts' };
      },
    },
    {
      name: 'shift history',
      make: async () => {
        const f = await create(ShiftHistoryModalComponent, { personId: 1, personName: 'Ana Ruiz', companyId: '' });
        const closeSpy = jasmine.createSpy('close');
        f.componentInstance.close.subscribe(closeSpy);
        return { fixture: f as ComponentFixture<unknown>, closeSpy, title: 'Shift history', primary: 'Close' };
      },
    },
    {
      name: 'conflict',
      make: async () => {
        const f = await create(ScheduleConflictModalComponent, { info: conflictInfo() });
        const closeSpy = jasmine.createSpy('dismiss');
        f.componentInstance.dismiss.subscribe(closeSpy);
        return { fixture: f as ComponentFixture<unknown>, closeSpy, title: 'Schedule conflict', primary: 'Got it' };
      },
    },
  ];

  function conflictInfo(): ScheduleConflictInfo {
    return {
      personName: 'Ana Ruiz',
      requestedStart: new Date(Date.UTC(2026, 10, 2, 7)),
      requestedEnd: new Date(Date.UTC(2026, 10, 2, 15)),
      conflictingShift: { start: new Date(Date.UTC(2026, 10, 2, 6)), end: new Date(Date.UTC(2026, 10, 2, 14)), locationName: 'HQ' },
      violations: [
        { severity: 'error', rule: 'Overlapping shift', detail: 'Overlaps 06:00-14:00' },
        { severity: 'warning', rule: 'Max daily hours', detail: '9h scheduled' },
      ],
    };
  }

  for (const c of dialogCases) {
    describe(c.name, () => {
      it('renders in lz-dialog-frame with the title, no legacy markup and one primary action', async () => {
        const { fixture, title, primary } = await c.make();
        const root = fixture.nativeElement as HTMLElement;
        const frame = root.querySelector('lz-dialog-frame');
        expect(frame).not.toBeNull();
        expect(text(frame!.querySelector('h2'))).toContain(title);
        expect(root.querySelector('.modal-content, .modal-backdrop, .conflict-modal, [class*="bi-"], .bi')).toBeNull();
        expect(primaries(root).length).toBe(1);
        expect(text(primaries(root)[0])).toBe(primary!);
        expect(frame!.hasAttribute('title')).toBeFalse();
      });

      it('is a labelled modal dialog', async () => {
        const { fixture, title } = await c.make();
        const dialog = (fixture.nativeElement as HTMLElement).querySelector('[role="dialog"], [role="alertdialog"]') as HTMLElement;
        expect(dialog).not.toBeNull();
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        const label = (fixture.nativeElement as HTMLElement).querySelector('#' + dialog.getAttribute('aria-labelledby'));
        expect(text(label)).toContain(title);
      });

      it('closes on Escape and on the close button', async () => {
        const { fixture, closeSpy } = await c.make();
        const root = fixture.nativeElement as HTMLElement;
        root.querySelector('lz-dialog-frame')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(closeSpy).toHaveBeenCalledTimes(1);
        (root.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click();
        expect(closeSpy).toHaveBeenCalledTimes(2);
      });

      it('every button and form control is at least 48px tall', async () => {
        const { fixture } = await c.make();
        const root = fixture.nativeElement as HTMLElement;
        const small = Array.from(root.querySelectorAll<HTMLElement>('button, select, input:not([type="checkbox"]):not([type="radio"]), textarea'))
          .filter(e => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 47.5)
          .map(e => e.outerHTML.slice(0, 80));
        expect(small).toEqual([]);
      });
    });
  }

  describe('time off and sick report', () => {
    it('time off shows validation through lz-alert and fields through lz-field', async () => {
      const f = await create(TimeOffRequestModalComponent, { personId: 1, personName: 'Ana Ruiz' });
      const root = f.nativeElement as HTMLElement;
      expect(root.querySelectorAll('lz-field').length).toBeGreaterThanOrEqual(4);
      expect(root.querySelector('select[lzField]')).not.toBeNull();
      f.componentInstance.errorMessage = 'Start and end dates are required';
      f.changeDetectorRef.detectChanges();
      const alert = root.querySelector('lz-alert');
      expect(alert).not.toBeNull();
      expect(alert!.getAttribute('role')).toBe('alert');
      expect(text(alert)).toContain('Start and end dates are required');
    });

    it('sick report keeps its info message and pairs fields with labels', async () => {
      const f = await create(SickReportModalComponent, { personId: 1, personName: 'Ana Ruiz' });
      const root = f.nativeElement as HTMLElement;
      expect(text(root.querySelector('lz-alert'))).toContain('open');
      for (const input of Array.from(root.querySelectorAll('input[id], textarea[id]')) as HTMLElement[]) {
        expect(root.querySelector(`label[for="${input.id}"]`)).withContext(input.id).not.toBeNull();
      }
    });

    it('submitting disables the primary action and states progress', async () => {
      const f = await create(SickReportModalComponent, { personId: 1, personName: 'Ana Ruiz' });
      f.componentInstance.submitting = true;
      f.changeDetectorRef.detectChanges();
      const btn = (f.nativeElement as HTMLElement).querySelector('button[variant="primary"]') as HTMLButtonElement;
      expect(btn.disabled).toBeTrue();
      expect(text(btn)).toContain('Submitting');
    });
  });

  describe('conflict modal', () => {
    it('shows each conflict row as text plus an icon, never colour alone', async () => {
      const f = await create(ScheduleConflictModalComponent, { info: conflictInfo() });
      const root = f.nativeElement as HTMLElement;
      const rows = Array.from(root.querySelectorAll('[data-testid="conflict-row"]'));
      expect(rows.length).toBe(3);
      for (const row of rows) {
        expect(text(row.querySelector('mat-icon')).length).toBeGreaterThan(0);
        expect(text(row).replace(text(row.querySelector('mat-icon')), '').trim().length).toBeGreaterThan(5);
      }
      const icons = rows.map(r => text(r.querySelector('mat-icon')));
      expect(icons.filter(i => i === 'warning').length).toBeGreaterThanOrEqual(2);
      expect(root.querySelector('lz-status-chip')).not.toBeNull();
    });

    it('bulk mode lists skipped shifts with the warning icon', async () => {
      const info = conflictInfo();
      info.bulkSummary = { createdCount: 3, skippedCount: 1, skipped: [{ personName: 'Ana Ruiz', date: new Date(Date.UTC(2026, 10, 3)), reason: 'Overlap' }] };
      const f = await create(ScheduleConflictModalComponent, { info });
      const row = (f.nativeElement as HTMLElement).querySelector('[data-testid="conflict-row"]') as HTMLElement;
      expect(text(row.querySelector('mat-icon'))).toBe('warning');
      expect(text(row)).toContain('Overlap');
    });
  });

  describe('shift history', () => {
    it('renders status as an lz-status-chip with an icon and a label', async () => {
      const f = await create(ShiftHistoryModalComponent, { personId: 1, personName: 'Ana Ruiz', companyId: '' });
      f.componentInstance.loading = false;
      f.componentInstance.errorMessage = '';
      f.componentInstance.historyEntries = [
        { date: new Date(2026, 10, 2), schedules: [], events: [], status: 'missed' },
      ];
      f.componentInstance.dateRange = 'all';
      f.changeDetectorRef.detectChanges();
      const chip = (f.nativeElement as HTMLElement).querySelector('lz-status-chip') as HTMLElement;
      expect(chip).not.toBeNull();
      expect(text(chip)).toContain('Missed');
      expect(chip.querySelector('mat-icon')).not.toBeNull();
      expect(chip.querySelector('[style*="background"]')).toBeNull();
    });

    it('shows load errors in a danger lz-alert', async () => {
      const f = await create(ShiftHistoryModalComponent, { personId: 1, personName: 'Ana Ruiz', companyId: '' });
      const alert = (f.nativeElement as HTMLElement).querySelector('lz-alert');
      expect(alert).not.toBeNull();
      expect(alert!.getAttribute('role')).toBe('alert');
    });
  });

  describe('replacement panel', () => {
    const candidates = [{ personId: 5, name: 'Bo Chen', reasons: ['Available'], score: 90 }];

    it('uses lz-panel and offers labelled Notify and Assign actions', async () => {
      const f = await create(ReplacementPanelComponent, { candidates, loading: false });
      const root = f.nativeElement as HTMLElement;
      expect(root.querySelector('lz-panel')).not.toBeNull();
      expect(root.querySelector('.replacement-panel')).toBeNull();
      const notify = spyOn(f.componentInstance.notify, 'emit');
      const assign = spyOn(f.componentInstance.assign, 'emit');
      const buttons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[];
      const byText = (t: string) => buttons.find(b => text(b).includes(t))!;
      byText('Notify').click();
      byText('Assign').click();
      expect(notify).toHaveBeenCalledWith({ personId: 5, channel: 'push' });
      expect(assign).toHaveBeenCalledWith(5);
      expect(root.querySelectorAll('button[variant="primary"]').length).toBeLessThanOrEqual(1);
    });

    it('closes on Escape and the close button, and states the empty case in lz-empty-state', async () => {
      const f = await create(ReplacementPanelComponent, { candidates: [], loading: false });
      const root = f.nativeElement as HTMLElement;
      const closed = spyOn(f.componentInstance.close, 'emit');
      root.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(closed).toHaveBeenCalledTimes(1);
      (root.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click();
      expect(closed).toHaveBeenCalledTimes(2);
      expect(root.querySelector('lz-empty-state')).not.toBeNull();
    });

    it('shows loading as a status alert', async () => {
      const f = await create(ReplacementPanelComponent, { candidates: [], loading: true });
      const status = (f.nativeElement as HTMLElement).querySelector('lz-alert');
      expect(status).not.toBeNull();
      expect(text(status)).toContain('Finding candidates');
    });
  });
});
