import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { ScheduleGridData, ShiftBlock } from 'src/app/core/models/schedule-grid.model';
import { ScheduleGridComponent } from './schedule-grid.component';

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
