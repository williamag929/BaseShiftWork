import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { Location } from 'src/app/core/models/location.model';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-location-select-dialog',
  templateUrl: './location-select-dialog.component.html',
  styleUrls: ['./location-select-dialog.component.css'],
  standalone: true,
  imports: [MatDialogModule, MatFormFieldModule, MatSelectModule, MatButtonModule, CommonModule]
})
export class LocationSelectDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<LocationSelectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { locations: Location[] }
  ) { }

  onNoClick(): void {
    this.dialogRef.close();
  }
}
