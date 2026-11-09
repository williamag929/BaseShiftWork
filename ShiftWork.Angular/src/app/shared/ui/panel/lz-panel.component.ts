import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'lz-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block rounded-panel border border-line bg-paper', '[attr.title]': 'null' },
  template: `
    <div
      class="flex flex-wrap items-center gap-2"
      [class.px-4]="heading"
      [class.py-3]="heading"
      [class.justify-between]="heading"
      [class.justify-end]="!heading"
      [class.border-b]="heading"
      [class.border-line-soft]="heading"
    >
      @if (heading) {
        <h2 class="font-display text-base font-semibold">{{ heading }}</h2>
      }
      <div class="ml-auto flex flex-wrap items-center gap-2 empty:hidden" [class.px-4]="!heading" [class.pt-3]="!heading">
        <ng-content select="[lzPanelActions]" />
      </div>
    </div>
    <div class="p-4"><ng-content /></div>
  `,
})
export class LzPanelComponent {
  @Input() heading?: string;
}
