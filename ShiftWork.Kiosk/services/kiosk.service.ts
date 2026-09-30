import apiClient from './api-client';
import type {
  KioskConfig,
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
      `/api/kiosk/${companyId}/locations`
    );
    return data;
  },

  /** Company default UI language ("en"/"es") for seeding the kiosk locale. */
  async getDefaultLanguage(companyId: string): Promise<string> {
    const { data } = await apiClient.get<{ defaultLanguage: string }>(
      `/api/kiosk/${companyId}/language`
    );
    return data.defaultLanguage;
  },

  /** Per-site PIN/photo switches for the enrolled location. */
  async getConfig(companyId: string, locationId: number): Promise<KioskConfig> {
    const { data } = await apiClient.get<KioskConfig>(
      `/api/kiosk/${companyId}/config`,
      { params: { locationId } }
    );
    return data;
  },

  /** Uploads a punch photo and returns its stored URL. */
  async uploadPhoto(companyId: string, uri: string): Promise<string> {
    const form = new FormData();
    form.append('file', { uri, name: 'punch.jpg', type: 'image/jpeg' } as unknown as Blob);
    const { data } = await apiClient.post<{ url: string }>(
      `/api/kiosk/${companyId}/photo`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30_000 }
    );
    return data.url;
  },

  async verifyPin(personId: number, pin: string): Promise<boolean> {
    // Short timeout: with no connection the PIN screen must fail fast, not spin for 15 s.
    const { data } = await apiClient.post<{ verified: boolean }>(
      '/api/auth/verify-pin',
      { personId, pin },
      { timeout: 5_000 }
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
