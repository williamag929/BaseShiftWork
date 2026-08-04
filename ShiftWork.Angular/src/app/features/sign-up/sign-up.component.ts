import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { ToastrService } from 'ngx-toastr';
import { RegistrationService } from '../../core/services/registration.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sign-up',
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.css']
})
export class SignUpComponent implements OnInit {
  signUpForm: FormGroup;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private afAuth: AngularFireAuth,
    private registrationService: RegistrationService,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService
  ) {
    this.signUpForm = this.fb.group({
      // User info
      email: ['', [Validators.required, Validators.email]],
      displayName: ['', [Validators.required, Validators.minLength(2)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],

      // Company info
      companyName: ['', [Validators.required, Validators.minLength(2)]],
      companyEmail: ['', [Validators.required, Validators.email]],
      companyPhone: ['', Validators.pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$|^$/)],
      timeZone: ['UTC', Validators.required],

      // Terms
      agreeToTerms: [false, Validators.requiredTrue]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  async signUp() {
    if (this.signUpForm.invalid) {
      this.toastr.error('Please fix all errors before submitting.');
      return;
    }

    this.isLoading = true;
    try {
      const { email, password, displayName, companyName, companyEmail, companyPhone, timeZone } = this.signUpForm.value;

      // Step 1: Create Firebase user
      const userCredential = await this.afAuth.createUserWithEmailAndPassword(email, password);
      if (!userCredential.user) {
        throw new Error('Failed to create user account.');
      }

      // Step 2: Register company
      const registration = await this.registrationService.registerCompany({
        userEmail: email,
        userDisplayName: displayName,
        companyName,
        companyEmail,
        companyPhone,
        timeZone
      });

      // Step 3: Send verification email
      await userCredential.user.sendEmailVerification();
      this.toastr.success('Account created! Verification email sent.');

      // Step 4: Redirect to dashboard (auth guard will handle the rest)
      this.router.navigate(['/dashboard']);

    } catch (error: any) {
      let errorMsg = 'Sign up failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMsg = 'This email is already registered.';
      } else if (error.code === 'auth/weak-password') {
        errorMsg = 'Password is too weak. Use at least 8 characters.';
      } else if (error.message) {
        errorMsg = error.message;
      }
      this.toastr.error(errorMsg);
      console.error('Sign up error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  googleSignIn() {
    this.authService.googleSignIn();
  }
}