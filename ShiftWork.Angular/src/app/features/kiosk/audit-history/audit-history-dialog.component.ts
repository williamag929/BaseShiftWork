import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { AuditHistoryService } from 'src/app/core/services/audit-history.service';
import {
  AuditHistoryDto,
  AuditHistoryPagedResult,
  AuditHistoryParams,
  AuditEntityType
} from 'src/app/core/models/audit-history.model';
import { AuditHistoryTimelineComponent } from './audit-history-timeline.component';
import { AuditHistoryFiltersComponent, AuditFilterParams } from './audit-history-filters.component';

export interface AuditHistoryDialogData {
  entityName: string;
  entityId: string;
  entityDisplayName: string;
  companyId: string;
}

/**
 * Audit History Dialog Component
 * Main dialog for viewing audit history with filtering and pagination
 */
@Component({
  selector: 'app-audit-history-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    AuditHistoryTimelineComponent,
    AuditHistoryFiltersComponent
  ],
  template: `
    <div class="audit-history-dialog">
      <div class="dialog-header">
        <h2 mat-dialog-title>
          <mat-icon>history</mat-icon>
          Audit History - {{ data.entityDisplayName }}
        </h2>
        <p class="subheader">Entity: {{ data.entityName }}</p>
      </div>

      <mat-dialog-content class="dialog-content">
        <!-- Tabs for different history views -->
        <mat-tab-group>
          <!-- Entity Changes Tab -->
          <mat-tab label="Entity Changes">
            <div class="tab-content">
              <app-audit-history-filters
                [showEntityTypeFilter]="false"
                (filtersApplied)="onFiltersApplied($event)"
              ></app-audit-history-filters>

              <div *ngIf="loading" class="loading-spinner">
                <mat-spinner diameter="40"></mat-spinner>
                <p>Loading audit history...</p>
              </div>

              <app-audit-history-timeline
                *ngIf="!loading"
                [items]="auditHistory"
              ></app-audit-history-timeline>

              <mat-paginator
                *ngIf="!loading && totalRecords > 0"
                [length]="totalRecords"
                [pageSize]="pageSize"
                [pageSizeOptions]="[10, 20, 50]"
                (page)="onPageChange($event)"
              ></mat-paginator>

              <div *ngIf="!loading && totalRecords === 0" class="empty-state">
                <mat-icon>history</mat-icon>
                <p>No changes found for this {{ data.entityName }}</p>
              </div>
            </div>
          </mat-tab>

          <!-- Related Changes Tab (for employees: shifts and schedules) -->
          <mat-tab
            *ngIf="showRelatedEntities"
            label="Related Changes (Shifts & Schedules)"
          >
            <div class="tab-content">
              <app-audit-history-filters
                [showEntityTypeFilter]="true"
                (filtersApplied)="onRelatedFiltersApplied($event)"
              ></app-audit-history-filters>

              <div *ngIf="loadingRelated" class="loading-spinner">
                <mat-spinner diameter="40"></mat-spinner>
                <p>Loading related audit history...</p>
              </div>

              <app-audit-history-timeline
                *ngIf="!loadingRelated"
                [items]="relatedAuditHistory"
              ></app-audit-history-timeline>

              <div *ngIf="!loadingRelated && relatedAuditHistory.length === 0" class="empty-state">
                <mat-icon>history</mat-icon>
                <p>No related changes found</p>
              </div>
            </div>
          </mat-tab>

          <!-- Summary Tab -->
          <mat-tab label="Summary">
            <div class="tab-content">
              <div class="summary-section">
                <h3>Change Statistics</h3>
                <div class="stats-grid">
                  <div class="stat-card">
                    <div class="stat-label">Total Changes</div>
                    <div class="stat-value">{{ totalRecords }}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Created</div>
                    <div class="stat-value created">{{ countActionType('Created') }}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Updated</div>
                    <div class="stat-value updated">{{ countActionType('Updated') }}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Deleted</div>
                    <div class="stat-value deleted">{{ countActionType('Deleted') }}</div>
                  </div>
                </div>
              </div>

              <div class="summary-section">
                <h3>Fields Modified</h3>
                <div class="fields-list">
                  <div
                    *ngFor="let field of getUniqueFields()"
                    class="field-item"
                  >
                    <span class="field-name">{{ field }}</span>
                    <span class="field-count">
                      {{ countFieldChanges(field) }} changes
                    </span>
                  </div>
                </div>
                <p *ngIf="getUniqueFields().length === 0" class="no-fields">
                  No field-level changes recorded
                </p>
              </div>

              <div class="summary-section">
                <h3>Last Modified</h3>
                <div class="last-modified">
                  <p *ngIf="lastModifiedInfo">
                    <strong>By:</strong> {{ lastModifiedInfo.userName || lastModifiedInfo.userId }}
                  </p>
                  <p *ngIf="lastModifiedInfo">
                    <strong>When:</strong> {{ formatFullDate(lastModifiedInfo.actionDate) }}
                  </p>
                  <p *ngIf="!lastModifiedInfo">No changes available</p>
                </div>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .audit-history-dialog {
      width: 100%;
      max-width: 1000px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 0 16px 0;
      border-bottom: 1px solid #e0e0e0;

      h2 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 20px;

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }
    }

    .subheader {
      margin: 0;
      font-size: 12px;
      color: #666;
    }

    .dialog-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px 0;
    }

    .tab-content {
      padding: 20px;
    }

    .loading-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      gap: 16px;

      p {
        color: #666;
        margin: 0;
      }
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #999;

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        display: block;
        margin: 0 auto 16px;
        opacity: 0.5;
      }

      p {
        margin: 0;
        font-size: 14px;
      }
    }

    .summary-section {
      margin-bottom: 30px;
    }

    .summary-section h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: #333;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 8px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .stat-card {
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 16px;
      text-align: center;
      border-left: 4px solid #2196f3;
    }

    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #2196f3;
    }

    .stat-value.created {
      color: #4caf50;
    }

    .stat-value.updated {
      color: #2196f3;
    }

    .stat-value.deleted {
      color: #f44336;
    }

    .fields-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .field-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 4px;
      border-left: 2px solid #ff9800;
    }

    .field-name {
      font-weight: 500;
      color: #333;
      flex: 1;
    }

    .field-count {
      font-size: 12px;
      color: #999;
      background: white;
      padding: 2px 8px;
      border-radius: 12px;
      border: 1px solid #e0e0e0;
    }

    .no-fields {
      text-align: center;
      color: #999;
      font-size: 13px;
      padding: 20px;
      background: #f5f5f5;
      border-radius: 4px;
      margin: 0;
    }

    .last-modified {
      background: #f5f5f5;
      border-radius: 4px;
      padding: 16px;
      border-left: 3px solid #2196f3;

      p {
        margin: 8px 0;
        line-height: 1.5;
      }

      strong {
        color: #333;
      }
    }

    mat-dialog-actions {
      padding: 16px 0 0 0;
      border-top: 1px solid #e0e0e0;
    }

    /* Responsive */
    @media (max-width: 600px) {
      .audit-history-dialog {
        max-width: 100%;
      }

      .tab-content {
        padding: 12px;
      }

      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .dialog-header h2 {
        font-size: 16px;
      }
    }
  `]
})
export class AuditHistoryDialogComponent implements OnInit {
  auditHistory: AuditHistoryDto[] = [];
  relatedAuditHistory: AuditHistoryDto[] = [];
  allAuditHistory: AuditHistoryDto[] = [];
  allRelatedAuditHistory: AuditHistoryDto[] = [];

