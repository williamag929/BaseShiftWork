import { Component, Inject } from '@angular/core';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { A11yModule } from '@angular/cdk/a11y';
import { LzAlertComponent } from 'src/app/shared/ui/alert/lz-alert.component';
import { LzButtonDirective } from 'src/app/shared/ui/button/lz-button.directive';
import { LzDialogFrameComponent } from 'src/app/shared/ui/dialog/lz-dialog-frame.component';
import { LzFieldComponent } from 'src/app/shared/ui/field/lz-field.component';
import { LzFieldDirective } from 'src/app/shared/ui/field/lz-field.directive';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-admin-password-dialog',
  templateUrl: './admin-password-dialog.component.html',
  standalone: true,
  imports: [MatDialogModule, MatProgressSpinnerModule, A11yModule, FormsModule, CommonModule, LzAlertComponent, LzButtonDirective, LzDialogFrameComponent, LzFieldComponent, LzFieldDirective]
})
export class AdminPasswordDialogComponent {
  password = '';
  errorMessage = '';
  isVerifying = false;
  private readonly apiUrl = environment.apiUrl;

  constructor(
    public dialogRef: MatDialogRef<AdminPasswordDialogComponent>,
    private http: HttpClient,
    @Inject(MAT_DIALOG_DATA) public data: { companyId: string }
  ) { }

  onNoClick(): void {
    this.dialogRef.close(false);
  }

  onVerify(): void {
    if (!this.password) {
      this.errorMessage = $localize`:@@kiosk_admin_pwd.enter_password:Enter a password`;
      return;
    }

    this.isVerifying = true;
    this.errorMessage = '';

    const companyId = this.data?.companyId || '';
    this.http.post<{ verified: boolean }>(`${this.apiUrl}/kiosk/${companyId}/verify-admin-password`, { password: this.password })
      .pipe(
        catchError(err => {
          console.error('Admin password verification error:', err);
          return of({ verified: false });
        })
      )
      .subscribe(response => {
        this.isVerifying = false;
        
        if (response.verified) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage = $localize`:@@kiosk_admin_pwd.incorrect:Incorrect password`;
          this.password = '';
        }
      });
  }
}
