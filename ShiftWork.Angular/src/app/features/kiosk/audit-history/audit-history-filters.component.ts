import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <form [formGroup]="filterForm" class="audit-filters">
      <div class="filters-row">
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Action Type</mat-label>
          <mat-select formControlName="actionType">
            <mat-option value="">All Actions</mat-option>
            <mat-option value="Created">Created</mat-option>
            <mat-option value="Updated">Updated</mat-option>
            <mat-option value="Deleted">Deleted</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Entity Type</mat-label>
          <mat-select formControlName="entityType">
            <mat-option value="">All Entities</mat-option>
            <mat-option *ngFor="let entity of entityTypes" [value]="entity">
              {{ entity }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>From Date</mat-label>
          <input
            matInput
            [matDatepicker]="startPicker"
            formControlName="startDate"
            readonly
          />
          <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
          <mat-datepicker #startPicker></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>To Date</mat-label>
          <input
            matInput
            [matDatepicker]="endPicker"
            formControlName="endDate"
            readonly
          />
          <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
          <mat-datepicker #endPicker></mat-datepicker>
        </mat-form-field>
      </div>

      <div class="filter-actions">
        <button
          mat-raised-button
          color="primary"
          (click)="onApplyFilters()"
          class="apply-btn"
        >
          <mat-icon>filter_list</mat-icon>
          Apply Filters
        </button>
        <button
          mat-stroked-button
          (click)="onResetFilters()"
          class="reset-btn"
        >
          <mat-icon>clear</mat-icon>
          Reset
        </button>
      </div>

      <div class="filter-info">
        <small *ngIf="hasActiveFilters()">
          Showing filtered results • <a (click)="onResetFilters()" class="reset-link">Clear filters</a>
        </small>
        <small *ngIf="!hasActiveFilters()">
          No filters applied
        </small>
      </div>
    </form>
  `,
  styles: [`
    .audit-filters {
      background: #f9f9f9;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 16px;
      margin-bottom: 20px;
    }

    .filters-row {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .filter-field {
      flex: 1;
      min-width: 200px;
      max-width: 250px;
    }

    .filter-actions {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }

    .apply-btn, .reset-btn {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .filter-info {
      font-size: 12px;
      color: #666;
      padding-top: 8px;
      border-top: 1px solid #e0e0e0;
    }

    .reset-link {
      color: #2196f3;
      cursor: pointer;
      text-decoration: underline;

      &:hover {
        color: #1976d2;
      }
    }

    /* Responsive */
    @media (max-width: 1200px) {
      .filters-row {
        flex-direction: column;
      }

      .filter-field {
        max-width: 100%;
      }
    }

    @media (max-width: 600px) {
      .audit-filters {
        padding: 12px;
      }

      .filters-row {
        gap: 12px;
      }

      .filter-actions {
        flex-direction: column;
      }

      .apply-btn, .reset-btn {
        width: 100%;
        justify-content: center;
      }
    }
  `]
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

  hasActiveFilters(): boolean {
    const actionType = this.filterForm.get('actionType')?.value;
    const entityType = this.filterForm.get('entityType')?.value;
    return !!(actionType || entityType);
  }
}
