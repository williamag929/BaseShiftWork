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
