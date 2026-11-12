import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

let nextId = 0;

@Component({
  selector: 'lz-dialog-frame',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block bg-paper text-ink',
    '[attr.title]': 'null',
    '(keydown.escape)': 'onEscape()',
  },
  template: `
    <div class="flex items-start justify-between gap-4 border-b border-line-soft px-6 py-4">
      <div class="min-w-0">
        <h2 [id]="titleId" class="m-0 font-display text-[18px] font-semibold leading-tight">{{ title }}</h2>
        @if (subtitle) {
          <p class="m-0 mt-0.5 text-ink-soft">{{ subtitle }}</p>
        }
      </div>
      @if (closable) {
        <button
          type="button"
          class="-mr-2 inline-flex size-12 shrink-0 items-center justify-center rounded-control bg-transparent text-ink-soft"
          aria-label="Close"
          i18n-aria-label="@@common.close_aria"
          (click)="closed.emit()"
        >
          <mat-icon aria-hidden="true">close</mat-icon>
        </button>
      }
    </div>
    <div class="px-6 py-4"><ng-content /></div>
    <div class="flex flex-wrap items-center justify-end gap-2 px-6 pb-4 empty:hidden">
      <ng-content select="[lzDialogActions]" />
    </div>
  `,
})
export class LzDialogFrameComponent {
  readonly titleId = `lz-dialog-title-${nextId++}`;

  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() closable = true;
  @Output() closed = new EventEmitter<void>();

  onEscape(): void {
    if (this.closable) {
      this.closed.emit();
    }
  }
}
