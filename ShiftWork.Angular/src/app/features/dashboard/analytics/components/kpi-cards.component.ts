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
  standalone: false,
  selector: 'app-kpi-cards',
  template: `
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      @for (k of views; track k.key) {
        <lz-panel>
          <div class="flex items-center gap-2 text-ink-soft">
            <mat-icon aria-hidden="true" class="shrink-0 text-ink-muted">{{ k.icon }}</mat-icon>
            <span class="text-[13px] font-medium">{{ k.label }}</span>
          </div>
          <div class="mt-1 text-[26px] font-semibold tabular-nums">{{ k.value }}</div>
          @if (k.deltaPct !== 0) {
            <div
              class="mt-1 inline-flex items-center gap-1 text-[13px] font-medium"
              [class.text-success-ink]="k.deltaClass === 'up-good' || k.deltaClass === 'down-good'"
              [class.text-danger-ink]="k.deltaClass === 'up-bad' || k.deltaClass === 'down-bad'">
              <mat-icon aria-hidden="true" class="size-4! text-base!">{{ k.deltaPct > 0 ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
              <span>{{ absPct(k.deltaPct) }}%</span>
              <span class="sr-only">
                @if (k.deltaClass === 'up-good' || k.deltaClass === 'down-good') {
                  <ng-container i18n="@@analytics.delta_better">better than the previous period</ng-container>
                } @else {
                  <ng-container i18n="@@analytics.delta_worse">worse than the previous period</ng-container>
                }
              </span>
            </div>
          } @else {
            <div class="mt-1 text-[13px] text-ink-soft">
              <span i18n="@@analytics.no_change">no change</span>
            </div>
          }
        </lz-panel>
      }
    </div>
  `,
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
