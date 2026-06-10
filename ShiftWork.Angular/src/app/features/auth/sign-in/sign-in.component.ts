import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.css'],
  standalone: false,
})
export class SignInComponent implements OnInit {
  signInForm: FormGroup;
  loading = false;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    public authService: AuthService
  ) {
    this.signInForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
  }

  async signIn() {
    if (this.signInForm.valid) {
      this.loading = true;
      this.errorMessage = null;
      const { email, password } = this.signInForm.value;
      try {
        await this.authService.SignIn(email, password);
      } catch (error: any) {
        this.errorMessage = this.getFirebaseErrorMessage(error);
      } finally {
        this.loading = false;
      }
    }
  }

  async googleSignIn() {
    this.loading = true;
    this.errorMessage = null;
    try {
      await this.authService.googleSignIn();
    } catch (error: any) {
      this.errorMessage = this.getFirebaseErrorMessage(error);
    } finally {
      this.loading = false;
    }
  }

  dismissError(): void {
    this.errorMessage = null;
  }

  private getFirebaseErrorMessage(error: any): string {
    const code = error?.code || '';
    switch (code) {
      case 'auth/user-not-found':
        return 'No account found with this email address. Please check and try again, or sign up.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect password. Please try again or use "Forgot Password" to reset it.';
      case 'auth/invalid-email':
        return 'The email address is not valid. Please check the format.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact your administrator.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please wait a few minutes before trying again.';
      case 'auth/network-request-failed':
        return 'Unable to connect. Please check your internet connection and try again.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in popup was closed. Please try again.';
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with this email using a different sign-in method.';
      case 'auth/email-already-in-use':
        return 'This email is already associated with another account.';
      default:
        if (!navigator.onLine) {
          return 'You appear to be offline. Please check your internet connection.';
        }
        return error?.message || 'An unexpected error occurred. Please try again.';
    }
  }
}
