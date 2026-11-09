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
  LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzPageHeaderComponent, LzPanelComponent,
  LzStatusChipComponent, LzSummaryStripComponent,
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
        MatIconModule, LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzPageHeaderComponent, LzPanelComponent,
        LzStatusChipComponent, LzSummaryStripComponent,
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

  it('renders the KPI row as lz-summary-strip with four metrics and no mat-card', async () => {
    await setup();
    const strip = el().querySelector('lz-summary-strip');
    expect(strip).not.toBeNull();
    expect(strip!.textContent).toContain('Active Staff');
    expect(strip!.textContent).toContain('GPS Compliance');
    expect(el().querySelectorAll('lz-summary-strip .tabular-nums').length).toBe(4);
    expect(el().querySelector('mat-card, .kpi-card')).toBeNull();
  });

  it('uses lz-panel for sections, never the old panel class', async () => {
    await setup();
    expect(el().querySelectorAll('lz-panel').length).toBeGreaterThanOrEqual(4);
    expect(el().querySelector('.panel, .overview-hero')).toBeNull();
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

  it('location compliance is a token-colored bar with a text risk chip, not a conic ring', async () => {
    await setup();
    const bar = el().querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
    expect(el().querySelector('lz-status-chip')!.textContent!.trim().length).toBeGreaterThan(0);
    const fill = bar.firstElementChild as HTMLElement;
    expect(getComputedStyle(fill).backgroundColor).toBe(utilityColor('bg-success'));
    expect(fill.style.width).toBe('100%');
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
});
