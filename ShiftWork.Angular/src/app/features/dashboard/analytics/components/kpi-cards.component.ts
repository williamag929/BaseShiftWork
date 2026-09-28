import { Component, Input } from '@angular/core';
import { AnalyticsKpi } from '../../../../core/models/analytics.model';

interface KpiView {
  key: string;
  labelKey: string;
  label: string;
  value: string;
  deltaPct: number;
  deltaClass: 'up-good' | 'up-bad' | 'down-good' | 'down-bad' | 'flat';
  icon: string;
}

const META: Record<string, { labelKey: string; label: string; icon: string; higherIsBetter: boolean }> = {
  worked: { labelKey: 'analytics.kpi_worked', label: 'Worked hours', icon: 'schedule', higherIsBetter: true },
  scheduled: { labelKey: 'analytics.kpi_scheduled', label: 'Scheduled hours', icon: 'event', higherIsBetter: true },
  onTimePct: { labelKey: 'analytics.kpi_on_time', label: 'On-time %', icon: 'check_circle', higherIsBetter: true },
  openShifts: { labelKey: 'analytics.kpi_open_shifts', label: 'Open shifts', icon: 'event_busy', higherIsBetter: false },
};

@Component({
  selector: 'app-kpi-cards',
  template: `
    <div class="kpi-row">
      <div class="kpi-card" *ngFor="let k of views; trackBy: trackByKey">
        <div class="kpi-head">
          <mat-icon class="kpi-icon">{{ k.icon }}</mat-icon>
          <span class="kpi-label">{{ k.label }}</span>
        </div>
        <div class="kpi-value">{{ k.value }}</div>
        <div class="kpi-delta" [ngClass]="k.deltaClass" *ngIf="k.deltaPct !== 0">
          <mat-icon class="delta-icon">{{ k.deltaPct > 0 ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
          <span>{{ absPct(k.deltaPct) }}%</span>
        </div>
        <div class="kpi-delta flat" *ngIf="k.deltaPct === 0">
          <span i18n="@@analytics.no_change">no change</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    @media (max-width: 900px) { .kpi-row { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 520px) { .kpi-row { grid-template-columns: 1fr; } }
    .kpi-card {
      background: #fff; border: 1px solid rgba(11,11,11,0.08); border-radius: 14px;
      padding: 16px 18px; display: flex; flex-direction: column; gap: 6px;
    }
    .kpi-head { display: flex; align-items: center; gap: 8px; color: #52514e; }
    .kpi-icon { font-size: 18px; width: 18px; height: 18px; color: #898781; }
    .kpi-label { font-size: 13px; font-weight: 500; }
    .kpi-value { font-size: 30px; font-weight: 700; letter-spacing: -0.5px; color: #0b0b0b; }
    .kpi-delta { display: inline-flex; align-items: center; gap: 2px; font-size: 13px; font-weight: 600; width: fit-content; }
    .delta-icon { font-size: 15px; width: 15px; height: 15px; }
    .kpi-delta.up-good, .kpi-delta.down-good { color: #0ca30c; }
    .kpi-delta.up-bad, .kpi-delta.down-bad { color: #d03b3b; }
    .kpi-delta.flat { color: #898781; font-weight: 500; }
  `],
})
export class KpiCardsComponent {
  views: KpiView[] = [];

  @Input() set kpis(value: AnalyticsKpi[] | null) {
    this.views = (value ?? []).map((k) => this.toView(k));
  }

  private toView(k: AnalyticsKpi): KpiView {
    const meta = META[k.key] ?? { labelKey: 'analytics.kpi_' + k.key, label: k.key, icon: 'insights', higherIsBetter: true };
    const up = k.deltaPct > 0;
    const good = meta.higherIsBetter ? up : !up;
    const deltaClass = k.deltaPct === 0 ? 'flat' : ((up ? 'up' : 'down') + (good ? '-good' : '-bad')) as KpiView['deltaClass'];
    return {
      key: k.key,
      labelKey: meta.labelKey,
      label: meta.label,
      value: this.format(k.value, k.format),
      deltaPct: k.deltaPct,
      deltaClass,
      icon: meta.icon,
    };
  }

  private format(value: number, format: string): string {
    if (format === 'percent') return `${Math.round(value)}%`;
    if (format === 'hours') return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} h`;
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  absPct(v: number): string {
    return Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 1 });
  }

  trackByKey(_: number, k: KpiView) {
    return k.key;
  }
}
