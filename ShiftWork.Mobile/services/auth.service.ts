import { apiClient } from './api-client';
import type {
  PersonDto,
  PinVerificationRequest,
  PinVerificationResponse,
} from '../types/api';

// ── Types for API-based authentication (Firebase auth disabled) ────────────

export interface ApiLoginRequest {
  email: string;
  password: string;
}

export interface ApiLoginResponse {
  token: string;
  personId: number;
  companyId: string;
  email: string;
  name: string;
  photoUrl?: string | null;
}

export interface AcceptInviteRequest {
  token: string;
  companyId: string;
  personId: number;
  email: string;
  password: string;
}

export const authService = {
  /**
   * Login with email + password directly against the API (Firebase disabled).
   * Returns a signed JWT and basic person info on success.
   */
  async login(request: ApiLoginRequest): Promise<ApiLoginResponse> {
    return apiClient.post<ApiLoginResponse>('/api/auth/login', request);
  },

  /**
   * Accept an employee invite and set a mobile login password in one call.
   * The token + companyId + personId come from the invite link query params.
   * Returns a JWT so the user is immediately logged in.
   */
  async acceptInvite(request: AcceptInviteRequest): Promise<ApiLoginResponse> {
    return apiClient.post<ApiLoginResponse>('/api/auth/accept-invite', request);
  },

  /**
   * Set or update the API password for a Person.
   * Requires an active auth session (token must be stored first via login).
   */
  async setPassword(personId: number, password: string): Promise<void> {
    return apiClient.post('/api/auth/set-password', { personId, password });
  },

  /**
   * Get person by email
   */
  async getUserByEmail(email: string): Promise<PersonDto> {
    return apiClient.get<PersonDto>(`/api/auth/user/${email}`);
  },

  /**
   * Get current authenticated user from JWT token
   */
  async getCurrentUser(): Promise<PersonDto> {
    return apiClient.get<PersonDto>('/api/auth/user');
  },

  /**
   * Verify person's PIN
   */
  async verifyPin(request: PinVerificationRequest): Promise<PinVerificationResponse> {
    return apiClient.post<PinVerificationResponse>('/api/auth/verify-pin', request);
  },
};
