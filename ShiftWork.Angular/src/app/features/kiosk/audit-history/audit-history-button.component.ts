import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { LzButtonDirective } from 'src/app/shared/ui/button/lz-button.directive';
import { AuditHistoryDialogComponent, AuditHistoryDialogData } from './audit-history-dialog.component';

/**
 * Audit History Button Component
 * Small button component that opens audit history dialog for an entity
 */
@Component({
  selector: 'app-audit-history-button',
  standalone: true,
  imports: [CommonModule, MatIconModule, LzButtonDirective],
  template: `
    <button
      type="button"
      lzButton
      variant="quiet"
      iconOnly
      (click)="openAuditHistory()"
      [attr.title]="buttonTitle"
      [attr.aria-label]="buttonLabel"
    >
      <mat-icon aria-hidden="true">history</mat-icon>
    </button>
  `
})
export class AuditHistoryButtonComponent {
  @Input() entity!: any; // Can be Person, Schedule, Location, etc.
  @Input() entityType = 'Entity'; // e.g., 'Person', 'Schedule'
  @Input() entityId!: string | number;
  @Input() entityDisplayName!: string;
  @Input() companyId!: string;

  constructor(private dialog: MatDialog) {}

  get buttonLabel(): string {
    return $localize`:@@audit.button_aria:View history for ${this.entityType}:ENTITY:`;
  }

  get buttonTitle(): string {
    return $localize`:@@audit.button_title:View audit history for this ${this.entityType}:ENTITY:`;
  }

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
      panelClass: 'lz-dialog-surface'
    });
  }
}
