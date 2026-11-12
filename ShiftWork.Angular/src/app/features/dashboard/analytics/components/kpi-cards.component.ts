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
  worked: { labelKey: 'analytics.kpi_worked', label: $localize`:@@analytics.kpi_worked:Worked hours`, icon: 'schedule', higherIsBetter: true },
  scheduled: { labelKey: 'analytics.kpi_scheduled', label: $localize`:@@analytics.kpi_scheduled:Scheduled hours`, icon: 'event', higherIsBetter: true },
  onTimePct: { labelKey: 'analytics.kpi_on_time', label: $localize`:@@analytics.kpi_on_time:On-time %`, icon: 'check_circle', higherIsBetter: true },
  openShifts: { labelKey: 'analytics.kpi_open_shifts', label: $localize`:@@analytics.kpi_open_shifts:Open shifts`, icon: 'event_busy', higherIsBetter: false },
};

@Component({
  standalone: false,
  selector: 'app-kpi-cards',
  template: `
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      @for (k of views; track k.key) {
        <lz-kpi-card
          [icon]="k.icon"
          [value]="k.value"
          [label]="k.label"
          [trend]="k.deltaPct !== 0 ? absPct(k.deltaPct) + '%' : noChangeLabel"
          [trendTone]="k.deltaClass === 'flat' ? 'neutral' : k.deltaClass.endsWith('good') ? 'positive' : 'negative'"
          [trendIcon]="k.deltaPct > 0 ? 'arrow_upward' : k.deltaPct < 0 ? 'arrow_downward' : 'trending_flat'"
          [trendSrText]="k.deltaClass === 'flat' ? undefined : k.deltaClass.endsWith('good') ? betterLabel : worseLabel"
        />
      }
    </div>
  `,
})
export class KpiCardsComponent {
  views: KpiView[] = [];
  readonly noChangeLabel = $localize`:@@analytics.no_change:no change`;
  readonly betterLabel = $localize`:@@analytics.delta_better:better than the previous period`;
  readonly worseLabel = $localize`:@@analytics.delta_worse:worse than the previous period`;

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
