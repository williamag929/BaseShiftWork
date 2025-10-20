import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

import { AuthService } from 'src/app/core/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-pin-dialog',
  templateUrl: './pin-dialog.component.html',
  styleUrls: ['./pin-dialog.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    ReactiveFormsModule
  ]
})
export class PinDialogComponent {
  pinForm: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<PinDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { name: string, personId: number },
    private fb: FormBuilder,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.pinForm = this.fb.group({
      pin: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(4)]]
    });
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.pinForm.valid) {
      this.authService.verifyPin(this.data.personId, this.pinForm.value.pin).subscribe(result => {
        if (result.verified) {
          this.dialogRef.close(true);
        } else {
          this.toastr.error('Invalid PIN');
          this.pinForm.reset();
        }
      }, error => {
        this.toastr.error('Error verifying PIN');
        console.error(error);
      });
    }
  }
}
