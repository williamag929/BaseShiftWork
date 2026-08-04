import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { BillingService } from '../services/billing.service';

@Injectable({
  providedIn: 'root'
})
export class FeatureAccessGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private billingService: BillingService,
    private router: Router
  ) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    const requiredPlan = route.data['requiredPlan'] as string | undefined;

    if (!requiredPlan) {
      return true;
    }

    const company = this.authService.activeCompany;
    if (!company) {
      this.router.navigate(['/sign-in']);
      return false;
    }

    // Check if trial has expired
    const billingInfo = this.billingService.getCurrentBillingInfo();
    if (billingInfo?.isTrialExpired && billingInfo?.plan === 'Free') {
      this.showUpgradeRequired('Trial expired', 'Your free trial has ended. Please upgrade to continue.');
      return false;
    }

    if (requiredPlan === 'Pro' && company.plan !== 'Pro') {
      this.showUpgradeRequired(
        'Pro feature',
        `This feature requires the Pro plan. Upgrade now to unlock it.`
      );
      return false;
    }

    return true;
  }

  private showUpgradeRequired(title: string, message: string): void {
    // Store message in sessionStorage so the component can display it
    sessionStorage.setItem('featureBlockedTitle', title);
    sessionStorage.setItem('featureBlockedMessage', message);
    this.router.navigate(['/dashboard/upgrade']);
  }
}
