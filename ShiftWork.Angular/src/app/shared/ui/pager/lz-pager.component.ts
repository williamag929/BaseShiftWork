import { formatNumber } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, LOCALE_ID, Output, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LzButtonDirective } from '../button/lz-button.directive';
import { LzFieldDirective } from '../field/lz-field.directive';

@Component({
  selector: 'lz-pager',
  standalone: true,
  imports: [MatIconModule, LzButtonDirective, LzFieldDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (visible) {
      <div class="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 py-2">
        <label class="flex items-center gap-2 text-ink-soft">
          <span i18n="@@ui.pager.rows_per_page">Rows per page</span>
          <select lzField class="w-24!" [value]="pageSize" (change)="onSize($event)">
            @for (size of pageSizes; track size) {
              <option [value]="size" [selected]="size === pageSize">{{ size }}</option>
            }
          </select>
        </label>
        <span class="tabular-nums text-ink-soft" aria-live="polite">{{ rangeLabel }}</span>
        <div class="flex items-center gap-1">
          <button
            lzButton
            variant="secondary"
            iconOnly
            type="button"
            aria-label="Previous page"
            i18n-aria-label="@@ui.pager.previous"
            [disabled]="page <= 1"
            (click)="pageChange.emit(page - 1)"
          >
            <mat-icon aria-hidden="true">chevron_left</mat-icon>
          </button>
          <button
            lzButton
            variant="secondary"
            iconOnly
            type="button"
            aria-label="Next page"
            i18n-aria-label="@@ui.pager.next"
            [disabled]="page >= lastPage"
            (click)="pageChange.emit(page + 1)"
          >
            <mat-icon aria-hidden="true">chevron_right</mat-icon>
          </button>
        </div>
      </div>
    }
  `,
})
export class LzPagerComponent {
  private readonly locale = inject(LOCALE_ID);

  @Input({ required: true }) total!: number;
  @Input() page = 1;
  @Input() pageSize = 25;
  @Input() pageSizes: number[] = [25, 50, 100];
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  get visible(): boolean {
    return this.total > Math.min(...this.pageSizes);
  }

  get lastPage(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get rangeLabel(): string {
    const from = formatNumber((this.page - 1) * this.pageSize + 1, this.locale, '1.0-0');
    const to = formatNumber(Math.min(this.page * this.pageSize, this.total), this.locale, '1.0-0');
    const total = formatNumber(this.total, this.locale, '1.0-0');
    return $localize`:@@ui.pager.range:${from}:from:–${to}:to: of ${total}:total:`;
  }

  onSize(event: Event): void {
    this.pageSizeChange.emit(Number((event.target as HTMLSelectElement).value));
  }
}
