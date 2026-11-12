import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, booleanAttribute } from '@angular/core';

export interface LzSegmentedOption {
  value: string;
  label: string;
}

/** Pressed-toggle group. The focus ring is drawn inset so the rounded group never clips it. */
@Component({
  selector: 'lz-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block max-w-full align-middle' },
  template: `
    <div role="group" [attr.aria-label]="ariaLabel" class="inline-flex max-w-full overflow-x-auto rounded-control border" [class.border-line-strong]="!inverse" [class.border-hero-line]="inverse">
      @for (option of options; track option.value) {
        <button
          type="button"
          class="min-h-12 min-w-12 shrink-0 whitespace-nowrap border-0 px-4 font-[inherit] font-medium focus-visible:-outline-offset-2"
          [class.bg-ink]="!inverse && value === option.value"
          [class.text-paper]="(!inverse && value === option.value) || (inverse && value !== option.value)"
          [class.bg-paper]="value !== option.value ? !inverse : inverse"
          [class.text-ink]="value !== option.value ? !inverse : inverse"
          [class.bg-transparent]="inverse && value !== option.value"
          [attr.aria-pressed]="value === option.value"
          (click)="valueChange.emit(option.value)"
        >{{ option.label }}</button>
      }
    </div>
  `,
})
export class LzSegmentedComponent {
  @Input({ required: true }) options: LzSegmentedOption[] = [];
  @Input() value: string | null = null;
  @Input() ariaLabel?: string;
  /** For dark bands (the Overview command band): selected option is paper on navy. */
  @Input({ transform: booleanAttribute }) inverse = false;
  @Output() valueChange = new EventEmitter<string>();
}
