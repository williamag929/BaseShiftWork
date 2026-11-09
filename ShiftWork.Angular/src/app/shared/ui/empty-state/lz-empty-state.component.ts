import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'lz-empty-state',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col items-center gap-2 px-4 py-10 text-center' },
  template: `
    <mat-icon aria-hidden="true" class="size-10! text-4xl text-ink-muted">{{ icon }}</mat-icon>
    <h3 class="font-display text-base font-semibold">{{ title }}</h3>
    @if (body) {
      <p class="max-w-md text-ink-soft">{{ body }}</p>
    }
    <div class="mt-2 empty:hidden"><ng-content select="[lzEmptyAction]" /></div>
  `,
})
export class LzEmptyStateComponent {
  @Input({ required: true }) icon!: string;
  @Input({ required: true }) title!: string;
  @Input() body?: string;
}
