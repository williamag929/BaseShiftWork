import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';

import { AuthService } from 'src/app/core/services/auth.service';
import { SettingsHelperService } from 'src/app/core/services/settings-helper.service';
import { Store } from '@ngrx/store';
import { LzAlertComponent } from 'src/app/shared/ui/alert/lz-alert.component';
import { LzButtonDirective } from 'src/app/shared/ui/button/lz-button.directive';
import { LzDialogFrameComponent } from 'src/app/shared/ui/dialog/lz-dialog-frame.component';
import { LzFieldComponent } from 'src/app/shared/ui/field/lz-field.component';
import { LzFieldDirective } from 'src/app/shared/ui/field/lz-field.directive';

@Component({
  selector: 'app-pin-dialog',
  templateUrl: './pin-dialog.component.html',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    A11yModule,
    ReactiveFormsModule,
    LzAlertComponent,
    LzButtonDirective,
    LzDialogFrameComponent,
    LzFieldComponent,
    LzFieldDirective
  ]
})
export class PinDialogComponent implements OnInit {
  pinForm: FormGroup;
  pinLength = 4;
  verifying = false;
  submitted = false;
  errorMessage = '';
  readonly digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  constructor(
    public dialogRef: MatDialogRef<PinDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { name: string, personId: number, companyId: string },
    private fb: FormBuilder,
    private authService: AuthService,
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

  get fieldError(): string | null {
    const control = this.pinForm.get('pin');
    if (!this.submitted || !control?.errors) {
      return null;
    }
    return control.hasError('required')
      ? $localize`:@@kiosk_pin.error_required:PIN is required.`
      : $localize`:@@kiosk_pin.error_digits:PIN must be ${this.pinLength}:LENGTH: digits.`;
  }

  pressDigit(digit: string): void {
    const control = this.pinForm.get('pin')!;
    const current: string = control.value || '';
    if (current.length < this.pinLength) {
      this.setPin(current + digit);
    }
  }

  backspace(): void {
    this.setPin((this.pinForm.get('pin')!.value || '').slice(0, -1));
  }

  clearPin(): void {
    this.setPin('');
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    this.submitted = true;
    if (this.pinForm.valid && !this.verifying) {
      this.verifying = true;
      this.errorMessage = '';
      this.authService.verifyPin(this.data.companyId, this.data.personId, this.pinForm.value.pin).subscribe({
        next: result => {
          this.verifying = false;
          if (result.verified) {
            this.dialogRef.close(true);
          } else {
            this.fail($localize`:@@kiosk_pin.invalid:Invalid PIN. Try again.`);
          }
        },
        error: error => {
          this.verifying = false;
          this.fail(error?.status === 429
            ? $localize`:@@kiosk_pin.too_many:Too many attempts. Wait a few minutes and try again.`
            : $localize`:@@kiosk_pin.verify_error:Error verifying PIN`);
        }
      });
    }
  }

  private setPin(value: string): void {
    const control = this.pinForm.get('pin')!;
    control.setValue(value);
    control.markAsDirty();
    this.errorMessage = '';
  }

  private fail(message: string): void {
    this.errorMessage = message;
    this.submitted = false;
    this.pinForm.reset();
  }
}
