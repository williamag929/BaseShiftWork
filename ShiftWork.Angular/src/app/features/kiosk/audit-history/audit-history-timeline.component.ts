import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
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
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <div class="audit-timeline">
      <div *ngIf="items.length === 0" class="no-data">
        <mat-icon>history</mat-icon>
        <p>No audit history available</p>
      </div>

      <div *ngFor="let item of items; let last = last" class="timeline-item" [class.last]="last">
        <div class="timeline-marker" [ngClass]="getActionClass(item.actionType)">
          <mat-icon>{{ getActionIcon(item.actionType) }}</mat-icon>
        </div>

        <div class="timeline-content">
          <div class="timeline-header">
            <span class="action-type" [ngClass]="getActionClass(item.actionType)">
              {{ formatActionType(item.actionType) }}
            </span>
            <span class="entity-name">{{ item.entityName }}</span>
            <span class="timestamp" [matTooltip]="getFullTimestamp(item.actionDate)">
              {{ formatDate(item.actionDate) }}
            </span>
          </div>

          <div class="timeline-actor">
            <mat-icon>person</mat-icon>
            <span>{{ item.userName || item.userId }}</span>
          </div>

          <div *ngIf="item.fieldName" class="field-change">
            <div class="field-name">{{ item.fieldName }}</div>
            <div class="field-values">
              <div class="old-value" *ngIf="item.oldValue">
                <strong>From:</strong> <code>{{ truncateValue(item.oldValue) }}</code>
              </div>
              <div class="new-value" *ngIf="item.newValue">
                <strong>To:</strong> <code>{{ truncateValue(item.newValue) }}</code>
              </div>
            </div>
          </div>

          <div *ngIf="item.description" class="description">
            {{ item.description }}
          </div>

          <div *ngIf="item.metadata" class="metadata">
            <small>Source: {{ parseMetadata(item.metadata)?.source || 'Unknown' }}</small>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .audit-timeline {
      position: relative;
      padding: 20px 0;
    }

    .no-data {
      text-align: center;
      padding: 40px 20px;
      color: #999;
    }

    .no-data mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      display: block;
      margin: 0 auto 10px;
      opacity: 0.5;
    }

    .timeline-item {
      display: flex;
      margin-bottom: 30px;
      position: relative;
      padding-left: 50px;
    }

    .timeline-item.last::before {
      content: none;
    }

    .timeline-item::before {
      content: '';
      position: absolute;
      left: 23px;
      top: 40px;
      bottom: -30px;
      width: 2px;
      background: #e0e0e0;
    }

    .timeline-marker {
      position: absolute;
      left: 0;
      top: 0;
      width: 46px;
      height: 46px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      border: 2px solid;
      z-index: 10;

      mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }
    }

    .timeline-marker.created {
      border-color: #4caf50;
      background: rgba(76, 175, 80, 0.1);
      color: #4caf50;
    }

    .timeline-marker.updated {
      border-color: #2196f3;
      background: rgba(33, 150, 243, 0.1);
      color: #2196f3;
    }

    .timeline-marker.deleted {
      border-color: #f44336;
      background: rgba(244, 67, 54, 0.1);
      color: #f44336;
    }

    .timeline-content {
      flex: 1;
      background: #f5f5f5;
      border-radius: 4px;
      padding: 15px;
      border-left: 3px solid;
    }

    .timeline-content {
      border-left-color: #e0e0e0;
    }

    .timeline-item.created .timeline-content {
      border-left-color: #4caf50;
    }

    .timeline-item.updated .timeline-content {
      border-left-color: #2196f3;
    }

    .timeline-item.deleted .timeline-content {
      border-left-color: #f44336;
    }

    .timeline-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }

    .action-type {
      font-weight: 600;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 3px;
      text-transform: uppercase;
    }

    .action-type.created {
      background: rgba(76, 175, 80, 0.2);
      color: #2e7d32;
    }

    .action-type.updated {
      background: rgba(33, 150, 243, 0.2);
      color: #1565c0;
    }

    .action-type.deleted {
      background: rgba(244, 67, 54, 0.2);
      color: #c62828;
    }

    .entity-name {
      font-weight: 500;
      color: #333;
    }

    .timestamp {
      font-size: 12px;
      color: #666;
      margin-left: auto;
      cursor: help;
    }

    .timeline-actor {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #555;
      margin-bottom: 8px;

      mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
      }
    }

    .field-change {
      background: white;
      border-radius: 3px;
      padding: 10px;
      margin: 8px 0;
      border-left: 2px solid #ff9800;
    }

    .field-name {
      font-weight: 600;
      color: #333;
      margin-bottom: 6px;
      font-size: 13px;
    }

    .field-values {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
    }

    .old-value, .new-value {
      font-size: 12px;
      color: #666;
    }

    .old-value {
      color: #d32f2f;
    }

    .new-value {
      color: #388e3c;
    }

    code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 2px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      word-break: break-all;
    }

    .description {
      font-size: 13px;
      color: #555;
      margin-top: 8px;
      font-style: italic;
    }

    .metadata {
      font-size: 11px;
      color: #999;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid #e0e0e0;
    }

    /* Responsive adjustments */
    @media (max-width: 600px) {
      .timeline-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .timestamp {
        margin-left: 0;
        width: 100%;
      }

      .field-values {
        flex-direction: column;
      }
    }
  `]
})
export class AuditHistoryTimelineComponent implements OnInit {
  @Input() items: AuditHistoryDto[] = [];

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
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  getFullTimestamp(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleString();
  }

  truncateValue(value: string | null | undefined): string {
    if (!value) return '(empty)';
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
