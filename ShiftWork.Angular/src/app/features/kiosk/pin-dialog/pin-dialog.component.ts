import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

import { AuthService } from 'src/app/core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { SettingsHelperService } from 'src/app/core/services/settings-helper.service';
import { Store } from '@ngrx/store';

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
export class PinDialogComponent implements OnInit {
  pinForm: FormGroup;
  pinLength = 4;

  constructor(
    public dialogRef: MatDialogRef<PinDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { name: string, personId: number },
    private fb: FormBuilder,
    private authService: AuthService,
    private toastr: ToastrService,
    private settingsHelper: SettingsHelperService,
    private store: Store<{ activeCompany: string | null }>
  ) {
    this.pinForm = this.fb.group({
      pin: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    // Load PIN length from settings
    this.store.select(state => state.activeCompany).subscribe(companyId => {
      if (companyId) {
        this.settingsHelper.loadSettings(companyId).subscribe(settings => {
          this.pinLength = this.settingsHelper.getKioskPinLength(settings);
          // Update validators with dynamic PIN length
          this.pinForm.get('pin')?.setValidators([
            Validators.required,
            Validators.minLength(this.pinLength),
            Validators.maxLength(this.pinLength)
          ]);
          this.pinForm.get('pin')?.updateValueAndValidity();
        });
      }
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
