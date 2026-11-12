import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { LzEmptyStateComponent } from 'src/app/shared/ui/empty-state/lz-empty-state.component';
import {
  AuditHistoryDto,
  AuditActionType,
  AuditEntityType
} from 'src/app/core/models/audit-history.model';

/**
 * Audit History Timeline Component
 * Displays audit records in a chronological timeline format
 */
@Component({
  selector: 'app-audit-history-timeline',
  standalone: true,
  imports: [CommonModule, MatIconModule, LzEmptyStateComponent],
  template: `
    @if (items.length === 0) {
      <lz-empty-state class="no-data" icon="history" title="No audit history available" i18n-title="@@audit.timeline_empty" />
    } @else {
      <ol class="m-0 list-none p-0">
        @for (item of items; track item.id; let last = $last) {
          <li class="timeline-item relative flex gap-4 pb-6" [class.last]="last">
            @if (!last) {
              <span class="absolute top-12 bottom-0 left-5 w-px bg-line" aria-hidden="true"></span>
            }
            <span class="relative flex size-10 shrink-0 items-center justify-center rounded-full"
                  [class]="markerClasses(item.actionType)" aria-hidden="true">
              <mat-icon>{{ getActionIcon(item.actionType) }}</mat-icon>
            </span>

            <div class="min-w-0 flex-1 space-y-2 rounded-panel border border-line bg-paper p-4 shadow-card">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="rounded-chip px-2 py-0.5 text-[13px] font-medium" [class]="markerClasses(item.actionType)">
                  {{ actionLabel(item.actionType) }}
                </span>
                <span class="font-medium">{{ item.entityName }}</span>
                <span class="ml-auto text-ink-soft" [attr.title]="getFullTimestamp(item.actionDate)">
                  {{ formatDate(item.actionDate) }}
                </span>
              </div>

              <div class="flex items-center gap-2 text-ink-soft">
                <mat-icon aria-hidden="true" class="size-5! text-[18px]">person</mat-icon>
                <span>{{ item.userName || item.userId }}</span>
              </div>

              @if (item.fieldName) {
                <div class="rounded-control bg-paper-alt p-3">
                  <div class="font-medium">{{ item.fieldName }}</div>
                  <div class="mt-1 space-y-1">
                    @if (item.oldValue) {
                      <div><strong i18n="@@audit.from_label">From:</strong> <code class="break-words">{{ truncateValue(item.oldValue) }}</code></div>
                    }
                    @if (item.newValue) {
                      <div><strong i18n="@@audit.to_label">To:</strong> <code class="break-words">{{ truncateValue(item.newValue) }}</code></div>
                    }
                  </div>
                </div>
              }

              @if (item.description) {
                <div>{{ item.description }}</div>
              }

              @if (item.metadata) {
                <div class="text-[13px] text-ink-soft">
                  <ng-container i18n="@@audit.source_label">Source:</ng-container>
                  {{ parseMetadata(item.metadata)?.source || unknownSource }}
                </div>
              }
            </div>
          </li>
        }
      </ol>
    }
  `
})
export class AuditHistoryTimelineComponent implements OnInit {
  @Input() items: AuditHistoryDto[] = [];

  readonly unknownSource = $localize`:@@audit.unknown:Unknown`;

  ngOnInit(): void {}

  getActionIcon(actionType: string): string {
    switch (actionType) {
      case AuditActionType.Created:
        return 'add_circle';
      case AuditActionType.Updated:
        return 'edit';
      case AuditActionType.Deleted:
        return 'delete';
      default:
        return 'info';
    }
  }

  getActionClass(actionType: string): string {
    return actionType.toLowerCase();
  }

  markerClasses(actionType: string): string {
    switch (actionType) {
      case AuditActionType.Created:
        return 'bg-success-bg text-success-ink';
      case AuditActionType.Deleted:
        return 'bg-danger-bg text-danger-ink';
      default:
        return 'bg-info-bg text-info-ink';
    }
  }

  actionLabel(actionType: string): string {
    switch (actionType) {
      case AuditActionType.Created:
        return $localize`:@@audit.created:Created`;
      case AuditActionType.Updated:
        return $localize`:@@audit.updated:Updated`;
      case AuditActionType.Deleted:
        return $localize`:@@audit.deleted:Deleted`;
      default:
        return this.formatActionType(actionType);
    }
  }

  formatActionType(actionType: string): string {
    return actionType.charAt(0).toUpperCase() + actionType.slice(1);
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return $localize`:@@audit.just_now:Just now`;
    } else if (diffMins < 60) {
      return $localize`:@@audit.minutes_ago:${diffMins}:MINUTES:m ago`;
    } else if (diffHours < 24) {
      return $localize`:@@audit.hours_ago:${diffHours}:HOURS:h ago`;
    } else if (diffDays < 7) {
      return $localize`:@@audit.days_ago:${diffDays}:DAYS:d ago`;
    } else {
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  getFullTimestamp(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleString();
  }

  truncateValue(value: string | null | undefined): string {
    if (!value) return $localize`:@@audit.empty_value:(empty)`;
    const maxLength = 100;
    return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
  }

  parseMetadata(metadata: string | null | undefined): any {
    if (!metadata) return null;
    try {
      return JSON.parse(metadata);
    } catch {
      return null;
    }
  }
}
