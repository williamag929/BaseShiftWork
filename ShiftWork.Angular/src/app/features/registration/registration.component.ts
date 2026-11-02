import '@angular/localize/init';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { RegistrationService, CompanyRegistrationRequest } from '../../core/services/registration.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  selector: 'app-registration',
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.css']
})
export class RegistrationComponent implements OnInit {
  currentStep = 1;
  totalSteps = 3;
  isLoading = false;
  errorMessage = '';

  userForm!: FormGroup;
  companyForm!: FormGroup;

  /** Time zones already offered in the template's select. */
  private readonly listedTimeZones = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
    'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo'];
  detectedTimeZone = 'UTC';

  constructor(
    private fb: FormBuilder,
    private afAuth: AngularFireAuth,
    private registrationService: RegistrationService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.detectedTimeZone = this.detectTimeZone();

    this.userForm = this.fb.group({
      displayName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });

    this.companyForm = this.fb.group({
      companyName: ['', [Validators.required, Validators.minLength(2)]],
      companyEmail: ['', [Validators.required, Validators.email]],
      companyPhone: [''],
      timeZone: [this.detectedTimeZone, Validators.required]
    });
  }

  get isStep1Valid(): boolean { return this.userForm.valid; }
  get isStep2Valid(): boolean { return this.companyForm.valid; }

  /** True when the browser's zone isn't one of the fixed options, so the select must offer it too. */
  get showDetectedTimeZone(): boolean {
    return !this.listedTimeZones.includes(this.detectedTimeZone);
  }

  nextStep(): void {
    if (this.currentStep === 1) {
      // Most small companies use the owner's email; don't make them type it twice.
      const companyEmail = this.companyForm.get('companyEmail');
      if (companyEmail && !companyEmail.value && !companyEmail.dirty) {
        companyEmail.setValue(this.userForm.value.email);
      }
    }
    if (this.currentStep < this.totalSteps) this.currentStep++;
  }

  prevStep(): void {
    if (this.currentStep > 1) this.currentStep--;
  }

  async onSubmit(): Promise<void> {
    if (!this.userForm.valid || !this.companyForm.valid) return;

    this.isLoading = true;
    this.errorMessage = '';

    // Track the created Firebase user so we can roll it back if the API call fails.
    let firebaseUser: any = null;

    try {
      const { email, password, displayName } = this.userForm.value;
      const { companyName, companyEmail, companyPhone, timeZone } = this.companyForm.value;

      // 1. Create Firebase account
      const credential = await this.afAuth.createUserWithEmailAndPassword(email, password);
      firebaseUser = credential.user;
      if (!firebaseUser) throw new Error('Failed to create Firebase account.');

      // 2. Update Firebase display name
      await firebaseUser.updateProfile({ displayName });

      // 3. Send email verification
      await firebaseUser.sendEmailVerification();

      // 4. Get Firebase ID token to authenticate the registration call
      const idToken = await firebaseUser.getIdToken();

      const request: CompanyRegistrationRequest = {
        firebaseUid: firebaseUser.uid,
        userEmail: email,
        userDisplayName: displayName,
        companyName,
        companyEmail,
        companyPhone: companyPhone || undefined,
        timeZone
      };

      // 5. Register company via API — pass the token explicitly so the [Authorize]
      //    endpoint always receives it regardless of interceptor timing.
      let response: any;
      try {
        response = await this.registrationService.register(request, idToken).toPromise();
      } catch (apiErr: any) {
        // Roll back the Firebase account to avoid an orphaned account with no company.
        try { await firebaseUser.delete(); } catch { /* ignore cleanup error */ }
        throw apiErr;
      }

      // 6. Store companyId in session storage for the onboarding step
      if (response) {
        sessionStorage.setItem('onboarding_company_id', response.companyId);
        sessionStorage.setItem('onboarding_plan', response.plan);
        if (response.trialEndsAt) {
          sessionStorage.setItem('onboarding_trial_ends_at', response.trialEndsAt);
        }
      }

      // Mark the session as signed in: authGuard checks this, and without it the
      // new owner gets bounced to the sign-in page when leaving onboarding.
      void this.authService.SetUserData(firebaseUser);

      // 7. Redirect to email verification notice, then onboarding
      this.router.navigate(['/register/verify']);
    } catch (err: any) {
      console.error('Registration failed', err);
      this.errorMessage = this.friendlyError(err);
    } finally {
      this.isLoading = false;
    }
  }

  private detectTimeZone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  private friendlyError(err: any): string {
    switch (err?.code) {
      case 'auth/email-already-in-use':
        return $localize`:@@registration.error_email_in_use:This email already has an account. Sign in instead, or use a different email.`;
      case 'auth/invalid-email':
        return $localize`:@@registration.error_invalid_email:That email address doesn't look right. Please check it and try again.`;
      case 'auth/weak-password':
        return $localize`:@@registration.error_weak_password:Please choose a stronger password.`;
      case 'auth/too-many-requests':
        return $localize`:@@registration.error_too_many:Too many attempts. Please wait a few minutes and try again.`;
      case 'auth/network-request-failed':
        return $localize`:@@registration.error_network:We couldn't connect. Please check your internet connection and try again.`;
      default:
        return $localize`:@@registration.error_generic:We couldn't create your account. Please try again.`;
    }
  }
}
