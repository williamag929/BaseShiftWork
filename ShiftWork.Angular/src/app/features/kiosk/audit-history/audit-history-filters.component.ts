import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LzButtonDirective } from 'src/app/shared/ui/button/lz-button.directive';
import { LzFieldComponent } from 'src/app/shared/ui/field/lz-field.component';
import { LzFieldDirective } from 'src/app/shared/ui/field/lz-field.directive';
import { AuditActionType, AuditEntityType } from 'src/app/core/models/audit-history.model';

export interface AuditFilterParams {
  actionType?: string;
  startDate?: Date;
  endDate?: Date;
  entityType?: string;
}

/**
 * Audit History Filters Component
 * Provides filtering options for audit records
 */
@Component({
  selector: 'app-audit-history-filters',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    LzButtonDirective,
    LzFieldComponent,
    LzFieldDirective
  ],
  template: `
    <form [formGroup]="filterForm" class="mb-4 space-y-3 rounded-panel border border-line bg-paper-alt p-4">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <lz-field label="Action type" i18n-label="@@audit.action_type" controlId="audit-action-type">
          <select lzField id="audit-action-type" formControlName="actionType">
            <option value="" i18n="@@audit.all_actions">All actions</option>
            <option value="Created" i18n="@@audit.created">Created</option>
            <option value="Updated" i18n="@@audit.updated">Updated</option>
            <option value="Deleted" i18n="@@audit.deleted">Deleted</option>
          </select>
        </lz-field>

        @if (showEntityTypeFilter) {
          <lz-field label="Entity type" i18n-label="@@audit.entity_type" controlId="audit-entity-type">
            <select lzField id="audit-entity-type" formControlName="entityType">
              <option value="" i18n="@@audit.all_entities">All entities</option>
              @for (entity of entityTypes; track entity) {
                <option [value]="entity">{{ entity }}</option>
              }
            </select>
          </lz-field>
        }

        <lz-field label="From date" i18n-label="@@audit.from_date" controlId="audit-start-date">
          <input lzField id="audit-start-date" type="date" [value]="dateValue('startDate')" (change)="onDateInput('startDate', $event)" />
        </lz-field>

        <lz-field label="To date" i18n-label="@@audit.to_date" controlId="audit-end-date">
          <input lzField id="audit-end-date" type="date" [value]="dateValue('endDate')" (change)="onDateInput('endDate', $event)" />
        </lz-field>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" lzButton variant="primary" (click)="onApplyFilters()">
          <mat-icon aria-hidden="true">filter_list</mat-icon>
          <ng-container i18n="@@audit.apply">Apply filters</ng-container>
        </button>
        <button type="button" lzButton variant="secondary" (click)="onResetFilters()">
          <mat-icon aria-hidden="true">clear</mat-icon>
          <ng-container i18n="@@audit.reset">Reset</ng-container>
        </button>
        <span class="ml-auto text-ink-soft" role="status">
          @if (hasActiveFilters()) {
            <ng-container i18n="@@audit.filtered">Showing filtered results</ng-container>
          } @else {
            <ng-container i18n="@@audit.no_filters">No filters applied</ng-container>
          }
        </span>
      </div>
    </form>
  `
})
export class AuditHistoryFiltersComponent implements OnInit {
  @Output() filtersApplied = new EventEmitter<AuditFilterParams>();
  @Input() showEntityTypeFilter = false;

  filterForm: FormGroup;
  entityTypes = Object.values(AuditEntityType);
  actionTypes = Object.values(AuditActionType);

  constructor(private fb: FormBuilder) {
    this.filterForm = this.fb.group({
      actionType: [''],
      entityType: [''],
      startDate: [null],
      endDate: [null]
    });
  }

  ngOnInit(): void {
    // Set default date range to last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    this.filterForm.patchValue({
      startDate: startDate,
      endDate: endDate
    });
  }

  onApplyFilters(): void {
    const filterParams: AuditFilterParams = {
      actionType: this.filterForm.get('actionType')?.value || undefined,
      entityType: this.filterForm.get('entityType')?.value || undefined,
      startDate: this.filterForm.get('startDate')?.value,
      endDate: this.filterForm.get('endDate')?.value
    };

    this.filtersApplied.emit(filterParams);
  }

  onResetFilters(): void {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    this.filterForm.reset({
      actionType: '',
      entityType: '',
      startDate: startDate,
      endDate: endDate
    });

    this.onApplyFilters();
  }

  dateValue(name: 'startDate' | 'endDate'): string {
    const value = this.filterForm.get(name)?.value as Date | null;
    if (!value) {
      return '';
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }

  onDateInput(name: 'startDate' | 'endDate', event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.filterForm.get(name)?.setValue(raw ? new Date(`${raw}T00:00:00`) : null);
  }

  hasActiveFilters(): boolean {
    const actionType = this.filterForm.get('actionType')?.value;
    const entityType = this.filterForm.get('entityType')?.value;
    return !!(actionType || entityType);
  }
}
