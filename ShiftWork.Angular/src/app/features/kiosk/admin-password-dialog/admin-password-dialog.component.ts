import { Component, Inject } from '@angular/core';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-admin-password-dialog',
  templateUrl: './admin-password-dialog.component.html',
  styleUrls: ['./admin-password-dialog.component.css'],
  standalone: true,
  imports: [MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule, FormsModule, CommonModule]
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
      this.errorMessage = 'Please enter a password';
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
          this.errorMessage = 'Incorrect password';
          this.password = '';
        }
      });
  }
}
