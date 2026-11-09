import { Component, Inject, OnInit, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LzButtonDirective } from 'src/app/shared/ui/button/lz-button.directive';
import { LzDialogFrameComponent } from 'src/app/shared/ui/dialog/lz-dialog-frame.component';
import { LzEmptyStateComponent } from 'src/app/shared/ui/empty-state/lz-empty-state.component';
import { LzPagerComponent } from 'src/app/shared/ui/pager/lz-pager.component';
import { LzSegmentedComponent, LzSegmentedOption } from 'src/app/shared/ui/segmented/lz-segmented.component';
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
    MatIconModule,
    MatProgressSpinnerModule,
    LzButtonDirective,
    LzDialogFrameComponent,
    LzEmptyStateComponent,
    LzPagerComponent,
    LzSegmentedComponent,
    AuditHistoryTimelineComponent,
    AuditHistoryFiltersComponent
  ],
  template: `
    <lz-dialog-frame [title]="dialogTitle" [subtitle]="dialogSubtitle" [closable]="true" (closed)="close()">
      <div class="space-y-4">
        <lz-segmented
          [options]="tabOptions"
          [value]="activeTab"
          (valueChange)="activeTab = $any($event)"
          ariaLabel="Audit history views"
          i18n-ariaLabel="@@audit.views_aria"
        />

        <app-audit-history-filters [hidden]="activeTab !== 'entity'" [showEntityTypeFilter]="false" (filtersApplied)="onFiltersApplied($event)" />
        @if (showRelatedEntities) {
          <app-audit-history-filters [hidden]="activeTab !== 'related'" [showEntityTypeFilter]="true" (filtersApplied)="onRelatedFiltersApplied($event)" />
        }

        @switch (activeTab) {
          @case ('entity') {

            @if (loading) {
              <div role="status" class="flex items-center justify-center gap-3 py-10 text-ink-soft">
                <mat-spinner diameter="32" aria-hidden="true" />
                <span i18n="@@audit.loading">Loading audit history...</span>
              </div>
            } @else if (totalRecords === 0) {
              <lz-empty-state icon="history" [title]="noChangesTitle" />
            } @else {
              <app-audit-history-timeline [items]="auditHistory" />
              <lz-pager
                [total]="totalRecords"
                [page]="currentPage"
                [pageSize]="pageSize"
                [pageSizes]="[10, 20, 50]"
                (pageChange)="onPageNumber($event)"
                (pageSizeChange)="onPageSize($event)"
              />
            }
          }
          @case ('related') {
            @if (loadingRelated) {
              <div role="status" class="flex items-center justify-center gap-3 py-10 text-ink-soft">
                <mat-spinner diameter="32" aria-hidden="true" />
                <span i18n="@@audit.loading_related">Loading related audit history...</span>
              </div>
            } @else if (relatedAuditHistory.length === 0) {
              <lz-empty-state icon="history" title="No related changes found" i18n-title="@@audit.related_empty" />
            } @else {
              <app-audit-history-timeline [items]="relatedAuditHistory" />
            }
          }
          @case ('summary') {
            <section class="space-y-2">
              <h3 class="m-0 font-display text-base font-semibold" i18n="@@audit.stats_heading">Change statistics</h3>
              <dl class="m-0 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div class="rounded-panel border border-line bg-paper p-3">
                  <dt class="text-ink-soft" i18n="@@audit.total_changes">Total changes</dt>
                  <dd class="m-0 text-2xl font-semibold tabular-nums">{{ totalRecords }}</dd>
                </div>
                <div class="rounded-panel border border-line bg-paper p-3">
                  <dt class="text-ink-soft" i18n="@@audit.created">Created</dt>
                  <dd class="m-0 text-2xl font-semibold tabular-nums text-success-ink">{{ countActionType('Created') }}</dd>
                </div>
                <div class="rounded-panel border border-line bg-paper p-3">
                  <dt class="text-ink-soft" i18n="@@audit.updated">Updated</dt>
                  <dd class="m-0 text-2xl font-semibold tabular-nums text-info-ink">{{ countActionType('Updated') }}</dd>
                </div>
                <div class="rounded-panel border border-line bg-paper p-3">
                  <dt class="text-ink-soft" i18n="@@audit.deleted">Deleted</dt>
                  <dd class="m-0 text-2xl font-semibold tabular-nums text-danger-ink">{{ countActionType('Deleted') }}</dd>
                </div>
              </dl>
            </section>

            <section class="space-y-2">
              <h3 class="m-0 font-display text-base font-semibold" i18n="@@audit.fields_heading">Fields modified</h3>
              @if (getUniqueFields().length === 0) {
                <p class="m-0 text-ink-soft" i18n="@@audit.no_fields">No field-level changes recorded</p>
              } @else {
                <ul class="m-0 list-none divide-y divide-line-soft rounded-panel border border-line bg-paper p-0">
                  @for (field of getUniqueFields(); track field) {
                    <li class="flex items-center justify-between gap-3 px-4 py-2">
                      <span class="font-medium">{{ field }}</span>
                      <span class="text-ink-soft">{{ fieldChangesLabel(field) }}</span>
                    </li>
                  }
                </ul>
              }
            </section>

            <section class="space-y-2">
              <h3 class="m-0 font-display text-base font-semibold" i18n="@@audit.last_modified_heading">Last modified</h3>
              @if (lastModifiedInfo; as info) {
                <p class="m-0"><strong i18n="@@audit.by_label">By:</strong> {{ info.userName || info.userId }}</p>
                <p class="m-0"><strong i18n="@@audit.when_label">When:</strong> {{ formatFullDate(info.actionDate) }}</p>
              } @else {
                <p class="m-0 text-ink-soft" i18n="@@audit.no_changes_available">No changes available</p>
              }
            </section>
          }
        }
      </div>

      <div lzDialogActions>
        <button type="button" lzButton variant="secondary" (click)="close()" i18n="@@common.close">Close</button>
      </div>
    </lz-dialog-frame>
  `
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

  activeTab: 'entity' | 'related' | 'summary' = 'entity';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AuditHistoryDialogData,
    private auditService: AuditHistoryService,
    @Optional() private dialogRef?: MatDialogRef<AuditHistoryDialogComponent>
  ) {}

  get dialogTitle(): string {
    return $localize`:@@audit.dialog_title:Audit history - ${this.data.entityDisplayName}:NAME:`;
  }

  get dialogSubtitle(): string {
    return $localize`:@@audit.dialog_subtitle:Entity: ${this.data.entityName}:ENTITY:`;
  }

  get noChangesTitle(): string {
    return $localize`:@@audit.entity_empty:No changes found for this ${this.data.entityName}:ENTITY:`;
  }

  get tabOptions(): LzSegmentedOption[] {
    const options: LzSegmentedOption[] = [
      { value: 'entity', label: $localize`:@@audit.tab_entity:Entity changes` }
    ];
    if (this.showRelatedEntities) {
      options.push({ value: 'related', label: $localize`:@@audit.tab_related:Related changes (shifts and schedules)` });
    }
    options.push({ value: 'summary', label: $localize`:@@audit.tab_summary:Summary` });
    return options;
  }

  close(): void {
    this.dialogRef?.close();
  }

  fieldChangesLabel(field: string): string {
    const count = this.countFieldChanges(field);
    return $localize`:@@audit.field_changes:${count}:COUNT: changes`;
  }

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
        this.auditHistory = result.actions || [];
        this.allAuditHistory = result.actions || [];
        this.totalRecords = result.totalCount;
        this.lastModifiedInfo = result.actions && result.actions.length > 0 ? result.actions[0] : null;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.auditHistory = [];
        this.allAuditHistory = [];
        this.totalRecords = 0;
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
          this.allRelatedAuditHistory = items || [];
          this.applyRelatedFilters();
          this.loadingRelated = false;
        },
        error: () => {
          this.loadingRelated = false;
          this.allRelatedAuditHistory = [];
          this.relatedAuditHistory = [];
        }
      });
  }

  onPageNumber(page: number): void {
    this.currentPage = page;
    this.loadAuditHistory();
  }

  onPageSize(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
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
    if (!this.allAuditHistory || !Array.isArray(this.allAuditHistory)) {
      return 0;
    }
    return this.allAuditHistory.filter(item => item.actionType === actionType).length;
  }

  getUniqueFields(): string[] {
    if (!this.allAuditHistory || !Array.isArray(this.allAuditHistory)) {
      return [];
    }
    const fields = new Set<string>();
    this.allAuditHistory.forEach(item => {
      if (item.fieldName) {
        fields.add(item.fieldName);
      }
    });
    return Array.from(fields).sort();
  }

  countFieldChanges(fieldName: string): number {
    if (!this.allAuditHistory || !Array.isArray(this.allAuditHistory)) {
      return 0;
    }
    return this.allAuditHistory.filter(item => item.fieldName === fieldName).length;
  }

  formatFullDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleString();
  }
}
