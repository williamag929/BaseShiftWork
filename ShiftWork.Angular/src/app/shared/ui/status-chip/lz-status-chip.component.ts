import { ChangeDetectionStrategy, Component, Input, booleanAttribute } from '@angular/core';

export type LzTone = 'success' | 'neutral' | 'warning' | 'danger' | 'info';

@Component({
  selector: 'lz-status-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-chip px-2.5 py-0.5 text-[12px] font-semibold"
      [class.bg-success-bg]="tone === 'success'"
      [class.text-success-ink]="tone === 'success'"
      [class.bg-neutral-bg]="tone === 'neutral'"
      [class.text-ink-muted]="tone === 'neutral'"
      [class.bg-[var(--lz-draft-bg-1)]]="tone === 'warning'"
      [class.text-amber-ink]="tone === 'warning'"
      [class.bg-danger-bg]="tone === 'danger'"
      [class.text-danger-ink]="tone === 'danger'"
      [class.bg-info-bg]="tone === 'info'"
      [class.text-info-ink]="tone === 'info'"
    >
      @if (dot) {
        <span
          aria-hidden="true"
          class="inline-block size-2 rounded-full"
          [class.bg-success]="tone === 'success'"
          [class.bg-ink-muted]="tone === 'neutral'"
          [class.bg-amber]="tone === 'warning'"
          [class.bg-danger]="tone === 'danger'"
          [class.bg-info-ink]="tone === 'info'"
        ></span>
      }
      <ng-content />
    </span>
  `,
})
export class LzStatusChipComponent {
  @Input() tone: LzTone = 'neutral';
  @Input({ transform: booleanAttribute }) dot = false;
}
