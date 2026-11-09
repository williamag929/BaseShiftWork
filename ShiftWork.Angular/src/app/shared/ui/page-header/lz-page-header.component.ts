import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'lz-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.title]': 'null' },
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <h1 class="font-display text-[26px] font-semibold leading-tight">{{ title }}</h1>
        @if (subtitle) {
          <p class="text-ink-soft">{{ subtitle }}</p>
        }
        <ng-content select="[lzHeaderMeta]" />
      </div>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <ng-content select="[lzHeaderActions]" />
      </div>
    </div>
  `,
})
export class LzPageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
}
