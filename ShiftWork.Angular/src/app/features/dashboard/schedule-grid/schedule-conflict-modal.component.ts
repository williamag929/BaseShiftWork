import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

/** A single scheduling-rule infraction detected for the proposed shift. */
export interface ConflictViolation {
  /** 'error' blocks saving; 'warning' is advisory. */
  severity: 'error' | 'warning';
  /** Short rule name, e.g. "Overlapping Shift" or "Max Daily Hours". */
  rule: string;
  /** Human-readable detail with concrete numbers and UTC times. */
  detail: string;
}

/**
 * One skipped entry in a bulk operation.
 */
export interface BulkSkippedEntry {
  personName: string;
  date: Date;       // UTC, day of the proposed shift
  reason: string;   // short human-readable reason
}

/**
 * All data the conflict modal needs to render.
 * Built by ScheduleGridComponent.buildConflictInfo() — never by alert().
 * All Date values are UTC; format with fmtUTC() to display correctly.
 */
export interface ScheduleConflictInfo {
  personName: string;
  requestedStart: Date;
  requestedEnd: Date;
  /** The existing schedule that overlaps the proposed one — null when the only issues are policy violations. */
  conflictingShift: { start: Date; end: Date; locationName: string } | null;
  violations: ConflictViolation[];
  /** Present only for bulk operations — replaces the single-shift header. */
  bulkSummary?: {
    createdCount: number;
    skippedCount: number;
    skipped: BulkSkippedEntry[];
  };
}

@Component({
  selector: 'app-schedule-conflict-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './schedule-conflict-modal.component.html',
  styleUrls: ['./schedule-conflict-modal.component.css']
})
export class ScheduleConflictModalComponent {
  @Input() info!: ScheduleConflictInfo;
  @Output() dismiss = new EventEmitter<void>();

  onDismiss(): void {
    this.dismiss.emit();
  }

  get isBulk(): boolean {
    return !!this.info.bulkSummary;
  }

  get hasErrors(): boolean {
    return this.info.violations.some(v => v.severity === 'error');
  }

  get errorCount(): number {
    return this.info.violations.filter(v => v.severity === 'error').length;
  }

  get warningCount(): number {
    return this.info.violations.filter(v => v.severity === 'warning').length;
  }

  /**
   * Format a Date as "13 Mar 07:00 UTC".
   * Always uses UTC getters — never toLocaleString() — to avoid timezone shifts.
   * See: /memories/repo/utc-date-rules.md — Rule 6.
   */
  fmtUTC(d: Date): string {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dy = String(d.getUTCDate()).padStart(2, '0');
    const mo = MONTHS[d.getUTCMonth()];
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${dy} ${mo} ${hh}:${mm} UTC`;
  }
}
