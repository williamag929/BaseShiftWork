import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LzIconTileComponent, type LzIconTileTone } from '../icon-tile/lz-icon-tile.component';

export type LzTrendTone = 'positive' | 'negative' | 'neutral';

/** One metric card: icon tile, value, label, optional description and a trend pill whose icon carries the judgement (never color alone). */
@Component({
  selector: 'lz-kpi-card',
  standalone: true,
  imports: [MatIconModule, LzIconTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0 flex-col rounded-panel border border-line bg-paper p-4 shadow-card', '[attr.title]': 'null' },
  template: `
    <div class="flex items-center justify-between gap-2">
      <lz-icon-tile [icon]="icon" [tone]="tone" />
      @if (trend) {
        <span
          data-testid="kpi-trend"
          class="inline-flex min-w-0 items-center gap-1 rounded-chip px-2 py-0.5 text-[12px] font-semibold"
          [class.bg-success-bg]="trendTone === 'positive'"
          [class.text-success-ink]="trendTone === 'positive'"
          [class.bg-danger-bg]="trendTone === 'negative'"
          [class.text-danger-ink]="trendTone === 'negative'"
          [class.bg-neutral-bg]="trendTone === 'neutral'"
          [class.text-ink-muted]="trendTone === 'neutral'"
        >
          <mat-icon aria-hidden="true" class="size-4! shrink-0 text-base!">{{ resolvedTrendIcon }}</mat-icon>
          <span class="truncate">{{ trend }}</span>
          @if (trendSrText) {
            <span class="sr-only">{{ trendSrText }}</span>
          }
        </span>
      }
    </div>
    <p class="m-0 mt-3 font-display text-[26px] font-semibold leading-tight tabular-nums text-ink">{{ value }}</p>
    <p class="m-0 mt-0.5 font-semibold text-ink">{{ label }}</p>
    @if (description) {
      <p class="m-0 mt-1 text-[13px] text-ink-soft">{{ description }}</p>
    }
  `,
})
export class LzKpiCardComponent {
  @Input({ required: true }) icon!: string;
  @Input({ required: true }) value!: string;
  @Input({ required: true }) label!: string;
  @Input() description?: string;
  @Input() trend?: string;
  @Input() trendTone: LzTrendTone = 'neutral';
  @Input() tone: LzIconTileTone = 'info';
  /** Overrides the judgement icon, e.g. a direction arrow when the trend is a period-over-period delta. */
  @Input() trendIcon?: string;
  /** Screen-reader sentence for the trend when the visible text is only a number. */
  @Input() trendSrText?: string;

  get resolvedTrendIcon(): string {
    if (this.trendIcon) return this.trendIcon;
    return this.trendTone === 'positive' ? 'check_circle' : this.trendTone === 'negative' ? 'error' : 'info';
  }
}
