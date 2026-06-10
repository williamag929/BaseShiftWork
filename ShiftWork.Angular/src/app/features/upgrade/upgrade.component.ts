import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { RegistrationService, PlanUpgradeRequest } from '../../core/services/registration.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-upgrade',
  templateUrl: './upgrade.component.html'
})
export class UpgradeComponent {
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  // For MVP: no live Stripe integration on this page.
  // The user confirms intent; the backend handles Stripe via PlanService.
  // A real Stripe.js integration would capture card details here.
  mockPaymentMethodId = 'pm_stub_upgrade';

  constructor(
    private registrationService: RegistrationService,
    private authService: AuthService,
    private router: Router
  ) {}

  upgradeToPro(): void {
    this.isLoading = true;
    this.successMessage = '';
    this.errorMessage = '';

    // Get companyId from active session
    const companyId = this.authService.activeCompany?.companyId;
    if (!companyId) {
      this.errorMessage = 'No active company. Please sign in again.';
      this.isLoading = false;
      return;
    }

    const request: PlanUpgradeRequest = {
      stripePaymentMethodId: this.mockPaymentMethodId,
      targetPlan: 'Pro'
    };

    this.registrationService.upgradePlan(companyId, request).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'Upgrade successful! Your plan is now ' + response.plan + '.';
          // Redirect to dashboard after 2 seconds
          setTimeout(() => this.router.navigate(['/dashboard']), 2000);
        } else {
          this.errorMessage = response.message || 'Upgrade failed.';
        }
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'An error occurred during upgrade. Please try again.';
        this.isLoading = false;
      }
    });
  }
}
