import '@angular/localize/init';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { RegistrationService } from '../../core/services/registration.service';
import { Subscription, interval } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { LzAlertComponent, LzAuthShellComponent, LzButtonDirective } from '../../shared/ui';

@Component({
  standalone: true,
  imports: [CommonModule, LzAuthShellComponent, LzAlertComponent, LzButtonDirective],
  selector: 'app-verify-email',
  template: `
    <lz-auth-shell title="Check your email" i18n-title="@@registration.verify_title">
      @if (userEmail) {
        <p class="break-all font-medium text-ink">{{ userEmail }}</p>
      }
      <p class="mt-2 text-ink-soft" i18n="@@registration.verify_desc">We sent a verification link to your email address. Click the link to continue. This page will advance automatically.</p>

      @if (errorMessage) {
        <div class="mt-4"><lz-alert tone="danger">{{ errorMessage }}</lz-alert></div>
      }
      @if (checking) {
        <p role="status" class="mt-4 text-ink-soft" i18n="@@registration.verify_checking">Checking verification status...</p>
      }

      <div class="mt-4 flex flex-col gap-3">
        <button type="button" lzButton variant="primary" class="w-full" (click)="resendEmail()" [disabled]="resendCooldown > 0">
          @if (resendCooldown > 0) {
            <ng-container i18n="@@registration.verify_resend_wait">Resend in {{ resendCooldown }}s</ng-container>
          } @else {
            <ng-container i18n="@@auth.verify_email.resend">Resend verification email</ng-container>
          }
        </button>
        <button type="button" lzButton variant="quiet" class="w-full" (click)="skipForNow($event)" i18n="@@registration.verify_skip">Skip for now</button>
      </div>
    </lz-auth-shell>
  `
})
export class VerifyEmailComponent implements OnInit, OnDestroy {
  userEmail = '';
  checking = false;
  errorMessage = '';
  resendCooldown = 0;

  private pollSub?: Subscription;
  private cooldownInterval?: any;

  constructor(
    private afAuth: AngularFireAuth,
    private registrationService: RegistrationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.afAuth.currentUser.then(user => {
      if (user) {
        this.userEmail = user.email ?? '';
        this.startPolling(user.uid);
      }
    });
  }

  private startPolling(uid: string): void {
    this.checking = true;
    // Poll every 3 seconds for up to 10 minutes
    this.pollSub = interval(3000).pipe(
      switchMap(() => this.afAuth.currentUser),
      takeWhile(user => !!user && !user.emailVerified, true)
    ).subscribe({
      next: async (user) => {
        if (!user) return;
        // Force refresh to get server-side emailVerified state
        await user.reload();
        const refreshed = await this.afAuth.currentUser;
        if (refreshed?.emailVerified) {
          this.checking = false;
          this.pollSub?.unsubscribe();
          await this.onVerified();
        }
      },
      error: () => { this.checking = false; }
    });
  }

  private async onVerified(): Promise<void> {
    // Notify the API that this company's onboarding status is now Verified
    const companyId = sessionStorage.getItem('onboarding_company_id');
    if (companyId) {
      try {
        await this.registrationService.patchOnboardingStatus(companyId, 'Verified').toPromise();
      } catch {
        // Non-fatal; the user can proceed regardless
      }
    }
    this.router.navigate(['/onboarding']);
  }

  async resendEmail(): Promise<void> {
    this.errorMessage = '';
    try {
      const user = await this.afAuth.currentUser;
      if (user) {
        await user.sendEmailVerification();
        this.resendCooldown = 60;
        this.cooldownInterval = setInterval(() => {
          this.resendCooldown--;
          if (this.resendCooldown <= 0) clearInterval(this.cooldownInterval);
        }, 1000);
      }
    } catch {
      this.errorMessage = $localize`:@@registration.verify_resend_failed:We couldn't resend the email. Please try again.`;
    }
  }

  skipForNow(e?: Event): void {
    e?.preventDefault();
    this.pollSub?.unsubscribe();
    this.router.navigate(['/onboarding']);
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    clearInterval(this.cooldownInterval);
  }
}
