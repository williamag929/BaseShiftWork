import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { RegistrationService, CompanyRegistrationRequest } from '../../core/services/registration.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  selector: 'app-registration',
  templateUrl: './registration.component.html'
})
export class RegistrationComponent implements OnInit {
  currentStep = 1;
  totalSteps = 3;
  isLoading = false;
  errorMessage = '';

  userForm!: FormGroup;
  companyForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private afAuth: AngularFireAuth,
    private registrationService: RegistrationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.userForm = this.fb.group({
      displayName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });

    this.companyForm = this.fb.group({
      companyName: ['', [Validators.required, Validators.minLength(2)]],
      companyEmail: ['', [Validators.required, Validators.email]],
      companyPhone: [''],
      timeZone: ['UTC', Validators.required]
    });
  }

  get isStep1Valid(): boolean { return this.userForm.valid; }
  get isStep2Valid(): boolean { return this.companyForm.valid; }

  nextStep(): void {
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

      // 5. Register company via API — if this fails we must roll back the Firebase account.
      let response: any;
      try {
        response = await this.registrationService.register(request).toPromise();
      } catch (apiErr: any) {
        // Roll back the Firebase account to avoid an orphaned account with no company.
        try { await firebaseUser.delete(); } catch { /* ignore cleanup error */ }
        throw apiErr;
      }

      // 6. Store companyId in session storage for the onboarding step
      if (response) {
        sessionStorage.setItem('onboarding_company_id', response.companyId);
        sessionStorage.setItem('onboarding_plan', response.plan);
      }

      // 7. Redirect to email verification notice, then onboarding
      this.router.navigate(['/register/verify']);
    } catch (err: any) {
      this.errorMessage = err?.message ?? 'Registration failed. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }
}
