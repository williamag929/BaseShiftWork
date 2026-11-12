import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type LzAlertTone = 'info' | 'success' | 'warning' | 'danger';

const BASE = 'flex items-start gap-3 rounded-control border border-current/20 px-4 py-3';
const TONE_CLASSES: Record<LzAlertTone, string> = {
  info: 'bg-info-bg text-info-ink',
  success: 'bg-success-bg text-success-ink',
  warning: 'bg-(--lz-draft-bg-1) text-amber-ink',
  danger: 'bg-danger-bg text-danger-ink',
};

@Component({
  selector: 'lz-alert',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'toneClasses',
    '[attr.role]': 'tone === "danger" ? "alert" : "status"',
  },
  template: `
    <mat-icon aria-hidden="true" class="shrink-0">{{ icon }}</mat-icon>
    <div class="min-w-0 flex-1 self-center [&_p]:m-0"><ng-content /></div>
  `,
})
export class LzAlertComponent {
  @Input() tone: LzAlertTone = 'info';

  get toneClasses(): string {
    return `${BASE} ${TONE_CLASSES[this.tone]}`;
  }

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
