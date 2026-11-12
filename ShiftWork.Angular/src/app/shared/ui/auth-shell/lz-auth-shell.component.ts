import { ChangeDetectionStrategy, Component, Input, booleanAttribute } from '@angular/core';
import { LzIconTileComponent } from '../icon-tile/lz-icon-tile.component';

@Component({
  selector: 'lz-auth-shell',
  standalone: true,
  imports: [LzIconTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-screen items-center justify-center bg-canvas p-4', '[attr.title]': 'null' },
  template: `
    <div
      class="w-full rounded-panel border border-line bg-paper p-6 shadow-card sm:p-8"
      [class.max-w-md]="!wide"
      [class.max-w-2xl]="wide"
    >
      <p class="m-0 flex items-center gap-2 font-display text-[18px] font-semibold text-ink" aria-hidden="true">
        <lz-icon-tile icon="schedule" tone="brand" />
        Loqzen
      </p>
      <h1 class="m-0 mt-6 font-display text-[26px] font-semibold leading-tight">{{ title }}</h1>
      @if (subtitle) {
        <p class="m-0 mt-1 text-ink-soft">{{ subtitle }}</p>
      }
      <div class="mt-4"><ng-content /></div>
    </div>
  `,
})
export class LzAuthShellComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input({ transform: booleanAttribute }) wide = false;
}
