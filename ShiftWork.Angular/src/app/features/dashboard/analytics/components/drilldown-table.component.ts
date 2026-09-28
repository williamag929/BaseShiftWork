import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AnalyticsDrilldownRow } from '../../../../core/models/analytics.model';

@Component({
  selector: 'app-drilldown-table',
  template: `
    <div class="dd-card">
      <div class="dd-head">
        <div class="dd-title">
          <mat-icon>table_rows</mat-icon>
          <span i18n="@@analytics.drilldown_title">Underlying rows</span>
          <span class="dd-context" *ngIf="bucket"> · {{ bucket }}</span>
        </div>
        <div class="dd-actions">
          <button mat-stroked-button (click)="exportCsv.emit()" [disabled]="total === 0">
            <mat-icon>download</mat-icon>
            <span i18n="@@analytics.export_csv">Export CSV</span>
          </button>
          <button mat-icon-button (click)="close.emit()" aria-label="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <div class="dd-scroll">
        <table mat-table [dataSource]="rows" class="dd-table">
          <ng-container matColumnDef="day">
            <th mat-header-cell *matHeaderCellDef i18n="@@analytics.col_day">Day</th>
            <td mat-cell *matCellDef="let r">{{ r.day | date: 'mediumDate' }}</td>
          </ng-container>
          <ng-container matColumnDef="person">
            <th mat-header-cell *matHeaderCellDef i18n="@@analytics.col_person">Person</th>
            <td mat-cell *matCellDef="let r">{{ r.personName }}</td>
          </ng-container>
          <ng-container matColumnDef="location">
            <th mat-header-cell *matHeaderCellDef i18n="@@analytics.col_location">Location</th>
            <td mat-cell *matCellDef="let r">{{ r.locationName }}</td>
          </ng-container>
          <ng-container matColumnDef="scheduled">
            <th mat-header-cell *matHeaderCellDef class="num" i18n="@@analytics.col_scheduled">Scheduled</th>
            <td mat-cell *matCellDef="let r" class="num">{{ r.scheduledHours | number: '1.0-1' }}</td>
          </ng-container>
          <ng-container matColumnDef="worked">
            <th mat-header-cell *matHeaderCellDef class="num" i18n="@@analytics.col_worked">Worked</th>
            <td mat-cell *matCellDef="let r" class="num">{{ r.workedHours | number: '1.0-1' }}</td>
          </ng-container>
          <ng-container matColumnDef="variance">
            <th mat-header-cell *matHeaderCellDef class="num" i18n="@@analytics.col_variance">Variance</th>
            <td mat-cell *matCellDef="let r" class="num" [ngClass]="r.varianceHours < 0 ? 'neg' : 'pos'">
              {{ r.varianceHours | number: '1.0-1' }}
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef i18n="@@analytics.col_status">Status</th>
            <td mat-cell *matCellDef="let r">
              <span class="badge" [ngClass]="'st-' + r.status">{{ statusLabel(r.status) }}</span>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>

        <div class="dd-empty" *ngIf="total === 0" i18n="@@analytics.drilldown_empty">
          No rows for this selection.
        </div>
      </div>

      <mat-paginator
        [length]="total"
        [pageIndex]="page - 1"
        [pageSize]="pageSize"
        [pageSizeOptions]="[10, 25, 50, 100]"
        (page)="onPage($event)">
      </mat-paginator>
    </div>
  `,
  styles: [`
    .dd-card { background: #fff; border: 1px solid rgba(11,11,11,0.08); border-radius: 14px; overflow: hidden; }
    .dd-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #e1e0d9; }
    .dd-title { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #0b0b0b; }
    .dd-title mat-icon { color: #898781; }
    .dd-context { color: #52514e; font-weight: 500; }
    .dd-actions { display: flex; align-items: center; gap: 4px; }
    .dd-scroll { overflow-x: auto; }
    .dd-table { width: 100%; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    td.neg { color: #d03b3b; } td.pos { color: #006300; }
    .badge { padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .st-on-time { background: rgba(12,163,12,0.12); color: #0a7a0a; }
    .st-late { background: rgba(250,178,25,0.16); color: #8a6100; }
    .st-no-show { background: rgba(208,59,59,0.12); color: #b02a2a; }
    .st-open { background: rgba(235,104,52,0.12); color: #b8501f; }
    .st-unscheduled { background: rgba(11,11,11,0.06); color: #52514e; }
    .dd-empty { padding: 28px; text-align: center; color: #898781; }
  `],
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
