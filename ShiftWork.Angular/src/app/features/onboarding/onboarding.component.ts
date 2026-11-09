import '@angular/localize/init';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { RegistrationService, SandboxStatusResponse } from '../../core/services/registration.service';
import { LzAlertComponent, LzAuthShellComponent, LzButtonDirective } from '../../shared/ui';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, LzAuthShellComponent, LzAlertComponent, LzButtonDirective],
  selector: 'app-onboarding',
  templateUrl: './onboarding.component.html'
})
export class OnboardingComponent implements OnInit {
  companyId = '';
  sandboxStatus: SandboxStatusResponse | null = null;
  isLoading = false;
  actionInProgress: 'hide' | 'reset' | 'delete' | null = null;
  successMessage = '';
  errorMessage = '';
  /** Set while the company is on its signup trial; drives the plan banner copy. */
  trialEndsAt: Date | null = null;

  readonly nextSteps: { icon: string; title: string; description: string; link?: string }[] = [
    {
      icon: 'fa-map-marker',
      title: $localize`:@@auth.onboarding.step_location_title:Add your first location`,
      description: $localize`:@@auth.onboarding.step_location_desc:The site where your team works.`,
      link: '/dashboard/locations'
    },
    {
      icon: 'fa-users',
      title: $localize`:@@auth.onboarding.step_people_title:Invite your team`,
      description: $localize`:@@auth.onboarding.step_people_desc:Employees get an email invite to the mobile app.`,
      link: '/dashboard/people'
    },
    {
      icon: 'fa-calendar',
      title: $localize`:@@auth.onboarding.step_schedule_title:Schedule a shift`,
      description: $localize`:@@auth.onboarding.step_schedule_desc:Assign someone to a location and time.`,
      link: '/dashboard/schedule-grid'
    },
    {
      icon: 'fa-clock-o',
      title: $localize`:@@auth.onboarding.step_clock_title:Clock in`,
      description: $localize`:@@auth.onboarding.step_clock_desc:Employees clock in from the mobile app or a kiosk tablet.`
    }
  ];

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
    const trialEnd = new Date(sessionStorage.getItem('onboarding_trial_ends_at') ?? '');
    this.trialEndsAt = trialEnd.getTime() > Date.now() ? trialEnd : null;
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
    this.clearMessages();
    this.actionInProgress = 'hide';
    this.registrationService.hideSandboxData(this.companyId, ['All']).subscribe({
      next: () => {
        this.successMessage = $localize`:@@auth.onboarding.sandbox_hidden_ok:Demo data has been hidden.`;
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
    this.clearMessages();
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
    const confirmText = $localize`:@@auth.onboarding.remove_confirm:Permanently remove all demo data? This can't be undone.`;
    if (!window.confirm(confirmText)) {
      return;
    }
    this.clearMessages();
    this.actionInProgress = 'delete';
    this.registrationService.deleteSandboxData(this.companyId).subscribe({
      next: () => {
        this.successMessage = $localize`:@@auth.onboarding.sandbox_removed_ok:Sandbox data removed. Your workspace is now clean for real data.`;
        this.sandboxStatus = { hasSandboxData: false, sandboxPersonCount: 0, sandboxAreaCount: 0, sandboxLocationCount: 0 };
        this.actionInProgress = null;
      },
      error: (err) => {
        // The API plan-gates permanent removal (403); Hide is always available.
        this.errorMessage = err?.status === 403
          ? $localize`:@@auth.onboarding.remove_plan_required:Permanently removing demo data needs a paid plan. You can hide it instead.`
          : $localize`:@@auth.onboarding.sandbox_removed_fail:Failed to delete sandbox data.`;
        this.actionInProgress = null;
      }
    });
  }

  /**
   * Leaves onboarding through company-switch: that is what loads the new company
   * into the store (and auto-selects it), so dashboard pages have an active company.
   */
  goToDashboard(next?: string): void {
    sessionStorage.removeItem('onboarding_company_id');
    sessionStorage.removeItem('onboarding_plan');
    sessionStorage.removeItem('onboarding_trial_ends_at');
    this.router.navigate(['/company-switch'], next ? { queryParams: { next } } : {});
  }

  private clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }
}
