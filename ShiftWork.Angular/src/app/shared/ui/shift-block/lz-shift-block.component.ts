import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, booleanAttribute } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LzShiftStatus } from './shift-status';

@Component({
  selector: 'lz-shift-block',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block' },
  template: `
    @if (status === 'timeOff') {
      <div
        class="flex min-h-12 w-full items-center gap-1 rounded-control bg-timeoff-bg px-2 py-1 text-left text-[13px]"
        [class.ring-2]="selected"
        [class.ring-link]="selected"
      >
        <span class="font-medium">{{ time }}</span>
        @if (detail) {
          <span class="truncate text-ink-soft">{{ detail }}</span>
        }
      </div>
    } @else {
      <button
        type="button"
        class="flex min-h-12 w-full items-center gap-1 rounded-control px-2 py-1 text-left font-[inherit] text-[13px] text-inherit"
        [class.bg-shift-bg]="status === 'published' || status === 'locked'"
        [class.border]="status === 'published' || status === 'locked' || status === 'draft'"
        [class.border-shift-border]="status === 'published' || status === 'locked'"
        [class.bg-draft-hatch]="status === 'draft'"
        [class.border-dashed]="status === 'draft' || status === 'open'"
        [class.border-draft-border]="status === 'draft'"
        [class.text-amber-ink]="status === 'draft'"
        [class.bg-paper]="status === 'open' || status === 'conflict'"
        [class.border-[1.5px]]="status === 'open' || status === 'conflict'"
        [class.border-open-border]="status === 'open'"
        [class.border-danger]="status === 'conflict'"
        [class.bg-neutral-bg]="status === 'void'"
        [class.border-transparent]="status === 'void'"
        [class.text-ink-soft]="status === 'void'"
        [class.line-through]="status === 'void'"
        [class.ring-2]="selected"
        [class.ring-link]="selected"
        [class.pr-8]="selectable"
        [attr.aria-label]="ariaLabel"
        (click)="activate.emit()"
      >
        @if (status === 'conflict') {
          <mat-icon aria-hidden="true" class="shrink-0 text-danger">warning</mat-icon>
        }
        @if (status === 'locked') {
          <mat-icon aria-hidden="true" class="shrink-0">lock</mat-icon>
        }
        <span class="min-w-0">
          <span class="block font-medium">{{ time }}</span>
          @if (detail) {
            <span class="block truncate">{{ detail }}</span>
          }
        </span>
        @if (clock !== 'none') {
          <mat-icon
            aria-hidden="true"
            class="ml-auto shrink-0"
            [class.text-success]="clock === 'onShift'"
            [class.text-danger]="clock === 'late'"
            >{{ clock === 'late' ? 'alarm' : 'schedule' }}</mat-icon
          >
        }
      </button>
    }
    @if (selectable) {
      <label class="absolute right-0 top-0 flex h-6 w-6 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          class="size-4"
          i18n-aria-label="@@ui.shift_block.select"
          aria-label="Select shift"
          [checked]="selected"
          (click)="$event.stopPropagation()"
          (change)="selectedChange.emit($any($event.target).checked)"
        />
      </label>
    }
  `,
})
export class LzShiftBlockComponent {
  @Input({ required: true }) status!: LzShiftStatus;
  @Input({ required: true }) time!: string;
  @Input() detail = '';
  @Input({ transform: booleanAttribute }) selectable = false;
  @Input({ transform: booleanAttribute }) selected = false;
  @Input() clock: 'none' | 'onShift' | 'late' = 'none';
  @Output() activate = new EventEmitter<void>();
  @Output() selectedChange = new EventEmitter<boolean>();

  get ariaLabel(): string {
    return `${this.statusLabel()}, ${this.time}${this.detail ? ', ' + this.detail : ''}${this.clockLabel()}`;
  }

  private clockLabel(): string {
    switch (this.clock) {
      case 'onShift':
        return $localize`:@@ui.shift_clock.on_shift:, on shift now`;
      case 'late':
        return $localize`:@@ui.shift_clock.late:, late`;
      default:
        return '';
    }
  }

  private statusLabel(): string {
    switch (this.status) {
      case 'published':
        return $localize`:@@ui.shift_status.published:Published`;
      case 'draft':
        return $localize`:@@ui.shift_status.draft:Draft`;
      case 'open':
        return $localize`:@@ui.shift_status.open:Open`;
      case 'conflict':
        return $localize`:@@ui.shift_status.conflict:Conflict`;
      case 'timeOff':
        return $localize`:@@ui.shift_status.timeOff:Time off`;
      case 'locked':
        return $localize`:@@ui.shift_status.locked:Locked`;
      case 'void':
        return $localize`:@@ui.shift_status.void:Void`;
    }
  }
}
