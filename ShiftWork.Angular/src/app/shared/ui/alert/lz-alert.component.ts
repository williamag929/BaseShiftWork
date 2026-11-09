import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type LzAlertTone = 'info' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'lz-alert',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex items-start gap-3 rounded-control px-4 py-3',
    '[attr.role]': 'tone === "danger" ? "alert" : "status"',
    '[class.bg-info-bg]': 'tone === "info"',
    '[class.text-info-ink]': 'tone === "info"',
    '[class.bg-success-bg]': 'tone === "success"',
    '[class.text-success-ink]': 'tone === "success"',
    '[class.bg-[var(--lz-draft-bg-1)]]': 'tone === "warning"',
    '[class.text-amber-ink]': 'tone === "warning"',
    '[class.bg-danger-bg]': 'tone === "danger"',
    '[class.text-danger-ink]': 'tone === "danger"',
  },
  template: `
    <mat-icon aria-hidden="true" class="shrink-0">{{ icon }}</mat-icon>
    <div class="min-w-0 flex-1 self-center"><ng-content /></div>
  `,
})
export class LzAlertComponent {
  @Input() tone: LzAlertTone = 'info';

  get icon(): string {
    switch (this.tone) {
      case 'success':
        return 'check_circle';
      case 'warning':
        return 'warning';
      case 'danger':
        return 'error';
      default:
        return 'info';
    }
  }
}
