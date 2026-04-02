import apiClient from './api-client';
import type {
  KioskEmployee,
  KioskQuestion,
  KioskClockRequest,
  KioskClockResponse,
  KioskLocation,
  KioskUserProfile,
} from '@/types';

export const kioskService = {
  /** Look up a user by email to resolve their companyId automatically. */
  async getUserByEmail(email: string): Promise<KioskUserProfile> {
    const { data } = await apiClient.get<KioskUserProfile>(
      `/api/auth/user/${encodeURIComponent(email)}`
    );
    return data;
  },

  async getEmployees(companyId: string): Promise<KioskEmployee[]> {
    const { data } = await apiClient.get<KioskEmployee[]>(
      `/api/kiosk/${companyId}/employees`
    );
    return data;
  },

  async getQuestions(companyId: string): Promise<KioskQuestion[]> {
    const { data } = await apiClient.get<KioskQuestion[]>(
      `/api/kiosk/${companyId}/questions`
    );
    return data;
  },

  async getLocations(companyId: string): Promise<KioskLocation[]> {
    const { data } = await apiClient.get<KioskLocation[]>(
      `/api/companies/${companyId}/locations`
    );
    return data;
  },

  async verifyPin(personId: number, pin: string): Promise<boolean> {
    const { data } = await apiClient.post<{ verified: boolean }>(
      '/api/auth/verify-pin',
      { personId, pin }
    );
    return data.verified;
  },

  async verifyAdminPassword(companyId: string, password: string): Promise<void> {
    const { data } = await apiClient.post<{ verified: boolean }>(
      `/api/kiosk/${companyId}/verify-admin-password`,
      { password }
    );
    if (!data.verified) throw new Error('Invalid admin password');
  },

  async clock(
    companyId: string,
    request: KioskClockRequest
  ): Promise<KioskClockResponse> {
    const { data } = await apiClient.post<KioskClockResponse>(
      `/api/kiosk/${companyId}/clock`,
      request
    );
    return data;
  },
};
