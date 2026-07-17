import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Subject, combineLatest, of } from 'rxjs';
import { catchError, debounceTime, filter, switchMap, takeUntil, distinctUntilChanged, startWith } from 'rxjs/operators';
import type { EChartsOption } from 'echarts';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { LocationService } from '../../../core/services/location.service';
import { AreaService } from '../../../core/services/area.service';
import { PeopleService } from '../../../core/services/people.service';
import {
  AnalyticsFilter, AnalyticsGroupBy, AnalyticsKpi, AnalyticsResponse, AnalyticsDrilldownRow,
} from '../../../core/models/analytics.model';
import { AnalyticsPalette } from './analytics-theme';

type ChartId = 'hours' | 'location' | 'attendance' | 'coverage';

@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.css'],
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  companyId = '';

  locations: any[] = [];
  areas: any[] = [];
  people: any[] = [];

  kpis: AnalyticsKpi[] = [];

  hoursOptions: EChartsOption = {};
  locationOptions: EChartsOption = {};
  attendanceOptions: EChartsOption = {};
  coverageOptions: EChartsOption = {};

  loading = { kpis: false, hours: false, location: false, attendance: false, coverage: false };
  empty = { hours: false, location: false, attendance: false, coverage: false };

  drilldown = {
    open: false, bucket: null as string | null,
    rows: [] as AnalyticsDrilldownRow[], total: 0, page: 1, pageSize: 25,
  };

  readonly presets = [
    { key: 'today', labelKey: 'analytics.preset_today' },
    { key: 'week', labelKey: 'analytics.preset_week' },
    { key: 'month', labelKey: 'analytics.preset_month' },
    { key: 'last_month', labelKey: 'analytics.preset_last_month' },
    { key: 'custom', labelKey: 'analytics.preset_custom' },
  ];

  private charts: Partial<Record<ChartId, any>> = {};
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private store: Store,
    private analytics: AnalyticsService,
    private locationService: LocationService,
    private areaService: AreaService,
    private peopleService: PeopleService,
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    this.form = this.fb.group({
      preset: ['month'],
      from: [monthStart],
      to: [now],
      locationId: [null],
      areaId: [null],
      personId: [null],
      groupBy: ['day' as AnalyticsGroupBy],
    });

    this.store.select(selectActiveCompany).pipe(
      filter((c) => !!c),
      takeUntil(this.destroy$),
    ).subscribe((company: any) => {
      this.companyId = company.companyId;
      this.loadDimensions();
    });

    // Filters auto-apply: any change → debounced refetch of everything.
    this.form.valueChanges.pipe(
      startWith(this.form.value),
      debounceTime(250),
      distinctUntilChanged((a, b) => JSON.stringify(this.toFilter(a)) === JSON.stringify(this.toFilter(b))),
      filter(() => !!this.companyId),
      takeUntil(this.destroy$),
    ).subscribe(() => this.refresh());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Preset handling ──────────────────────────────────────────────────────
  onPreset(key: string): void {
    const now = new Date();
    let from = this.form.value.from, to: Date = now;
    switch (key) {
      case 'today': from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); to = now; break;
      case 'week': { const d = now.getDay(); const monday = new Date(now); monday.setDate(now.getDate() - ((d + 6) % 7)); from = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()); to = now; break; }
      case 'month': from = new Date(now.getFullYear(), now.getMonth(), 1); to = now; break;
      case 'last_month': from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0); break;
      case 'custom': return this.form.patchValue({ preset: 'custom' }, { emitEvent: false });
    }
    this.form.patchValue({ preset: key, from, to });
  }

  get isCustom(): boolean { return this.form?.value.preset === 'custom'; }

  private loadDimensions(): void {
    this.locationService.getLocations(this.companyId).pipe(catchError(() => of([]))).subscribe((l) => (this.locations = l ?? []));
    this.areaService.getAreas(this.companyId).pipe(catchError(() => of([]))).subscribe((a: any) => (this.areas = a ?? []));
    this.peopleService.getPeople(this.companyId, 1, 500).pipe(catchError(() => of([]))).subscribe((p: any) => (this.people = p ?? []));
  }

  private toFilter(v = this.form.value): AnalyticsFilter {
    return {
      from: this.iso(v.from),
      to: this.iso(v.to, true),
      locationId: v.locationId ?? undefined,
      areaId: v.areaId ?? undefined,
      personId: v.personId ?? undefined,
      groupBy: v.groupBy,
    };
  }

  private iso(d: Date | string, endOfDay = false): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate(), endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
    return day.toISOString();
  }

  // ── Data refresh ─────────────────────────────────────────────────────────
  private refresh(): void {
    const f = this.toFilter();
    this.closeDrilldown();

    this.loading.kpis = true;
    this.analytics.kpis(this.companyId, f).pipe(catchError(() => of({ kpis: [] })), takeUntil(this.destroy$))
      .subscribe((r) => { this.kpis = r.kpis; this.loading.kpis = false; });

    this.fetchChart('hours', this.analytics.hoursSummary(this.companyId, f), (r) => this.buildHours(r));
    this.fetchChart('location', this.analytics.hoursSummary(this.companyId, { ...f, groupBy: 'location' }), (r) => this.buildLocation(r));
    this.fetchChart('attendance', this.analytics.attendance(this.companyId, f), (r) => this.buildAttendance(r));
    this.fetchChart('coverage', this.analytics.scheduleCoverage(this.companyId, { ...f, groupBy: 'location' }), (r) => this.buildCoverage(r));
  }

  private fetchChart(id: ChartId, obs: any, build: (r: AnalyticsResponse) => EChartsOption): void {
    this.loading[id] = true;
    obs.pipe(catchError(() => of({ series: [], totals: {}, dimension: 'day' } as AnalyticsResponse)), takeUntil(this.destroy$))
      .subscribe((r: AnalyticsResponse) => {
        const total = r.series.reduce((s, ser) => s + ser.points.reduce((a, p) => a + p.y, 0), 0);
        this.empty[id] = total === 0 || r.series.length === 0;
        (this as any)[`${id}Options`] = build(r);
        this.loading[id] = false;
      });
  }

  // ── Chart option builders ────────────────────────────────────────────────
  private axisBase(categories: string[]): any {
    return {
      grid: { top: 48, right: 16, bottom: 40, left: 52, containLabel: true },
      tooltip: { trigger: 'axis' },
      legend: { top: 8, icon: 'roundRect', itemWidth: 12, itemHeight: 12, textStyle: { color: AnalyticsPalette.inkSecondary } },
      xAxis: { type: 'category', data: categories, axisLine: { lineStyle: { color: AnalyticsPalette.axis } }, axisLabel: { color: AnalyticsPalette.muted } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: AnalyticsPalette.gridline } }, axisLabel: { color: AnalyticsPalette.muted } },
    };
  }

  private buildHours(r: AnalyticsResponse): EChartsOption {
    const cats = this.unionX(r);
    const worked = r.series.find((s) => s.key === 'worked');
    const scheduled = r.series.find((s) => s.key === 'scheduled');
    return {
      ...this.axisBase(cats),
      color: [AnalyticsPalette.seriesBlue, AnalyticsPalette.seriesGreen],
      series: [
        { name: $localize`:@@analytics.series_worked:Worked`, type: 'line', smooth: false, symbolSize: 7, lineStyle: { width: 2 }, areaStyle: { opacity: 0.08 }, data: this.align(cats, worked) },
        { name: $localize`:@@analytics.series_scheduled:Scheduled`, type: 'line', smooth: false, symbolSize: 7, lineStyle: { width: 2, type: 'dashed' }, data: this.align(cats, scheduled) },
      ],
    };
  }

  private buildLocation(r: AnalyticsResponse): EChartsOption {
    const worked = r.series.find((s) => s.key === 'worked');
    const points = [...(worked?.points ?? [])].sort((a, b) => a.y - b.y);
    return {
      grid: { top: 24, right: 24, bottom: 24, left: 8, containLabel: true },
      tooltip: { trigger: 'item' },
      color: [AnalyticsPalette.seriesBlue],
      xAxis: { type: 'value', splitLine: { lineStyle: { color: AnalyticsPalette.gridline } }, axisLabel: { color: AnalyticsPalette.muted } },
      yAxis: { type: 'category', data: points.map((p) => p.x), axisLine: { lineStyle: { color: AnalyticsPalette.axis } }, axisLabel: { color: AnalyticsPalette.muted } },
      series: [{ name: $localize`:@@analytics.series_worked:Worked`, type: 'bar', barMaxWidth: 22, itemStyle: { borderRadius: [0, 4, 4, 0] }, data: points.map((p) => p.y) }],
    };
  }

  private buildAttendance(r: AnalyticsResponse): EChartsOption {
    const cats = this.unionX(r);
    const map: Record<string, string> = { 'on-time': AnalyticsPalette.statusGood, late: AnalyticsPalette.statusWarning, 'no-show': AnalyticsPalette.statusCritical };
    const labels: Record<string, string> = {
      'on-time': $localize`:@@analytics.status_on_time:On time`,
      late: $localize`:@@analytics.status_late:Late`,
      'no-show': $localize`:@@analytics.status_no_show:No show`,
    };
    return {
      ...this.axisBase(cats),
      color: r.series.map((s) => map[s.key] ?? AnalyticsPalette.muted),
      series: r.series.map((s) => ({
        name: labels[s.key] ?? s.label, type: 'bar', stack: 'att', barMaxWidth: 28,
        itemStyle: { borderColor: '#fff', borderWidth: 1 }, data: this.align(cats, s),
      })),
    };
  }

  private buildCoverage(r: AnalyticsResponse): EChartsOption {
    const cats = this.unionX(r);
    return {
      ...this.axisBase(cats),
      color: [AnalyticsPalette.seriesBlue, AnalyticsPalette.coverageOpen],
      series: [
        { name: $localize`:@@analytics.series_filled:Filled`, type: 'bar', stack: 'cov', barMaxWidth: 28, itemStyle: { borderColor: '#fff', borderWidth: 1 }, data: this.align(cats, r.series.find((s) => s.key === 'filled')) },
        { name: $localize`:@@analytics.series_open:Open`, type: 'bar', stack: 'cov', barMaxWidth: 28, itemStyle: { borderColor: '#fff', borderWidth: 1 }, data: this.align(cats, r.series.find((s) => s.key === 'open')) },
      ],
    };
  }

  private unionX(r: AnalyticsResponse): string[] {
    const set = new Set<string>();
    r.series.forEach((s) => s.points.forEach((p) => set.add(p.x)));
    return Array.from(set);
  }

  private align(cats: string[], series?: { points: { x: string; y: number }[] }): number[] {
    const m = new Map((series?.points ?? []).map((p) => [p.x, p.y]));
    return cats.map((c) => m.get(c) ?? 0);
  }

  // ── Chart interaction ────────────────────────────────────────────────────
  onChartInit(id: ChartId, instance: any): void { this.charts[id] = instance; }

  onChartClick(event: any): void {
    const bucket = event?.name;
    if (bucket) this.openDrilldown(bucket);
  }

  openDrilldown(bucket: string | null): void {
    this.drilldown.open = true;
    this.drilldown.bucket = bucket;
    this.drilldown.page = 1;
    this.loadDrilldown();
  }

  closeDrilldown(): void {
    this.drilldown.open = false;
    this.drilldown.bucket = null;
    this.drilldown.rows = [];
    this.drilldown.total = 0;
  }

  onDrilldownPage(e: { page: number; pageSize: number }): void {
    this.drilldown.page = e.page;
    this.drilldown.pageSize = e.pageSize;
    this.loadDrilldown();
  }

  private loadDrilldown(): void {
    this.analytics.drilldown(this.companyId, this.toFilter(), this.drilldown.bucket, this.drilldown.page, this.drilldown.pageSize)
      .pipe(catchError(() => of({ rows: [], total: 0, page: 1, pageSize: this.drilldown.pageSize })), takeUntil(this.destroy$))
      .subscribe((r) => { this.drilldown.rows = r.rows; this.drilldown.total = r.total; });
  }

  // ── Export ───────────────────────────────────────────────────────────────
  exportPng(id: ChartId): void {
    const inst = this.charts[id];
    if (!inst) return;
    const url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
    this.download(url, `analytics-${id}.png`);
  }

  exportDrilldownCsv(): void {
    this.analytics.drilldown(this.companyId, this.toFilter(), this.drilldown.bucket, 1, 1000)
      .pipe(catchError(() => of({ rows: [], total: 0, page: 1, pageSize: 1000 })), takeUntil(this.destroy$))
      .subscribe((r) => {
        const header = ['Day', 'Person', 'Location', 'Scheduled Hours', 'Worked Hours', 'Variance Hours', 'Status'];
        const lines = r.rows.map((row) => [
          new Date(row.day).toISOString().slice(0, 10),
          this.csv(row.personName), this.csv(row.locationName),
          row.scheduledHours, row.workedHours, row.varianceHours, row.status,
        ].join(','));
        const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
        this.download(URL.createObjectURL(blob), 'analytics-drilldown.csv');
      });
  }

  private csv(v: string): string {
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }

  private download(url: string, name: string): void {
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    if (url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
