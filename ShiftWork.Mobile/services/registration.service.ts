import { apiClient } from './api-client';

export interface CompanyRegistrationRequest {
  firebaseUid: string;
  userEmail: string;
  userDisplayName: string;
  companyName: string;
  companyEmail: string;
  companyPhone?: string;
  timeZone: string;
}

export interface CompanyRegistrationResponse {
  companyId: string;
  plan: string;
  onboardingStatus: string;
  adminUser: any;
}

export interface SandboxStatusResponse {
  hasSandboxData: boolean;
  sandboxPersonCount: number;
  sandboxAreaCount: number;
  sandboxLocationCount: number;
}

export interface PlanUpgradeRequest {
  stripePaymentMethodId: string;
  targetPlan: string;
}

export interface PlanUpgradeResponse {
  success: boolean;
  plan: string;
  message: string;
}

export const registrationService = {
  async register(request: CompanyRegistrationRequest): Promise<CompanyRegistrationResponse> {
    return apiClient.post<CompanyRegistrationResponse>('/api/auth/register', request);
  },

  async getSandboxStatus(companyId: string): Promise<SandboxStatusResponse> {
    return apiClient.get<SandboxStatusResponse>(`/api/companies/${companyId}/sandbox/status`);
  },

  async hideSandboxData(companyId: string): Promise<void> {
    return apiClient.post<void>(`/api/companies/${companyId}/sandbox/hide`, { entityTypes: ['All'] });
  },

  async resetSandboxData(companyId: string): Promise<void> {
    return apiClient.post<void>(`/api/companies/${companyId}/sandbox/reset`, {});
  },

  async deleteSandboxData(companyId: string): Promise<void> {
    return apiClient.post<void>(`/api/companies/${companyId}/sandbox/delete`, {});
  },

  async upgradePlan(companyId: string, request: PlanUpgradeRequest): Promise<PlanUpgradeResponse> {
    return apiClient.post<PlanUpgradeResponse>(`/api/companies/${companyId}/plan/upgrade`, request);
  },
};
