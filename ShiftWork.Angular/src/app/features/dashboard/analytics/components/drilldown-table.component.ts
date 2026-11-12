import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { LzTone } from 'src/app/shared/ui';
import { AnalyticsDrilldownRow } from '../../../../core/models/analytics.model';

@Component({
  standalone: false,
  selector: 'app-drilldown-table',
  template: `
    <lz-panel icon="table_view" [heading]="title">
      <ng-container lzPanelActions>
        @if (bucket) {
          <span class="text-ink-soft">{{ bucket }}</span>
        }
        <button lzButton variant="secondary" type="button" data-testid="export-csv" (click)="exportCsv.emit()" [disabled]="total === 0">
          <mat-icon aria-hidden="true">download</mat-icon>
          <span i18n="@@analytics.export_csv">Export CSV</span>
        </button>
        <button lzButton variant="quiet" iconOnly type="button" aria-label="Close" i18n-aria-label="@@common.close_aria" (click)="close.emit()">
          <mat-icon aria-hidden="true">close</mat-icon>
        </button>
      </ng-container>

      @if (total === 0) {
        <lz-empty-state icon="table_rows" title="No rows for this selection." i18n-title="@@analytics.drilldown_empty" />
      } @else {
        <lz-table-scroll>
          <table lzTable class="min-w-3xl">
            <thead>
              <tr>
                <th scope="col" i18n="@@analytics.col_day">Day</th>
                <th scope="col" i18n="@@analytics.col_person">Person</th>
                <th scope="col" i18n="@@analytics.col_location">Location</th>
                <th scope="col" class="text-right" i18n="@@analytics.col_scheduled">Scheduled</th>
                <th scope="col" class="text-right" i18n="@@analytics.col_worked">Worked</th>
                <th scope="col" class="text-right" i18n="@@analytics.col_variance">Variance</th>
                <th scope="col" i18n="@@analytics.col_status">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows; track $index) {
                <tr>
                  <td>{{ r.day | date: 'mediumDate' }}</td>
                  <td>{{ r.personName }}</td>
                  <td>{{ r.locationName }}</td>
                  <td class="text-right tabular-nums">{{ r.scheduledHours | number: '1.0-1' }}</td>
                  <td class="text-right tabular-nums">{{ r.workedHours | number: '1.0-1' }}</td>
                  <td class="text-right tabular-nums" [class.text-danger-ink]="r.varianceHours < 0" [class.text-success-ink]="r.varianceHours >= 0">
                    {{ r.varianceHours | number: '1.0-1' }}
                  </td>
                  <td><lz-status-chip [tone]="statusTone(r.status)" dot>{{ statusLabel(r.status) }}</lz-status-chip></td>
                </tr>
              }
            </tbody>
          </table>
        </lz-table-scroll>
        <lz-pager [total]="total" [page]="page" [pageSize]="pageSize" [pageSizes]="[10, 25, 50, 100]" (pageChange)="onPage({ pageIndex: $event - 1, pageSize: pageSize })" (pageSizeChange)="onPage({ pageIndex: 0, pageSize: $event })" />
      }
    </lz-panel>
  `,
})
export class DrilldownTableComponent {
  @Input() rows: AnalyticsDrilldownRow[] = [];
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 25;
  @Input() bucket: string | null = null;

  @Output() pageChange = new EventEmitter<{ page: number; pageSize: number }>();
  @Output() exportCsv = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  columns = ['day', 'person', 'location', 'scheduled', 'worked', 'variance', 'status'];

  onPage(e: { pageIndex: number; pageSize: number }) {
    this.pageChange.emit({ page: e.pageIndex + 1, pageSize: e.pageSize });
  }

  get title(): string {
    return $localize`:@@analytics.drilldown_title:Underlying rows`;
  }

  statusTone(status: string): LzTone {
    switch (status) {
      case 'on-time': return 'success';
      case 'late': return 'warning';
      case 'no-show': return 'danger';
      case 'open': return 'info';
      default: return 'neutral';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'on-time': return $localize`:@@analytics.status_on_time:On time`;
      case 'late': return $localize`:@@analytics.status_late:Late`;
      case 'no-show': return $localize`:@@analytics.status_no_show:No show`;
      case 'open': return $localize`:@@analytics.status_open:Open`;
      case 'unscheduled': return $localize`:@@analytics.status_unscheduled:Unscheduled`;
      default: return status;
    }
  }
}
