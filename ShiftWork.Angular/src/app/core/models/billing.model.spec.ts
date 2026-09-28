import { BillingSummary, billingBannerFor } from './billing.model';

const base: BillingSummary = {
  tier: 'Pro', isTrial: false, trialDaysRemaining: 0, trialEndsAt: null, subscriptionStatus: 'active',
  hasSubscription: true, currentPeriodEnd: null, employeeCount: 10, employeeCap: 100, canManageBilling: true
};

describe('billingBannerFor', () => {
  it('is null while billing info has not loaded', () => {
    expect(billingBannerFor(null)).toBeNull();
  });

  it('is null for a healthy paid company', () => {
    expect(billingBannerFor(base)).toBeNull();
  });

  it('warns when the trial has 3 days or fewer left', () => {
    expect(billingBannerFor({ ...base, isTrial: true, trialDaysRemaining: 3 })).toBe('trial');
    expect(billingBannerFor({ ...base, isTrial: true, trialDaysRemaining: 4 })).toBeNull();
  });

  it('warns when at or over the employee cap', () => {
    expect(billingBannerFor({ ...base, employeeCount: 100 })).toBe('limit');
    expect(billingBannerFor({ ...base, employeeCount: 120 })).toBe('limit');
  });

  it('never warns about a cap for unlimited plans', () => {
    expect(billingBannerFor({ ...base, tier: 'Business', employeeCap: null, employeeCount: 5000 })).toBeNull();
  });

  it('the cap warning wins over the trial warning', () => {
    expect(billingBannerFor({ ...base, isTrial: true, trialDaysRemaining: 1, employeeCount: 100 })).toBe('limit');
  });
});
