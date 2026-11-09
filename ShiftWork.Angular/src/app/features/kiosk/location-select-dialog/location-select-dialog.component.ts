import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { Location } from 'src/app/core/models/location.model';
import { A11yModule } from '@angular/cdk/a11y';
import { LzButtonDirective } from 'src/app/shared/ui/button/lz-button.directive';
import { LzDialogFrameComponent } from 'src/app/shared/ui/dialog/lz-dialog-frame.component';
import { LzFieldComponent } from 'src/app/shared/ui/field/lz-field.component';
import { LzFieldDirective } from 'src/app/shared/ui/field/lz-field.directive';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-location-select-dialog',
  templateUrl: './location-select-dialog.component.html',
  standalone: true,
  imports: [MatDialogModule, A11yModule, FormsModule, CommonModule, LzButtonDirective, LzDialogFrameComponent, LzFieldComponent, LzFieldDirective]
})
export class LocationSelectDialogComponent {
  selectedLocation: Location | null = null;
  assignToDevice = false;

  constructor(
    public dialogRef: MatDialogRef<LocationSelectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { locations: Location[] }
  ) { }

  get closable(): boolean {
    return !this.dialogRef.disableClose;
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  onSelectClick(): void {
    this.dialogRef.close({ location: this.selectedLocation, assignToDevice: this.assignToDevice });
  }
}
