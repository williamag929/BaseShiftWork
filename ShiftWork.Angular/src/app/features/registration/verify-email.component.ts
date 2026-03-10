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
        <div class="verify-icon-circle">
          <i class="fa fa-envelope"></i>
        </div>
        <h1>Check your email</h1>
        <p class="verify-email-address">{{ userEmail }}</p>
        <p class="verify-desc">
          We sent a verification link to your email address.<br>
          Please click the link to continue — this page will advance automatically.
        </p>

        <div *ngIf="errorMessage" class="alert-danger">
          <i class="fa fa-exclamation-triangle"></i> {{ errorMessage }}
        </div>
        <div *ngIf="checking" class="verify-checking">
          <span class="mini-spinner"></span> Checking verification status…
        </div>

        <div class="verify-actions">
          <button class="btn-resend" (click)="resendEmail()" [disabled]="resendCooldown > 0">
            <i class="fa fa-refresh"></i>
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
    @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css');

    .verify-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 2rem 1rem;
      box-sizing: border-box;
    }

    .verify-card {
      background: #fff;
      border-radius: 20px;
      padding: 2.75rem 2.5rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.28);
      animation: slideUp 0.45s ease-out;
    }

    @keyframes slideUp {
      from { opacity:0; transform:translateY(24px); }
      to   { opacity:1; transform:translateY(0); }
    }

    .verify-icon-circle {
      width: 72px;
      height: 72px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.25rem;
      box-shadow: 0 8px 24px rgba(102,126,234,0.38);
    }

    .verify-icon-circle i {
      color: #fff;
      font-size: 1.8rem;
    }

    h1 {
      font-size: 1.6rem;
      font-weight: 700;
      color: #1a1a2e;
      margin: 0 0 0.5rem;
    }

    .verify-email-address {
      font-weight: 600;
      color: #667eea;
      margin: 0 0 0.75rem;
      font-size: 0.95rem;
      word-break: break-all;
    }

    .verify-desc {
      color: #6c757d;
      line-height: 1.65;
      font-size: 0.9rem;
      margin: 0 0 1.5rem;
    }

    .alert-danger {
      background: #fff5f5;
      border: 1.5px solid #f5c2c7;
      border-radius: 10px;
      color: #842029;
      padding: 0.7rem 0.9rem;
      font-size: 0.875rem;
      margin-bottom: 1rem;
      text-align: left;
    }

    .verify-checking {
      color: #667eea;
      font-size: 0.85rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .mini-spinner {
      display: inline-block;
      width: 13px;
      height: 13px;
      border: 2px solid rgba(102,126,234,0.25);
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 0.65s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .verify-actions {
      margin-bottom: 1.25rem;
    }

    .btn-resend {
      background: #f0f4ff;
      border: 1.5px solid #d0d8ff;
      border-radius: 10px;
      color: #667eea;
      font-size: 0.875rem;
      font-weight: 600;
      padding: 0.55rem 1.25rem;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-resend:hover:not(:disabled) {
      background: #e4eaff;
    }

    .btn-resend:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .verify-skip a {
      color: #adb5bd;
      font-size: 0.825rem;
      text-decoration: none;
      transition: color 0.2s;
    }

    .verify-skip a:hover {
      color: #667eea;
    }
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
