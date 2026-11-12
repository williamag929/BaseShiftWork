import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type LzIconTileTone = 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'inverse';
export type LzIconTileSize = 'sm' | 'md' | 'lg';

const TONE: Record<LzIconTileTone, string> = {
  brand: 'bg-navy-900 text-amber',
  info: 'bg-info-bg text-info-ink',
  success: 'bg-success-bg text-success-ink',
  warning: 'bg-(--lz-draft-bg-1) text-amber-ink',
  danger: 'bg-danger-bg text-danger-ink',
  neutral: 'bg-neutral-bg text-ink-muted',
  inverse: 'bg-hero-raised text-paper',
};

const SIZE: Record<LzIconTileSize, string> = {
  sm: 'size-8 [&_mat-icon]:size-[18px]! [&_mat-icon]:text-[18px]!',
  md: 'size-10 [&_mat-icon]:size-6! [&_mat-icon]:text-2xl!',
  lg: 'size-12 [&_mat-icon]:size-[26px]! [&_mat-icon]:text-[26px]!',
};

/** Decorative icon on a tinted square: the reference dashboard's KPI, alert and header marker. */
@Component({
  selector: 'lz-icon-tile',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes', 'aria-hidden': 'true' },
  template: `<mat-icon>{{ icon }}</mat-icon>`,
})
export class LzIconTileComponent {
  @Input({ required: true }) icon!: string;
  @Input() tone: LzIconTileTone = 'info';
  @Input() size: LzIconTileSize = 'sm';

  get classes(): string {
    return `inline-grid shrink-0 place-items-center rounded-control ${SIZE[this.size]} ${TONE[this.tone]}`;
  }
}
