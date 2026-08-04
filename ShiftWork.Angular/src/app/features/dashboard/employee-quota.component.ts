import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompanyBillingInfo } from '../../core/services/billing.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-employee-quota',
  template: `
    <div *ngIf="billingInfo" class="quota-card">
      <div class="quota-header">
        <h4>Employee Quota</h4>
        <span class="plan-badge" [ngClass]="billingInfo.plan.toLowerCase()">
          {{ billingInfo.plan }}
        </span>
      </div>

      <div class="quota-bar">
        <div class="quota-fill" [style.width.%]="getQuotaPercentage()"></div>
      </div>

      <div class="quota-stats">
        <div class="stat">
          <span class="label">Current:</span>
          <span class="value">{{ billingInfo.employeeCount }}</span>
        </div>
        <div class="stat">
          <span class="label">Limit:</span>
          <span class="value">
            {{ billingInfo.employeeLimit === 2147483647 ? 'Unlimited' : billingInfo.employeeLimit }}
          </span>
        </div>
      </div>

      <div *ngIf="isQuotaFull()" class="quota-warning">
        ⚠️ You've reached your employee limit. Upgrade to add more employees.
      </div>

      <div *ngIf="isQuotaNearFull()" class="quota-caution">
        ℹ️ {{ getRemainingSlots() }} employee slot{{ getRemainingSlots() !== 1 ? 's' : '' }} remaining.
      </div>
    </div>
  `,
  styles: [`
    .quota-card {
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 1rem;
      margin-bottom: 1.5rem;
    }

    .quota-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .quota-header h4 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #333;
    }

    .plan-badge {
      padding: 0.3rem 0.6rem;
      border-radius: 3px;
      font-size: 0.8rem;
      font-weight: 600;
      color: white;
    }

    .plan-badge.free {
      background-color: #6c757d;
    }

    .plan-badge.pro {
      background-color: #28a745;
    }

    .quota-bar {
      height: 8px;
      background-color: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 1rem;
    }

    .quota-fill {
      height: 100%;
      background-color: #007bff;
      transition: width 0.3s ease;
    }

    .quota-stats {
      display: flex;
      gap: 2rem;
      margin-bottom: 1rem;
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .stat .label {
      font-size: 0.85rem;
      color: #666;
      font-weight: 500;
    }

    .stat .value {
      font-size: 1.3rem;
      font-weight: 700;
      color: #333;
    }

    .quota-warning {
      padding: 0.75rem;
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
      border-radius: 3px;
      font-size: 0.9rem;
    }

    .quota-caution {
      padding: 0.75rem;
      background-color: #fff3cd;
      color: #856404;
      border: 1px solid #ffeeba;
      border-radius: 3px;
      font-size: 0.9rem;
    }
  `]
})
export class EmployeeQuotaComponent implements OnInit {
  @Input() billingInfo: CompanyBillingInfo | null = null;

  ngOnInit(): void {}

  getQuotaPercentage(): number {
    if (!this.billingInfo) return 0;
    if (this.billingInfo.employeeLimit === 2147483647) return 0; // Unlimited
    return Math.min(100, (this.billingInfo.employeeCount / this.billingInfo.employeeLimit) * 100);
  }

  isQuotaFull(): boolean {
    if (!this.billingInfo) return false;
    return this.billingInfo.employeeCount >= this.billingInfo.employeeLimit;
  }

  isQuotaNearFull(): boolean {
    if (!this.billingInfo) return false;
    const percentage = (this.billingInfo.employeeCount / this.billingInfo.employeeLimit) * 100;
    return percentage >= 80 && percentage < 100;
  }

  getRemainingSlots(): number {
    if (!this.billingInfo || this.billingInfo.employeeLimit === 2147483647) return 0;
    return Math.max(0, this.billingInfo.employeeLimit - this.billingInfo.employeeCount);
  }
}