  loading = false;
  loadingRelated = false;
  totalRecords = 0;
  pageSize = 20;
  currentPage = 1;

  showRelatedEntities = false;
  lastModifiedInfo: AuditHistoryDto | null = null;

  private currentFilters: AuditFilterParams = {};
  private currentRelatedFilters: AuditFilterParams = {};

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AuditHistoryDialogData,
    private auditService: AuditHistoryService
  ) {}

  ngOnInit(): void {
    this.loadAuditHistory();

    // Show related entities only for Person entity type
    this.showRelatedEntities = this.data.entityName === 'Person';
    if (this.showRelatedEntities) {
      this.loadRelatedAuditHistory();
    }
  }

  private loadAuditHistory(): void {
    this.loading = true;
    const params: AuditHistoryParams = {
      companyId: this.data.companyId,
      entityName: this.data.entityName,
      entityId: this.data.entityId,
      page: this.currentPage,
      pageSize: this.pageSize,
      actionType: this.currentFilters.actionType,
      startDate: this.currentFilters.startDate,
      endDate: this.currentFilters.endDate
    };

    this.auditService.getAuditHistoryForEntity(params).subscribe({
      next: (result: AuditHistoryPagedResult) => {
        this.auditHistory = result.items;
        this.allAuditHistory = result.items;
        this.totalRecords = result.totalCount;
        this.lastModifiedInfo = result.items.length > 0 ? result.items[0] : null;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.auditHistory = [];
      }
    });
  }

  private loadRelatedAuditHistory(): void {
    if (this.data.entityName !== 'Person') return;

    this.loadingRelated = true;
    this.auditService
      .getRelatedAuditHistory(this.data.companyId, this.data.entityName, this.data.entityId)
      .subscribe({
        next: (items: AuditHistoryDto[]) => {
          this.allRelatedAuditHistory = items;
          this.applyRelatedFilters();
          this.loadingRelated = false;
        },
        error: () => {
          this.loadingRelated = false;
          this.relatedAuditHistory = [];
        }
      });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadAuditHistory();
  }

  onFiltersApplied(filters: AuditFilterParams): void {
    this.currentFilters = filters;
    this.currentPage = 1;
    this.loadAuditHistory();
  }

  onRelatedFiltersApplied(filters: AuditFilterParams): void {
    this.currentRelatedFilters = filters;
    this.applyRelatedFilters();
  }

  private applyRelatedFilters(): void {
    let filtered = [...this.allRelatedAuditHistory];

    if (this.currentRelatedFilters.actionType) {
      filtered = filtered.filter(
        item => item.actionType === this.currentRelatedFilters.actionType
      );
    }

    if (this.currentRelatedFilters.entityType) {
      filtered = filtered.filter(
        item => item.entityName === this.currentRelatedFilters.entityType
      );
    }

    if (this.currentRelatedFilters.startDate) {
      const startDate = new Date(this.currentRelatedFilters.startDate);
      filtered = filtered.filter(item => new Date(item.actionDate) >= startDate);
    }

    if (this.currentRelatedFilters.endDate) {
      const endDate = new Date(this.currentRelatedFilters.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => new Date(item.actionDate) <= endDate);
    }

    this.relatedAuditHistory = filtered;
  }

  countActionType(actionType: string): number {
    return this.allAuditHistory.filter(item => item.actionType === actionType).length;
  }

  getUniqueFields(): string[] {
    const fields = new Set<string>();
    this.allAuditHistory.forEach(item => {
      if (item.fieldName) {
        fields.add(item.fieldName);
      }
    });
    return Array.from(fields).sort();
  }

  countFieldChanges(fieldName: string): number {
    return this.allAuditHistory.filter(item => item.fieldName === fieldName).length;
  }

  formatFullDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleString();
  }
}
