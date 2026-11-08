import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, booleanAttribute } from '@angular/core';

export interface LzSummaryItem {
  id: string;
  count: number;
  label: string;
  tone: 'draft' | 'open' | 'danger' | 'neutral' | 'timeOff';
}

@Component({
  selector: 'lz-summary-strip',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-stretch">
      @for (item of items; track item.id) {
        @if (interactive) {
          <button type="button" class="flex min-h-12 items-center gap-2 border border-transparent border-r-line-soft bg-transparent px-4 text-left font-[inherit] text-inherit" (click)="itemSelect.emit(item.id)">
            <ng-container *ngTemplateOutlet="content; context: { $implicit: item }" />
          </button>
        } @else {
          <div class="flex min-h-12 items-center gap-2 border border-transparent border-r-line-soft bg-transparent px-4 text-left font-[inherit] text-inherit">
            <ng-container *ngTemplateOutlet="content; context: { $implicit: item }" />
          </div>
        }
      }
      <ng-content />
    </div>
    <ng-template #content let-item>
        <span
          aria-hidden="true"
          class="inline-block size-[18px] shrink-0 rounded-control"
          [class.bg-draft-hatch]="item.tone === 'draft'"
          [class.border]="item.tone === 'draft' || item.tone === 'neutral' || item.tone === 'timeOff'"
          [class.border-dashed]="item.tone === 'draft' || item.tone === 'open'"
          [class.border-draft-border]="item.tone === 'draft'"
          [class.bg-paper]="item.tone === 'open' || item.tone === 'danger'"
          [class.border-[1.5px]]="item.tone === 'open' || item.tone === 'danger'"
          [class.border-open-border]="item.tone === 'open'"
          [class.border-danger]="item.tone === 'danger'"
          [class.bg-neutral-bg]="item.tone === 'neutral'"
          [class.border-transparent]="item.tone === 'neutral' || item.tone === 'timeOff'"
          [class.bg-timeoff-bg]="item.tone === 'timeOff'"
        ></span>
        <span class="text-[15px] font-bold tabular-nums">{{ item.count }}</span>
        <span class="text-ink-soft">{{ item.label }}</span>
    </ng-template>
  `,
})
export class LzSummaryStripComponent {
  @Input() items: LzSummaryItem[] = [];
  @Input({ transform: booleanAttribute }) interactive = true;
  @Output() itemSelect = new EventEmitter<string>();
}
