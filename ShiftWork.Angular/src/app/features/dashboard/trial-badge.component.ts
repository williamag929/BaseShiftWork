import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BillingService, CompanyBillingInfo } from '../../core/services/billing.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-trial-badge',
  template: `
    <div *ngIf="billingInfo && shouldShowBadge()"
         [ngClass]="getAlertClass()"
         class="trial-badge">
      <span class="badge-icon">⏰</span>
      <span class="badge-text">
        {{ billingInfo.trialDaysRemaining }} day{{ billingInfo.trialDaysRemaining !== 1 ? 's' : '' }} left in trial
      </span>
      <button *ngIf="billingInfo.plan === 'Free'"
              class="badge-action"
              routerLink="/dashboard/upgrade">
        Upgrade Now
      </button>
    </div>
  `,
  styles: [`
    .trial-badge {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 4px;
      font-size: 0.9rem;
      font-weight: 500;
      margin-bottom: 1rem;
    }

    .trial-badge.info {
      background-color: #d1ecf1;
      color: #0c5460;
      border: 1px solid #bee5eb;
    }

    .trial-badge.warning {
      background-color: #fff3cd;
      color: #856404;
      border: 1px solid #ffeeba;
    }

    .trial-badge.danger {
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }

    .badge-icon {
      font-size: 1.1rem;
    }

    .badge-text {
      flex: 1;
    }

    .badge-action {
      padding: 0.4rem 0.8rem;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      transition: background-color 0.2s;
    }

    .badge-action:hover {
      background-color: #0056b3;
    }

    .warning .badge-action {
      background-color: #ffc107;
      color: #333;
    }

    .warning .badge-action:hover {
      background-color: #e0a800;
    }

    .danger .badge-action {
      background-color: #dc3545;
    }

    .danger .badge-action:hover {
      background-color: #c82333;
    }
  `]
})
export class TrialBadgeComponent implements OnInit {
  @Input() billingInfo: CompanyBillingInfo | null = null;

  constructor(private billingService: BillingService) {}

  ngOnInit(): void {
    if (!this.billingInfo) {
      this.billingService.billingInfo$.subscribe(info => {
        this.billingInfo = info;
      });
    }
  }

  shouldShowBadge(): boolean {
    return !!this.billingInfo &&
           this.billingInfo.plan === 'Free' &&
           this.billingInfo.trialDaysRemaining > 0 &&
           !this.billingInfo.isTrialExpired;
  }

  getAlertClass(): string {
    if (!this.billingInfo) return '';

    if (this.billingInfo.trialDaysRemaining <= 0) {
      return 'danger';
    } else if (this.billingInfo.trialDaysRemaining <= 3) {
      return 'danger';
    } else if (this.billingInfo.trialDaysRemaining <= 7) {
      return 'warning';
    }
    return 'info';
  }
}
