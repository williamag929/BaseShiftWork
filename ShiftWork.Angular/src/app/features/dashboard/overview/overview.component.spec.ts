import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { PeopleService } from 'src/app/core/services/people.service';
import { LocationService } from 'src/app/core/services/location.service';
import { ShiftEventService } from 'src/app/core/services/shift-event.service';
import { ScheduleShiftService } from 'src/app/core/services/schedule-shift.service';
import { TimeOffRequestService } from 'src/app/core/services/time-off-request.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import {
  LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzPageHeaderComponent, LzPanelComponent, LzSegmentedComponent,
  LzStatusChipComponent, LzKpiCardComponent, LzIconTileComponent,
} from 'src/app/shared/ui';
import { DashboardOverviewComponent } from './overview.component';

describe('DashboardOverviewComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<DashboardOverviewComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  function utilityColor(cls: string): string {
    const probe = document.createElement('div');
    probe.className = cls;
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    expect(color).not.toBe('rgba(0, 0, 0, 0)');
    return color;
  }

  async function setup(locations: any[] = [{ locationId: 1, name: 'Dock A' }]) {
    await TestBed.configureTestingModule({
      declarations: [DashboardOverviewComponent],
      imports: [
        MatIconModule, LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzPageHeaderComponent, LzPanelComponent, LzSegmentedComponent,
        LzStatusChipComponent, LzKpiCardComponent, LzIconTileComponent,
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideRouter([]),
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'c1', name: 'Acme' } }] }),
        { provide: PeopleService, useValue: { getPeople: () => of([{ personId: 1, name: 'Ana', statusShiftWork: 'OnShift' }]) } },
        { provide: LocationService, useValue: { getLocations: () => of(locations) } },
        { provide: ShiftEventService, useValue: { getShiftEvents: () => of([]) } },
        { provide: ScheduleShiftService, useValue: { getScheduleShifts: () => of([]) } },
        { provide: TimeOffRequestService, useValue: { getTimeOffRequests: () => of([]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardOverviewComponent);
    fixture.detectChanges();
    fixture.detectChanges();
  }

  it('renders exactly one h1, from lz-page-header', async () => {
    await setup();
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')).not.toBeNull();
  });

  it('renders four lz-kpi-card metrics with icon tile, value, label and a trend pill that carries an icon', async () => {
    await setup();
    const cards = Array.from(el().querySelectorAll('[data-testid="kpi-grid"] lz-kpi-card'));
    expect(cards.length).toBe(4);
    expect(el().querySelector('[data-testid="kpi-grid"]')!.textContent).toContain('Active Staff');
    cards.forEach(card => {
      expect(card.querySelector('lz-icon-tile')).not.toBeNull();
      expect(card.querySelector('[data-testid="kpi-trend"] mat-icon')).not.toBeNull();
      expect(getComputedStyle(card).boxShadow).not.toBe('none');
    });
    expect(el().querySelector('mat-card, .kpi-card')).toBeNull();
  });

  it('opens with the navy command band: eyebrow, title and light text on the hero background', async () => {
    await setup();
    const header = el().querySelector('lz-page-header') as HTMLElement;
    expect(getComputedStyle(header).backgroundImage).toContain('gradient');
    expect(header.querySelector('[data-testid="page-eyebrow"]')!.textContent).toContain('Operations command');
    expect(getComputedStyle(header.querySelector('h1')!).color).toBe('rgb(255, 255, 255)');
  });

  it('uses lz-panel for sections, never the old panel class', async () => {
    await setup();
    expect(el().querySelectorAll('lz-panel').length).toBeGreaterThanOrEqual(4);
    expect(el().querySelector('.panel, .overview-hero')).toBeNull();
    expect(el().querySelectorAll('lz-panel .lz-eyebrow').length).toBeGreaterThanOrEqual(4);
  });

  it('has exactly one primary action', async () => {
    await setup();
    const primaries = Array.from(el().querySelectorAll('button[lzButton], a[lzButton]')).filter(
      b => (b as HTMLElement).classList.contains('bg-ink'),
    );
    expect(primaries.length).toBe(1);
  });

  it('range switcher is a labelled group of >=48px toggle buttons with aria-pressed', async () => {
    await setup();
    const group = el().querySelector('[role="group"][aria-label]')!;
    expect(group).not.toBeNull();
    const buttons = Array.from(group.querySelectorAll('button'));
    expect(buttons.map(b => b.textContent!.trim())).toEqual(['24h', '7d', '30d']);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    buttons[1].click();
    fixture.detectChanges();
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
    buttons.forEach(b => expect(b.getBoundingClientRect().height).toBeGreaterThanOrEqual(48));
  });

  it('shows an lz-empty-state when no locations are configured', async () => {
    await setup([]);
    const empty = el().querySelector('lz-empty-state');
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toContain('No locations configured yet.');
  });

  it('location compliance is a token-stroked SVG ring with a text risk chip on a tinted row', async () => {
    await setup();
    const ring = el().querySelector('[data-testid="gps-ring"][role="progressbar"]') as HTMLElement;
    expect(ring).not.toBeNull();
    expect(ring.getAttribute('aria-valuenow')).toBe('100');
    expect(ring.textContent).toContain('100%');
    const arc = ring.querySelectorAll('circle')[1] as SVGCircleElement;
    const probe = document.createElement('div');
    probe.className = 'text-success';
    document.body.appendChild(probe);
    expect(getComputedStyle(arc).stroke).toBe(getComputedStyle(probe).color);
    probe.remove();
    const row = el().querySelector('[data-testid="location-row"]') as HTMLElement;
    expect(row.querySelector('lz-status-chip')!.textContent).toContain('On track');
    expect(getComputedStyle(row).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  it('ringDash fills the r=30 circumference proportionally and clamps', async () => {
    await setup();
    const c = fixture.componentInstance;
    expect(c.ringDash(50)).toBe('94.25 188.50');
    expect(c.ringDash(150)).toBe('188.50 188.50');
    expect(c.ringDash(-5)).toBe('0.00 188.50');
  });

  it('activity chart bars use the link token and an explicit container height', async () => {
    await setup();
    const chart = el().querySelector('[data-testid="activity-chart"]') as HTMLElement;
    expect(chart).not.toBeNull();
    expect(chart.getBoundingClientRect().height).toBeGreaterThanOrEqual(160);
    const bar = chart.querySelector('[data-testid="activity-bar"]') as HTMLElement;
    expect(getComputedStyle(bar).backgroundColor).toBe(utilityColor('bg-link'));
  });

  it('never renders a hex, rgb or gradient in inline styles', async () => {
    await setup();
    const styled = Array.from(el().querySelectorAll('[style]')).map(n => n.getAttribute('style')!);
    styled.forEach(s => expect(s).not.toMatch(/#[0-9a-f]{3,8}|rgb|gradient/i));
  });

  it('range switcher is an lz-segmented whose focus ring is not clipped', async () => {
    await setup();
    const btn = el().querySelector('lz-segmented button') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.focus();
    expect(parseFloat(getComputedStyle(btn).outlineOffset)).toBeLessThanOrEqual(0);
  });

  it('fits a 360px host: no horizontal overflow and every header action is fully visible', async () => {
    await setup();
    const host = fixture.nativeElement as HTMLElement;
    host.style.display = 'block';
    host.style.width = '360px';
    fixture.detectChanges();
    expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
    const right = host.getBoundingClientRect().right;
    const actions = Array.from(el().querySelectorAll('lz-page-header button, lz-page-header lz-segmented, lz-page-header [role="status"]'));
    expect(actions.length).toBeGreaterThanOrEqual(4);
    actions.forEach(a => expect(a.getBoundingClientRect().right).toBeLessThanOrEqual(right + 0.5));
  });
});
