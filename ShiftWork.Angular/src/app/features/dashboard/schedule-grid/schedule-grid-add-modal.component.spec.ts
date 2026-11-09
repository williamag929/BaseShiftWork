import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Schedule } from 'src/app/core/models/schedule.model';
import { ScheduleGridAddModalComponent } from './schedule-grid-add-modal.component';

describe('ScheduleGridAddModalComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<ScheduleGridAddModalComponent>;
  const text = (e: Element | null) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const root = () => fixture.nativeElement as HTMLElement;

  async function setup(inputs: Record<string, unknown> = {}) {
    await TestBed.configureTestingModule({
      imports: [ScheduleGridAddModalComponent],
      providers: [provideNoopAnimations(), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(ScheduleGridAddModalComponent);
    fixture.componentRef.setInput('people', [{ personId: 10, name: 'Ana Ruiz' }]);
    fixture.componentRef.setInput('locations', [{ locationId: 1, name: 'HQ' }]);
    for (const [k, v] of Object.entries(inputs)) {
      fixture.componentRef.setInput(k, v);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders inside lz-dialog-frame titled "Add shift" without a native tooltip', async () => {
    await setup();
    const frame = root().querySelector('lz-dialog-frame') as HTMLElement;
    expect(frame).not.toBeNull();
    expect(text(frame.querySelector('h2'))).toBe('Add shift');
    expect(frame.hasAttribute('title')).toBeFalse();
    expect(root().querySelector('.modal-content, .modal-backdrop, .more-btn')).toBeNull();
  });

  it('titles an existing schedule "Edit shift"', async () => {
    const existing = { personId: 10, locationId: 1, areaId: 0, startDate: new Date(Date.UTC(2026, 10, 2, 7)), endDate: new Date(Date.UTC(2026, 10, 2, 15)) } as unknown as Schedule;
    await setup({ existingSchedule: existing });
    expect(text(root().querySelector('lz-dialog-frame h2'))).toBe('Edit shift');
  });

  it('has exactly one primary button and its label states the action', async () => {
    await setup();
    const primaries = root().querySelectorAll('button[variant="primary"]');
    expect(primaries.length).toBe(1);
    expect(text(primaries[0])).toBe('Add shift');
  });

  it('the primary action saves', async () => {
    await setup();
    const save = spyOn(fixture.componentInstance, 'onSave');
    (root().querySelector('button[variant="primary"]') as HTMLButtonElement).click();
    expect(save).toHaveBeenCalled();
  });

  it('Escape closes the dialog', async () => {
    await setup();
    const closed = spyOn(fixture.componentInstance.close, 'emit');
    root().querySelector('lz-dialog-frame')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('labels every field through lz-field with 48px controls', async () => {
    await setup();
    expect(root().querySelectorAll('lz-field').length).toBe(5);
    for (const id of ['person-select', 'location-select', 'area-select']) {
      const control = root().querySelector('#' + id) as HTMLElement;
      expect(control.hasAttribute('lzField')).withContext(id).toBeTrue();
      expect(root().querySelector(`label[for="${id}"]`)).withContext(id).not.toBeNull();
      expect(control.getBoundingClientRect().height).withContext(id).toBeGreaterThanOrEqual(48);
    }
  });

  it('is a labelled modal dialog', async () => {
    await setup();
    const dialog = root().querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(text(root().querySelector('#' + dialog.getAttribute('aria-labelledby')))).toBe('Add shift');
  });

  it('the more-actions menu is a named disclosure that lists every action as a 48px button', async () => {
    await setup();
    const toggle = root().querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-label')).toBe('More actions');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const items = Array.from(root().querySelectorAll('[role="menu"] button[role="menuitem"]')) as HTMLButtonElement[];
    const labels = items.map(i => text(i));
    for (const l of ['Repeat for tomorrow', 'Request time off', 'Report sick', 'Find replacement', 'Delete shift']) {
      expect(labels.some(x => x.includes(l))).withContext(l).toBeTrue();
    }
    for (const i of items) {
      expect(i.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    }
    expect(root().querySelectorAll('button[variant="primary"]').length).toBe(1);
  });

  it('menu items are start-aligned full-width ink buttons and Delete is danger-coloured', async () => {
    await setup();
    (root().querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = Array.from(root().querySelectorAll('[role="menuitem"]')) as HTMLElement[];
    const menu = root().querySelector('[role="menu"]') as HTMLElement;
    const first = items[0];
    expect(getComputedStyle(first).justifyContent).toBe('flex-start');
    expect(first.getBoundingClientRect().width).toBeGreaterThan(menu.getBoundingClientRect().width - 16);
    const del = items.find(i => text(i).includes('Delete shift'))!;
    expect(getComputedStyle(del).color).not.toBe(getComputedStyle(first).color);
  });

  it('specific-days chips show selection with more than colour (pressed state and a heavier border)', async () => {
    await setup();
    (root().querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance.repeatSpecificDays();
    fixture.componentInstance.selectedDayIndices.clear();
    fixture.componentInstance.toggleDayIndex(3);
    fixture.detectChanges();
    const chips = Array.from(root().querySelectorAll('[role="menu"] button[aria-pressed]')) as HTMLElement[];
    expect(chips.length).toBe(7);
    expect(chips[3].getAttribute('aria-pressed')).toBe('true');
    expect(chips[0].getAttribute('aria-pressed')).toBe('false');
    expect(getComputedStyle(chips[3]).borderTopWidth).toBe('2px');
    expect(getComputedStyle(chips[0]).borderTopWidth).toBe('1px');
  });
});
