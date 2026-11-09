import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideMockStore } from '@ngrx/store/testing';
import { NGX_ECHARTS_CONFIG } from 'ngx-echarts';
import { of } from 'rxjs';
import { AnalyticsService } from 'src/app/core/services/analytics.service';
import { LocationService } from 'src/app/core/services/location.service';
import { AreaService } from 'src/app/core/services/area.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import {
  LzButtonDirective, LzEmptyStateComponent, LzFieldComponent, LzFieldDirective, LzPageHeaderComponent, LzPagerComponent,
  LzPanelComponent, LzSegmentedComponent, LzStatusChipComponent, LzTableDirective, LzTableScrollComponent,
} from 'src/app/shared/ui';
import { AnalyticsComponent } from './analytics.component';
import { KpiCardsComponent } from './components/kpi-cards.component';
import { DrilldownTableComponent } from './components/drilldown-table.component';

describe('AnalyticsComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<AnalyticsComponent>;
  let svc: Record<string, jasmine.Spy>;
  const root = document.documentElement;
  const el = () => fixture.nativeElement as HTMLElement;
  // Karma cannot load the lazy echarts chunk; a no-op chart keeps the directive wired without drawing.
  const fakeChart = new Proxy({}, { get: (_t, key) => (key === 'isDisposed' ? () => false : () => undefined) });
  const overridden = ['--lz-link', '--lz-success', '--lz-amber', '--lz-danger', '--lz-open-border', '--lz-paper', '--lz-ink-soft', '--lz-ink-muted', '--lz-line', '--lz-line-strong'];

  const series = (key: string, ys: number[]) => ({ key, label: key, points: ys.map((y, i) => ({ x: `d${i}`, y })) });
  const drillRow = (i: number, status = 'late') => ({
    day: '2026-11-02', personId: i, personName: `P${i}`, locationId: 1, locationName: 'Dock', scheduledHours: 8, workedHours: 7, varianceHours: i % 2 ? -1 : 1, status,
  });

  function setup(opts: { empty?: boolean; drillTotal?: number } = {}) {
    const resp = (keys: string[]) => of({ series: opts.empty ? [] : keys.map(k => series(k, [1, 2])), totals: {}, dimension: 'day' });
    svc = {
      kpis: jasmine.createSpy('kpis').and.returnValue(of({ kpis: [
        { key: 'worked', value: 120, previousValue: 100, deltaPct: 20, format: 'hours' },
        { key: 'scheduled', value: 130, previousValue: 130, deltaPct: 0, format: 'hours' },
        { key: 'onTimePct', value: 90, previousValue: 95, deltaPct: -5, format: 'percent' },
        { key: 'openShifts', value: 3, previousValue: 1, deltaPct: 200, format: 'count' },
      ] })),
      hoursSummary: jasmine.createSpy('hoursSummary').and.returnValue(resp(['worked', 'scheduled'])),
      attendance: jasmine.createSpy('attendance').and.returnValue(resp(['on-time', 'late', 'no-show'])),
      scheduleCoverage: jasmine.createSpy('scheduleCoverage').and.returnValue(resp(['filled', 'open'])),
      drilldown: jasmine.createSpy('drilldown').and.callFake((_c: string, _f: unknown, _b: unknown, page: number, pageSize: number) =>
        of({ rows: Array.from({ length: Math.min(pageSize, 30) }, (_, i) => drillRow(i + 1, ['on-time', 'late', 'no-show', 'open', 'unscheduled'][i % 5])), total: opts.drillTotal ?? 30, page, pageSize })),
    };
    TestBed.configureTestingModule({
      declarations: [AnalyticsComponent, KpiCardsComponent, DrilldownTableComponent],
      imports: [
        ReactiveFormsModule, MatIconModule, MatMenuModule, LzButtonDirective, LzEmptyStateComponent, LzFieldComponent, LzFieldDirective,
        LzPageHeaderComponent, LzPagerComponent, LzPanelComponent, LzSegmentedComponent, LzStatusChipComponent, LzTableDirective, LzTableScrollComponent,
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideNoopAnimations(),
        { provide: NGX_ECHARTS_CONFIG, useValue: { echarts: { init: () => fakeChart } } },
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'c1' } }] }),
        { provide: AnalyticsService, useValue: svc },
        { provide: LocationService, useValue: { getLocations: () => of([{ locationId: 1, name: 'Dock' }]) } },
        { provide: AreaService, useValue: { getAreas: () => of([{ areaId: 1, name: 'Bay' }]) } },
        { provide: PeopleService, useValue: { getPeople: () => of([{ personId: 1, name: 'Ana' }]) } },
      ],
    });
    fixture = TestBed.createComponent(AnalyticsComponent);
    fixture.detectChanges();
    tick(300);
    fixture.detectChanges();
  }

  afterEach(() => overridden.forEach(t => root.style.removeProperty(t)));

  it('has one h1 from lz-page-header and one primary Export trigger', fakeAsync(() => {
    setup();
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')).not.toBeNull();
    const primaries = Array.from(el().querySelectorAll('button[lzButton]')).filter(b => b.classList.contains('bg-ink'));
    expect(primaries.length).toBe(1);
    expect(primaries[0].textContent).toContain('Export');
  }));

  it('passes token colours to ECharts, read at runtime from the CSS custom properties', fakeAsync(() => {
    root.style.setProperty('--lz-link', 'rgb(10, 20, 30)');
    root.style.setProperty('--lz-success', 'rgb(11, 21, 31)');
    root.style.setProperty('--lz-amber', 'rgb(12, 22, 32)');
    root.style.setProperty('--lz-danger', 'rgb(13, 23, 33)');
    root.style.setProperty('--lz-open-border', 'rgb(14, 24, 34)');
    setup();
    const c = fixture.componentInstance;
    expect((c.hoursOptions as any).color).toEqual(['rgb(10, 20, 30)', 'rgb(11, 21, 31)']);
    expect((c.locationOptions as any).color).toEqual(['rgb(10, 20, 30)']);
    expect((c.attendanceOptions as any).color).toEqual(['rgb(11, 21, 31)', 'rgb(12, 22, 32)', 'rgb(13, 23, 33)']);
    expect((c.coverageOptions as any).color).toEqual(['rgb(10, 20, 30)', 'rgb(14, 24, 34)']);
  }));

  it('has no hard-coded colour left: with every token overridden the options contain no hex at all', fakeAsync(() => {
    ['--lz-link', '--lz-success', '--lz-amber', '--lz-danger', '--lz-open-border', '--lz-paper', '--lz-ink-soft', '--lz-ink-muted', '--lz-line', '--lz-line-strong']
      .forEach((t, i) => root.style.setProperty(t, `rgb(${i + 1}, 1, 1)`));
    setup();
    const c = fixture.componentInstance;
    const json = JSON.stringify([c.hoursOptions, c.locationOptions, c.attendanceOptions, c.coverageOptions]);
    expect(json).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(json).toMatch(/rgb\(/);
  }));

  it('exports PNGs on the paper token, not white hex', fakeAsync(() => {
    root.style.setProperty('--lz-paper', 'rgb(250, 251, 252)');
    setup();
    const inst = { getDataURL: jasmine.createSpy('getDataURL').and.returnValue('data:image/png;base64,') };
    fixture.componentInstance.onChartInit('hours', inst);
    fixture.componentInstance.exportPng('hours');
    expect(inst.getDataURL.calls.mostRecent().args[0].backgroundColor).toBe('rgb(250, 251, 252)');
  }));

  it('gives every chart container an explicit 300px height', fakeAsync(() => {
    setup();
    const charts = Array.from(el().querySelectorAll('[echarts]')) as HTMLElement[];
    expect(charts.length).toBe(4);
    charts.forEach(ch => expect(ch.getBoundingClientRect().height).toBe(300));
  }));

  it('renders KPI tiles as lz-panel with delta direction in text and an accessible better/worse cue', fakeAsync(() => {
    setup();
    const tiles = el().querySelectorAll('app-kpi-cards lz-panel');
    expect(tiles.length).toBe(4);
    expect(tiles[0].textContent).toContain('Worked hours');
    expect(tiles[0].textContent).toContain('120 h');
    expect(tiles[0].querySelector('.sr-only')!.textContent!.trim().length).toBeGreaterThan(0);
    expect(tiles[2].querySelector('.sr-only')!.textContent).not.toBe(tiles[0].querySelector('.sr-only')!.textContent);
    expect(tiles[1].textContent).toContain('no change');
  }));

  it('shows lz-empty-state in each empty chart', fakeAsync(() => {
    setup({ empty: true });
    expect(el().querySelectorAll('.chart-card lz-empty-state, lz-panel lz-empty-state').length).toBe(4);
    expect(el().querySelectorAll('[echarts]').length).toBe(0);
  }));

  it('range presets form a group with aria-pressed; Custom reveals labelled date fields that drive the filter', fakeAsync(() => {
    setup();
    const group = el().querySelector('[role="group"][aria-label]')!;
    const month = Array.from(group.querySelectorAll('button')).find(b => b.textContent!.trim() === 'This month')!;
    expect(month.getAttribute('aria-pressed')).toBe('true');
    expect(el().querySelector('input[type="date"]')).toBeNull();
    (Array.from(group.querySelectorAll('button')).find(b => b.textContent!.trim() === 'Custom') as HTMLButtonElement).click();
    fixture.detectChanges();
    const from = el().querySelector('#analytics-from') as HTMLInputElement;
    const to = el().querySelector('#analytics-to') as HTMLInputElement;
    expect(el().querySelector('label[for="analytics-from"]')).not.toBeNull();
    expect(to).not.toBeNull();
    svc['hoursSummary'].calls.reset();
    from.value = '2026-10-01';
    from.dispatchEvent(new Event('change'));
    tick(300);
    expect(svc['hoursSummary']).toHaveBeenCalled();
    const filter = svc['hoursSummary'].calls.first().args[1];
    expect(new Date(filter.from).getDate()).toBe(1);
    expect(new Date(filter.from).getMonth()).toBe(9);
  }));

  it('group-by buttons are pressed toggles that drive the form', fakeAsync(() => {
    setup();
    const group = el().querySelector('[role="group"][aria-label="Group by"]')!;
    const week = Array.from(group.querySelectorAll('button')).find(b => b.textContent!.trim() === 'Week') as HTMLButtonElement;
    week.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.form.value.groupBy).toBe('week');
    expect(week.getAttribute('aria-pressed')).toBe('true');
    tick(300);
  }));

  it('filter controls are native lzField selects with labels and >=48px height', fakeAsync(() => {
    setup();
    const selects = Array.from(el().querySelectorAll('select[lzField]')) as HTMLSelectElement[];
    expect(selects.length).toBe(3);
    selects.forEach(s => {
      expect(s.id).toBeTruthy();
      expect(el().querySelector(`label[for="${s.id}"]`)).not.toBeNull();
      expect(s.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    });
    expect(el().querySelector('mat-form-field, mat-select')).toBeNull();
  }));

  it('drill-down: table inside lz-table-scroll, text status chips, lz-pager instead of mat-paginator', fakeAsync(() => {
    setup({ drillTotal: 60 });
    fixture.componentInstance.openDrilldown(null);
    tick(300);
    fixture.detectChanges();
    const dd = el().querySelector('app-drilldown-table')!;
    const scroll = dd.querySelector('lz-table-scroll') as HTMLElement;
    expect(scroll.querySelector('table')).not.toBeNull();
    const chips = Array.from(scroll.querySelectorAll('lz-status-chip')).map(c => c.textContent!.trim());
    expect(chips.slice(0, 5)).toEqual(['On time', 'Late', 'No show', 'Open', 'Unscheduled']);
    expect(dd.querySelector('mat-paginator')).toBeNull();
    const pager = dd.querySelector('lz-pager')!;
    expect(pager.textContent).toContain('of 60');
    (pager.querySelector('button[aria-label="Next page"]') as HTMLButtonElement).click();
    tick(300);
    expect(svc['drilldown'].calls.mostRecent().args[3]).toBe(2);
  }));

  it('drill-down empty selection shows lz-empty-state and disables export', fakeAsync(() => {
    setup({ drillTotal: 0 });
    svc['drilldown'].and.returnValue(of({ rows: [], total: 0, page: 1, pageSize: 25 }));
    fixture.componentInstance.openDrilldown('d1');
    tick(300);
    fixture.detectChanges();
    const dd = el().querySelector('app-drilldown-table')!;
    expect(dd.querySelector('lz-empty-state')).not.toBeNull();
    expect((dd.querySelector('button[data-testid="export-csv"]') as HTMLButtonElement).disabled).toBeTrue();
  }));

  it('uses no mat-table, inline hex or legacy card classes', fakeAsync(() => {
    setup({ drillTotal: 5 });
    fixture.componentInstance.openDrilldown(null);
    tick(300);
    fixture.detectChanges();
    expect(el().querySelector('table[mat-table], .kpi-card, .chart-card, .dd-card, .filter-bar')).toBeNull();
    Array.from(el().querySelectorAll('[style]')).forEach(n => expect(n.getAttribute('style')).not.toMatch(/#[0-9a-f]{3,8}|rgb|gradient/i));
  }));

  it('fits a 360px host with the filter panel only sticky from lg up and every filter control reachable', fakeAsync(() => {
    setup();
    const host = fixture.nativeElement as HTMLElement;
    host.style.display = 'block';
    host.style.width = '360px';
    fixture.detectChanges();
    expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
    const panel = el().querySelector('lz-panel[class*="sticky"]') as HTMLElement;
    expect(getComputedStyle(panel).position).toBe(window.innerWidth >= 1024 ? 'sticky' : 'static');
    const hostRight = host.getBoundingClientRect().right;
    el().querySelectorAll('lz-page-header button').forEach(b => expect(b.getBoundingClientRect().right).toBeLessThanOrEqual(hostRight + 0.5));
    el().querySelectorAll('lz-panel select, lz-segmented').forEach(c => expect(c.getBoundingClientRect().right).toBeLessThanOrEqual(hostRight + 0.5));
  }));

  it('preset and group-by toggles are lz-segmented with unclipped focus rings', fakeAsync(() => {
    setup();
    const groups = el().querySelectorAll('lz-segmented');
    expect(groups.length).toBe(2);
    const btn = groups[0].querySelector('button') as HTMLButtonElement;
    btn.focus();
    expect(parseFloat(getComputedStyle(btn).outlineOffset)).toBeLessThanOrEqual(0);
    tick(300);
  }));
});
