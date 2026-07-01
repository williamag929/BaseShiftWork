import '@angular/localize/init';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { RegistrationService, SandboxStatusResponse } from '../../core/services/registration.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-onboarding',
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.css']
})
export class OnboardingComponent implements OnInit {
  companyId = '';
  sandboxStatus: SandboxStatusResponse | null = null;
  isLoading = false;
  actionInProgress: 'hide' | 'reset' | 'delete' | null = null;
  successMessage = '';
  errorMessage = '';

  readonly hideDemoLabel  = $localize`:@@auth.onboarding.hide_demo:Hide demo data`;
  readonly hidingLabel    = $localize`:@@auth.onboarding.hiding:Hiding…`;
  readonly resetDemoLabel = $localize`:@@auth.onboarding.reset_demo:Reset to defaults`;
  readonly resettingLabel = $localize`:@@auth.onboarding.resetting:Resetting…`;
  readonly removeDemoLabel = $localize`:@@auth.onboarding.remove_demo:Remove permanently`;
  readonly removingLabel  = $localize`:@@auth.onboarding.removing:Removing…`;

  constructor(
    private registrationService: RegistrationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.companyId = sessionStorage.getItem('onboarding_company_id') ?? '';
    if (this.companyId) {
      this.loadSandboxStatus();
    }
  }

  loadSandboxStatus(): void {
    this.isLoading = true;
    this.registrationService.getSandboxStatus(this.companyId).subscribe({
      next: (status) => {
        this.sandboxStatus = status;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  hideSandboxData(): void {
    this.actionInProgress = 'hide';
    this.registrationService.hideSandboxData(this.companyId, ['All']).subscribe({
      next: () => {
        this.successMessage = $localize`:@@auth.onboarding.sandbox_hidden_ok:Sandbox data has been hidden. You can restore it at any time from Settings.`;
        this.actionInProgress = null;
        this.loadSandboxStatus();
      },
      error: (err) => {
        this.errorMessage = $localize`:@@auth.onboarding.sandbox_hidden_fail:Failed to hide sandbox data. Please try again.`;
        this.actionInProgress = null;
      }
    });
  }

  resetSandboxData(): void {
    this.actionInProgress = 'reset';
    this.registrationService.resetSandboxData(this.companyId).subscribe({
      next: () => {
        this.successMessage = $localize`:@@auth.onboarding.sandbox_reset_ok:Sandbox data has been reset to defaults.`;
        this.actionInProgress = null;
        this.loadSandboxStatus();
      },
      error: () => {
        this.errorMessage = $localize`:@@auth.onboarding.sandbox_reset_fail:Failed to reset sandbox data.`;
        this.actionInProgress = null;
      }
    });
  }

  deleteSandboxData(): void {
    this.actionInProgress = 'delete';
    this.registrationService.deleteSandboxData(this.companyId).subscribe({
      next: () => {
        this.successMessage = $localize`:@@auth.onboarding.sandbox_removed_ok:Sandbox data removed. Your workspace is now clean for real data.`;
        this.sandboxStatus = { hasSandboxData: false, sandboxPersonCount: 0, sandboxAreaCount: 0, sandboxLocationCount: 0 };
        this.actionInProgress = null;
      },
      error: () => {
        this.errorMessage = $localize`:@@auth.onboarding.sandbox_removed_fail:Failed to delete sandbox data.`;
        this.actionInProgress = null;
      }
    });
  }

  goToDashboard(): void {
    sessionStorage.removeItem('onboarding_company_id');
    sessionStorage.removeItem('onboarding_plan');
    this.router.navigate(['/dashboard']);
  }
}
