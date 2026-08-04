import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { PlanService, PlanUpgradeRequest } from '../../core/services/plan.service';
import { BillingService, CompanyBillingInfo } from '../../core/services/billing.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

// Type definitions for Stripe
declare const Stripe: any;

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  selector: 'app-upgrade',
  templateUrl: './upgrade.component.html',
  styleUrls: ['./upgrade.component.css']
})
export class UpgradeComponent implements OnInit, AfterViewInit {
  @ViewChild('cardElement') cardElement!: ElementRef;

  upgradeForm: FormGroup;
  isLoading = false;
  isProcessing = false;
  stripe: any;
  elements: any;
  cardElementInstance: any;

  successMessage = '';
  errorMessage = '';
  featureBlockedTitle = '';
  featureBlockedMessage = '';
  companyId = '';
  currentPlan = '';
  billingInfo: CompanyBillingInfo | null = null;

  proPricePerMonth = 5; // $ per employee per month
  estimatedMonthly = 50; // Default estimate for 10 employees

  constructor(
    private fb: FormBuilder,
    private planService: PlanService,
    private billingService: BillingService,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService
  ) {
    this.upgradeForm = this.fb.group({
      cardholderName: ['', [Validators.required, Validators.minLength(2)]],
      cardholderEmail: ['', [Validators.required, Validators.email]],
      agreeToTerms: [false, Validators.requiredTrue]
    });
  }

  ngOnInit(): void {
    this.companyId = this.authService.activeCompany?.companyId || '';
    this.currentPlan = this.authService.activeCompany?.plan || 'Free';

    if (!this.companyId) {
      this.errorMessage = 'No active company found. Please sign in again.';
      setTimeout(() => this.router.navigate(['/dashboard']), 2000);
      return;
    }

    // Check for feature-blocked message from guard
    this.featureBlockedTitle = sessionStorage.getItem('featureBlockedTitle') || '';
    this.featureBlockedMessage = sessionStorage.getItem('featureBlockedMessage') || '';
    sessionStorage.removeItem('featureBlockedTitle');
    sessionStorage.removeItem('featureBlockedMessage');

    if (this.featureBlockedTitle) {
      this.errorMessage = this.featureBlockedMessage;
    }

    // Load billing info
    this.billingService.getBillingInfo(this.companyId).subscribe({
      next: (info) => {
        this.billingInfo = info;
        this.billingService.billingInfoSubject.next(info);
      },
      error: (error) => console.error('Failed to load billing info:', error)
    });

    // Initialize Stripe
    this.initializeStripe();
  }

  ngAfterViewInit(): void {
    this.mountCardElement();
  }

  private initializeStripe(): void {
    const publishableKey = environment.stripePublishableKey;
    if (!publishableKey) {
      this.errorMessage = 'Stripe is not configured. Please contact support.';
      return;
    }

    this.stripe = Stripe(publishableKey);
    this.elements = this.stripe.elements();
  }

  private mountCardElement(): void {
    if (!this.elements || !this.cardElement) return;

    try {
      this.cardElementInstance = this.elements.create('card', {
        style: {
          base: {
            fontSize: '16px',
            color: '#424770',
            '::placeholder': { color: '#aab7c4' }
          },
          invalid: {
            color: '#fa755a'
          }
        }
      });
      this.cardElementInstance.mount(this.cardElement.nativeElement);

      // Handle real-time validation errors
      this.cardElementInstance.addEventListener('change', (event: any) => {
        if (event.error) {
          this.errorMessage = event.error.message;
        } else {
          this.errorMessage = '';
        }
      });
    } catch (error) {
      console.error('Failed to mount card element:', error);
      this.errorMessage = 'Failed to load payment form. Please refresh and try again.';
    }
  }

  async upgradeToPro(): Promise<void> {
    if (!this.upgradeForm.valid) {
      this.toastr.error('Please fill out all required fields.');
      return;
    }

    this.isProcessing = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      // Step 1: Create payment method from card details
      const { token, error } = await this.stripe.createToken(this.cardElementInstance, {
        name: this.upgradeForm.get('cardholderName')?.value,
        email: this.upgradeForm.get('cardholderEmail')?.value
      });

      if (error) {
        this.errorMessage = error.message || 'Failed to process card.';
        this.isProcessing = false;
        return;
      }

      if (!token) {
        this.errorMessage = 'Failed to create payment token. Please try again.';
        this.isProcessing = false;
        return;
      }

      // Step 2: Call backend to create subscription
      const request: PlanUpgradeRequest = {
        stripePaymentMethodId: token.id,
        targetPlan: 'Pro'
      };

      this.planService.upgradePlan(this.companyId, request).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = '🎉 Upgrade successful! Your Pro plan is now active.';
            this.toastr.success('Upgrade complete!');
            // Redirect to dashboard after 3 seconds
            setTimeout(() => this.router.navigate(['/dashboard']), 3000);
          } else {
            this.errorMessage = response.message || 'Upgrade failed. Please try again.';
            this.toastr.error(this.errorMessage);
          }
          this.isProcessing = false;
        },
        error: (error) => {
          console.error('Upgrade error:', error);
          this.errorMessage = error.error?.message || 'An error occurred during upgrade. Please try again.';
          this.toastr.error(this.errorMessage);
          this.isProcessing = false;
        }
      });
    } catch (error: any) {
      console.error('Unexpected error:', error);
      this.errorMessage = error.message || 'An unexpected error occurred.';
      this.isProcessing = false;
    }
  }

  cancel(): void {
    this.router.navigate(['/dashboard']);
  }
}
