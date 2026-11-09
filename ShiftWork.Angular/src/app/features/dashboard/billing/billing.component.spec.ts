import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { BillingComponent } from './billing.component';
import { BillingService } from 'src/app/core/services/billing.service';
import { BillingSummary } from 'src/app/core/models/billing.model';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';

const trial: BillingSummary = {
  tier: 'Pro', isTrial: true, trialDaysRemaining: 9, trialEndsAt: null, subscriptionStatus: null,
  hasSubscription: false, currentPeriodEnd: null, employeeCount: 3, employeeCap: 100, canManageBilling: true
};

describe('BillingComponent', () => {
  let fixture: ComponentFixture<BillingComponent>;
  let billing: jasmine.SpyObj<BillingService>;
  let toastr: jasmine.SpyObj<ToastrService>;
  let query: BehaviorSubject<any>;

  function setup(summary: BillingSummary, params: Record<string, string> = {}) {
    query = new BehaviorSubject(convertToParamMap(params));
    billing = jasmine.createSpyObj('BillingService', ['getSummary', 'refresh', 'startCheckout', 'openPortal', 'redirect']);
    toastr = jasmine.createSpyObj('ToastrService', ['success', 'info', 'error']);
    billing.getSummary.and.returnValue(of(summary));
    billing.startCheckout.and.returnValue(of('https://checkout.stripe.com/x'));
    billing.openPortal.and.returnValue(of('https://billing.stripe.com/p'));
    TestBed.configureTestingModule({
      imports: [BillingComponent, NoopAnimationsModule],
      providers: [
        { provide: BillingService, useValue: billing },
        { provide: ActivatedRoute, useValue: { queryParamMap: query } },
        { provide: ToastrService, useValue: toastr },
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'co-1' } }] })
      ]
    });
    fixture = TestBed.createComponent(BillingComponent);
    fixture.detectChanges();
  }

  it('shows trial countdown and usage', () => {
    setup(trial);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('9');
    expect(text).toContain('3 / 100');
  });

  it('Choose plan starts Checkout and redirects', () => {
    setup(trial);
    fixture.componentInstance.choose('Starter');
    expect(billing.startCheckout).toHaveBeenCalledWith('co-1', 'Starter');
    expect(billing.redirect).toHaveBeenCalledWith('https://checkout.stripe.com/x');
  });

  it('subscribed company sees Manage billing instead of tier buttons', () => {
    setup({ ...trial, tier: 'Starter', isTrial: false, hasSubscription: true, subscriptionStatus: 'active' });
    expect(fixture.nativeElement.querySelector('[data-test=manage-billing]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-test=choose-Starter]')).toBeNull();
    fixture.componentInstance.manage();
    expect(billing.redirect).toHaveBeenCalledWith('https://billing.stripe.com/p');
  });

  it('hides billing actions without permission', () => {
    setup({ ...trial, canManageBilling: false });
    expect(fixture.nativeElement.querySelector('[data-test=choose-Pro]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test=manage-billing]')).toBeNull();
  });

  it('polls after checkout=success until the subscription is active', fakeAsync(() => {
    setup(trial, { checkout: 'success' });
    billing.getSummary.and.returnValue(of({ ...trial, tier: 'Pro', isTrial: false, hasSubscription: true, subscriptionStatus: 'active' }));
    tick(2000);
    expect(fixture.componentInstance.summary?.subscriptionStatus).toBe('active');
    expect(fixture.componentInstance.awaitingPayment).toBeFalse();
    discardPeriodicTasks();
  }));

  it('shows a toast when checkout was canceled', () => {
    setup(trial, { checkout: 'cancel' });
    expect(toastr.info).toHaveBeenCalled();
  });

  it('renders one h1 through lz-page-header and the plan inside an lz-panel with a state chip', () => {
    setup(trial);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('lz-page-header h1')!.textContent).toContain('Plan and billing');
    const panel = el.querySelector('lz-panel')!;
    expect(panel.querySelector('[data-test=plan-tier]')!.textContent).toContain('Pro');
    expect(panel.querySelector('lz-status-chip')!.textContent!.trim()).toBe('Trial');
    expect(el.querySelector('mat-card, .billing, .tier-card')).toBeNull();
  });

  it('has exactly one primary button whether choosing a plan or managing billing', () => {
    setup(trial);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('[variant="primary"]').length).toBe(1);
    expect(el.querySelector('[variant="primary"]')!.getAttribute('data-test')).toBe('choose-Pro');
    TestBed.resetTestingModule();
    setup({ ...trial, tier: 'Starter', isTrial: false, hasSubscription: true, subscriptionStatus: 'active' });
    const el2 = fixture.nativeElement as HTMLElement;
    expect(el2.querySelectorAll('[variant="primary"]').length).toBe(1);
    expect(el2.querySelector('lz-status-chip')!.textContent!.trim()).toBe('Active');
  });

  it('shows a past-due plan with a danger state chip', () => {
    setup({ ...trial, isTrial: false, hasSubscription: true, subscriptionStatus: 'past_due' });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('lz-status-chip')!.textContent!.trim()).toBe('Past due');
    expect(el.textContent).toContain('Payment failed');
  });

  it('shows an alert, not a blank page, when the summary cannot load', () => {
    setup(trial);
    TestBed.resetTestingModule();
    query = new BehaviorSubject(convertToParamMap({}));
    billing = jasmine.createSpyObj('BillingService', ['getSummary', 'refresh', 'startCheckout', 'openPortal', 'redirect']);
    toastr = jasmine.createSpyObj('ToastrService', ['success', 'info', 'error']);
    billing.getSummary.and.returnValue(throwError(() => ({ error: {} })));
    TestBed.configureTestingModule({
      imports: [BillingComponent, NoopAnimationsModule],
      providers: [
        { provide: BillingService, useValue: billing },
        { provide: ActivatedRoute, useValue: { queryParamMap: query } },
        { provide: ToastrService, useValue: toastr },
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'co-1' } }] })
      ]
    });
    fixture = TestBed.createComponent(BillingComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('lz-alert[role="alert"]')!.textContent).toContain('Billing is unavailable');
    expect(toastr.error).toHaveBeenCalledWith('Billing is unavailable right now. Please try again.');
  });

  it('exposes the usage bar as a labelled progressbar and keeps targets at least 48px', () => {
    setup(trial);
    const el = fixture.nativeElement as HTMLElement;
    const bar = el.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar.getAttribute('aria-label')).toBe('Employee usage');
    expect(bar.getAttribute('aria-valuenow')).toBe('3');
    expect((el.querySelector('[data-test=choose-Pro]') as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect(getComputedStyle(el.querySelector('h1')!).fontSize).toBe('26px');
  });
});
