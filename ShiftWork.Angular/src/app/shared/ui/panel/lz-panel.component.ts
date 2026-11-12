import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'lz-panel',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'block min-w-0 rounded-panel border border-line bg-paper shadow-card [&_lz-table-scroll]:shadow-none [&_lz-kpi-card]:shadow-none',
    '[attr.title]': 'null',
  },
  template: `
    <div
      class="flex flex-wrap items-center gap-x-3 gap-y-2"
      [class.px-5]="heading"
      [class.py-4]="heading"
      [class.justify-between]="heading"
      [class.justify-end]="!heading"
      [class.border-b]="heading"
      [class.border-line-soft]="heading"
    >
      @if (heading) {
        <div class="flex min-w-0 items-center gap-3">
          @if (icon) {
            <mat-icon aria-hidden="true" class="shrink-0 text-link">{{ icon }}</mat-icon>
          }
          <div class="min-w-0">
            @if (eyebrow) {
              <p class="lz-eyebrow m-0 mb-0.5 text-ink-soft">{{ eyebrow }}</p>
            }
            <h2 class="m-0 font-display text-[18px] font-semibold leading-snug">{{ heading }}</h2>
          </div>
        </div>
      }
      <div class="ml-auto flex flex-wrap items-center gap-2 empty:hidden" [class.px-5]="!heading" [class.pt-4]="!heading">
        <ng-content select="[lzPanelActions]" />
      </div>
    </div>
    <div class="p-5"><ng-content /></div>
  `,
})
export class LzPanelComponent {
  @Input() heading?: string;
  @Input() eyebrow?: string;
  @Input() icon?: string;
}
