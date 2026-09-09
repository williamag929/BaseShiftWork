import { apiClient } from './api-client';
import type { CredentialDto } from '../types/api';

export const credentialService = {
  /**
   * Get the employee's own credentials (read-only — only managers can create/edit via Angular).
   */
  async getMyCredentials(companyId: string, personId: number): Promise<CredentialDto[]> {
    return apiClient.get<CredentialDto[]>(
      `/api/companies/${companyId}/credentials/person/${personId}`,
      { params: { noCacheBust: true } }
    );
  },
};
