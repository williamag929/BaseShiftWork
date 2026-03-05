import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { RegistrationService, CompanyRegistrationRequest } from '../../core/services/registration.service';

@Component({
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

    try {
      const { email, password, displayName } = this.userForm.value;
      const { companyName, companyEmail, companyPhone, timeZone } = this.companyForm.value;

      // 1. Create Firebase account
      const credential = await this.afAuth.createUserWithEmailAndPassword(email, password);
      const user = credential.user;
      if (!user) throw new Error('Failed to create Firebase account.');

      // 2. Update Firebase display name
      await user.updateProfile({ displayName });

      // 3. Send email verification
      await user.sendEmailVerification();

      // 4. Get Firebase ID token to authenticate the registration call
      const idToken = await user.getIdToken();

      const request: CompanyRegistrationRequest = {
        firebaseUid: user.uid,
        userEmail: email,
        userDisplayName: displayName,
        companyName,
        companyEmail,
        companyPhone: companyPhone || undefined,
        timeZone
      };

      // 5. Register company via API (interceptor will attach token automatically)
      const response = await this.registrationService.register(request).toPromise();

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
