import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, BehaviorSubject } from 'rxjs';
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
});
