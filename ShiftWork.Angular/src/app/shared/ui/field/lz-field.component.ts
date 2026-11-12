import { ChangeDetectionStrategy, Component, Input, booleanAttribute } from '@angular/core';

@Component({
  selector: 'lz-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <label class="mb-1 block font-medium text-ink" [attr.for]="controlId">{{ label }}@if (required) {<span aria-hidden="true"> *</span>}</label>
    <ng-content />
    @if (hint) {
      <p class="m-0 mt-1 text-[13px] text-ink-soft" [attr.id]="controlId ? controlId + '-hint' : null">{{ hint }}</p>
    }
    @if (error) {
      <p role="alert" class="m-0 mt-1 text-[13px] text-danger-ink" [attr.id]="controlId ? controlId + '-error' : null">{{ error }}</p>
    }
  `,
})
export class LzFieldComponent {
  @Input({ required: true }) label!: string;
  @Input() hint?: string;
  @Input() error?: string | null;
  @Input() controlId?: string;
  @Input({ transform: booleanAttribute }) required = false;
}
