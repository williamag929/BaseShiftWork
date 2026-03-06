import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { RegistrationService } from '../../core/services/registration.service';
import { Subscription, interval } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-verify-email',
  template: `
    <div class="verify-container">
      <div class="verify-card">
        <div class="verify-icon">📧</div>
        <h1>Check your email</h1>
        <p class="verify-email">{{ userEmail }}</p>
        <p class="verify-desc">
          We sent a verification link to your email address.
          Please click the link to continue — this page will advance automatically.
        </p>

        <div *ngIf="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
        <div *ngIf="checking" class="verify-checking">
          <span class="spinner-border spinner-border-sm"></span> Checking verification status…
        </div>

        <div class="verify-actions">
          <button class="btn btn-link btn-sm" (click)="resendEmail()" [disabled]="resendCooldown > 0">
            {{ resendCooldown > 0 ? 'Resend in ' + resendCooldown + 's' : 'Resend verification email' }}
          </button>
        </div>

        <p class="verify-skip">
          <a href="#" (click)="skipForNow($event)">Skip for now → go to dashboard</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .verify-container { display:flex; align-items:center; justify-content:center; min-height:100vh; background:#f5f5f5; }
    .verify-card { background:#fff; border-radius:12px; padding:40px; max-width:440px; width:100%; text-align:center; box-shadow:0 2px 12px rgba(0,0,0,.08); }
    .verify-icon { font-size:48px; margin-bottom:16px; }
    h1 { font-size:22px; margin-bottom:8px; }
    .verify-email { font-weight:600; color:#333; margin-bottom:12px; }
    .verify-desc { color:#666; line-height:1.6; margin-bottom:20px; }
    .verify-checking { color:#666; font-size:13px; margin-bottom:12px; }
    .verify-actions { margin-bottom:16px; }
    .verify-skip a { color:#aaa; font-size:13px; }
  `]
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
    } catch (err: any) {
      this.errorMessage = err?.message ?? 'Failed to resend email.';
    }
  }

  skipForNow(e: Event): void {
    e.preventDefault();
    this.pollSub?.unsubscribe();
    this.router.navigate(['/onboarding']);
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    clearInterval(this.cooldownInterval);
  }
}
