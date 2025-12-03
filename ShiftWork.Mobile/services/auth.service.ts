import { apiClient } from './api-client';
import type {
  PersonDto,
  PinVerificationRequest,
  PinVerificationResponse,
} from '../types/api';

export const authService = {
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
