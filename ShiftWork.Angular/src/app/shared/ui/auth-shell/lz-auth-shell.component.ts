import { ChangeDetectionStrategy, Component, Input, booleanAttribute } from '@angular/core';

@Component({
  selector: 'lz-auth-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-screen items-center justify-center bg-canvas p-4' },
  template: `
    <div
      class="w-full rounded-panel border border-line bg-paper p-6"
      [class.max-w-md]="!wide"
      [class.max-w-2xl]="wide"
    >
      <p class="font-display text-xl font-semibold text-ink" aria-hidden="true">Loqzen</p>
      <h1 class="mt-4 font-display text-[26px] font-semibold leading-tight">{{ title }}</h1>
      @if (subtitle) {
        <p class="mt-1 text-ink-soft">{{ subtitle }}</p>
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
