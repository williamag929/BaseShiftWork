import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'lz-empty-state',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex flex-col items-center gap-2 rounded-panel border border-line bg-paper px-4 py-10 text-center shadow-card in-[lz-panel]:border-0 in-[lz-panel]:shadow-none in-[lz-side-panel]:border-0 in-[lz-side-panel]:shadow-none in-[lz-dialog-frame]:border-0 in-[lz-dialog-frame]:shadow-none in-[lz-table-scroll]:border-0 in-[lz-table-scroll]:shadow-none',
    '[attr.title]': 'null',
  },
  template: `
    <span aria-hidden="true" class="mb-1 inline-grid size-14 place-items-center rounded-full bg-neutral-bg text-ink-muted">
      <mat-icon class="size-[26px]! text-[26px]!">{{ icon }}</mat-icon>
    </span>
    <h3 class="m-0 font-display text-[15px] font-semibold">{{ title }}</h3>
    @if (body) {
      <p class="m-0 max-w-md text-ink-soft">{{ body }}</p>
    }
    <div class="mt-2 empty:hidden"><ng-content select="[lzEmptyAction]" /></div>
  `,
})
export class LzEmptyStateComponent {
  @Input({ required: true }) icon!: string;
  @Input({ required: true }) title!: string;
  @Input() body?: string;
}
