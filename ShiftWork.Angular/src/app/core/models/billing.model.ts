export type PaidTier = 'Starter' | 'Pro' | 'Business';

export interface BillingSummary {
  tier: 'Free' | PaidTier;
  isTrial: boolean;
  trialDaysRemaining: number;
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
  hasSubscription: boolean;
  currentPeriodEnd: string | null;
  employeeCount: number;
  employeeCap: number | null;
  canManageBilling: boolean;
}

export type BillingBanner = 'trial' | 'limit';

/** The cap warning wins: a full roster blocks work today, an ending trial only blocks it later. */
export function billingBannerFor(s: BillingSummary | null): BillingBanner | null {
  if (!s) return null;
  if (s.employeeCap !== null && s.employeeCount >= s.employeeCap) return 'limit';
  if (s.isTrial && s.trialDaysRemaining <= 3) return 'trial';
  return null;
}
