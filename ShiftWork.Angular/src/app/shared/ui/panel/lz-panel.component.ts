import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'lz-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block rounded-panel border border-line bg-paper' },
  template: `
    @if (heading) {
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
        <h2 class="font-display text-base font-semibold">{{ heading }}</h2>
        <div class="ml-auto flex flex-wrap items-center gap-2">
          <ng-content select="[lzPanelActions]" />
        </div>
      </div>
    } @else {
      <div class="ml-auto flex flex-wrap items-center justify-end gap-2 px-4 pt-3 empty:hidden">
        <ng-content select="[lzPanelActions]" />
      </div>
    }
    <div class="p-4"><ng-content /></div>
  `,
})
export class LzPanelComponent {
  @Input() heading?: string;
}
