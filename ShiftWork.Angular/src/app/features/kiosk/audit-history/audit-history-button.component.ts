import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { People } from 'src/app/core/models/people.model';
import { AuditHistoryDialogComponent, AuditHistoryDialogData } from './audit-history-dialog.component';

/**
 * Audit History Button Component
 * Small button component that opens audit history dialog for an entity
 */
@Component({
  selector: 'app-audit-history-button',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <button
      mat-icon-button
      (click)="openAuditHistory()"
      matTooltip="View audit history for this {{ entityType }}"
      [attr.aria-label]="'View history for ' + entityType"
      class="audit-button"
    >
      <mat-icon>history</mat-icon>
    </button>
  `,
  styles: [`
    .audit-button {
      color: #2196f3;

      &:hover {
        background-color: rgba(33, 150, 243, 0.1);
      }
    }
  `]
})
export class AuditHistoryButtonComponent {
  @Input() entity!: any; // Can be Person, Schedule, Location, etc.
  @Input() entityType = 'Entity'; // e.g., 'Person', 'Schedule'
  @Input() entityId!: string | number;
  @Input() entityDisplayName!: string;
  @Input() companyId!: string;

  constructor(private dialog: MatDialog) {}

  openAuditHistory(): void {
    const dialogData: AuditHistoryDialogData = {
      entityName: this.entityType,
      entityId: this.entityId.toString(),
      entityDisplayName: this.entityDisplayName,
      companyId: this.companyId
    };

    this.dialog.open(AuditHistoryDialogComponent, {
      data: dialogData,
      width: '95vw',
      maxWidth: '1000px',
      maxHeight: '90vh',
      panelClass: 'audit-history-dialog-panel'
    });
  }
}
