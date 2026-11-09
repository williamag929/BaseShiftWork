import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'lz-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <label class="mb-1 block font-medium text-ink" [attr.for]="controlId">{{ label }}</label>
    <ng-content />
    @if (hint) {
      <p class="mt-1 text-[13px] text-ink-soft">{{ hint }}</p>
    }
    @if (error) {
      <p role="alert" class="mt-1 text-[13px] text-danger-ink">{{ error }}</p>
    }
  `,
})
export class LzFieldComponent {
  @Input({ required: true }) label!: string;
  @Input() hint?: string;
  @Input() error?: string | null;
  @Input() controlId?: string;
}
