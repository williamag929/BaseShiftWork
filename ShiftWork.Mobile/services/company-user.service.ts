import { apiClient } from './api-client';

export interface UserClaims {
  companyId: string;
  userId: string;
  roles: string[];
  permissions: string[];
  permissionsVersion: number;
}

export const companyUserService = {
  async getMyClaims(companyId: string): Promise<UserClaims> {
    return apiClient.get<UserClaims>(`/api/companies/${companyId}/users/me/claims`);
  },
};
