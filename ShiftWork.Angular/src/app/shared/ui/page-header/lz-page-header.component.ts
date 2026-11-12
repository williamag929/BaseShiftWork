import { ChangeDetectionStrategy, Component, InjectionToken, Input, Signal, inject } from '@angular/core';
import { LzIconTileComponent } from '../icon-tile/lz-icon-tile.component';

export interface LzPageContext {
  eyebrow: string;
  icon: string;
}

/**
 * Provided by an app shell (the dashboard) so every routed page header shows its nav section and icon
 * without each screen repeating them; explicit `eyebrow` / `icon` inputs win.
 */
export const LZ_PAGE_CONTEXT = new InjectionToken<Signal<LzPageContext | null>>('LZ_PAGE_CONTEXT');

export type LzPageHeaderVariant = 'card' | 'hero';

@Component({
  selector: 'lz-page-header',
  standalone: true,
  imports: [LzIconTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.title]': 'null',
    '[class]': 'hostClasses',
  },
  template: `
    <div class="relative flex flex-wrap items-center justify-between gap-4">
      <div class="flex min-w-0 items-start gap-4">
        @if (resolvedIcon) {
          <lz-icon-tile class="hidden sm:inline-grid" [icon]="resolvedIcon" [tone]="variant === 'hero' ? 'inverse' : 'brand'" size="lg" />
        }
        <div class="min-w-0">
          @if (resolvedEyebrow) {
            <p data-testid="page-eyebrow" class="lz-eyebrow m-0 mb-1" [class.text-ink-soft]="variant === 'card'" [class.text-rail-label]="variant === 'hero'">{{ resolvedEyebrow }}</p>
          }
          <h1 class="m-0 font-display text-[26px] font-semibold leading-tight">{{ title }}</h1>
          @if (subtitle) {
            <p class="m-0 mt-1" [class.text-ink-soft]="variant === 'card'" [class.text-rail-text]="variant === 'hero'">{{ subtitle }}</p>
          }
          <ng-content select="[lzHeaderMeta]" />
        </div>
      </div>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <ng-content select="[lzHeaderActions]" />
      </div>
    </div>
  `,
})
export class LzPageHeaderComponent {
  private readonly context = inject(LZ_PAGE_CONTEXT, { optional: true });

  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() eyebrow?: string;
  @Input() icon?: string;
  @Input() variant: LzPageHeaderVariant = 'card';

  get resolvedEyebrow(): string | undefined {
    return this.eyebrow ?? this.context?.()?.eyebrow;
  }

  get resolvedIcon(): string | undefined {
    return this.icon ?? this.context?.()?.icon;
  }

  get hostClasses(): string {
    return this.variant === 'hero'
      ? 'block overflow-hidden rounded-panel bg-hero p-6 text-paper shadow-card'
      : 'block rounded-panel border border-line bg-paper px-6 py-5 text-ink shadow-card';
  }
}
