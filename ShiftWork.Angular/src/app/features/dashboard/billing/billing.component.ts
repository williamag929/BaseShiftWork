import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subscription, filter, interval, switchMap, take, takeWhile } from 'rxjs';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { BillingService } from 'src/app/core/services/billing.service';
import { BillingSummary, PaidTier } from 'src/app/core/models/billing.model';

interface TierCard { tier: PaidTier; cap: string; blurb: string; }

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule],
  templateUrl: './billing.component.html',
  styleUrls: ['./billing.component.css']
})
export class BillingComponent implements OnInit, OnDestroy {
  summary: BillingSummary | null = null;
  companyId = '';
  busy = false;
  awaitingPayment = false;
  readonly tiers: TierCard[] = [
    { tier: 'Starter', cap: '25', blurb: $localize`:@@billing.tier_starter_blurb:Small crews getting organized` },
    { tier: 'Pro', cap: '100', blurb: $localize`:@@billing.tier_pro_blurb:Analytics, multi-location and exports` },
    { tier: 'Business', cap: '∞', blurb: $localize`:@@billing.tier_business_blurb:Unlimited employees` }
  ];
  private subs = new Subscription();

  constructor(
    private billing: BillingService,
    private route: ActivatedRoute,
    private store: Store<AppState>,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.subs.add(this.store.select(selectActiveCompany).pipe(filter((c: any) => !!c?.companyId), take(1)).subscribe((c: any) => {
      this.companyId = c.companyId;
      this.load();
      this.subs.add(this.route.queryParamMap.pipe(take(1)).subscribe(p => {
        if (p.get('checkout') === 'success') this.waitForActivation();
        if (p.get('checkout') === 'cancel') this.toastr.info($localize`:@@billing.checkout_canceled:Checkout canceled. No charge was made.`);
      }));
    }));
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  get usagePercent(): number {
    const s = this.summary;
    return s?.employeeCap ? Math.min(100, (s.employeeCount / s.employeeCap) * 100) : 0;
  }

  choose(tier: PaidTier): void {
    this.busy = true;
    this.billing.startCheckout(this.companyId, tier).subscribe({
      next: url => this.billing.redirect(url),
      error: err => this.fail(err)
    });
  }

  manage(): void {
    this.busy = true;
    this.billing.openPortal(this.companyId).subscribe({
      next: url => this.billing.redirect(url),
      error: err => this.fail(err)
    });
  }

  private load(): void {
    this.billing.getSummary(this.companyId).subscribe({
      next: s => { this.summary = s; this.billing.refresh(this.companyId); },
      error: err => this.fail(err)
    });
  }

  // Stripe confirms payment via webhook a moment after redirecting back, so poll briefly instead of showing a stale plan.
  private waitForActivation(): void {
    this.awaitingPayment = true;
    this.toastr.success($localize`:@@billing.payment_received:Payment received. Activating your plan…`);
    this.subs.add(interval(2000).pipe(
      take(10),
      switchMap(() => this.billing.getSummary(this.companyId)),
      takeWhile(s => s.subscriptionStatus !== 'active', true)
    ).subscribe({
      next: s => { this.summary = s; if (s.subscriptionStatus === 'active') { this.awaitingPayment = false; this.billing.refresh(this.companyId); } },
      complete: () => (this.awaitingPayment = false)
    }));
  }

  private fail(err: any): void {
    this.busy = false;
    this.toastr.error(err?.error?.message ?? $localize`:@@billing.error_generic:Billing is unavailable right now. Please try again.`);
  }
}
