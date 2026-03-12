import { apiClient } from './api-client';

export interface CompanySummary {
  companyId: string;
  name: string;
  email?: string;
  phone?: string;
  logoUrl?: string;
}

class CompanyService {
  /** Returns all companies the current user belongs to (based on CompanyUser.Uid in JWT). */
  async getMyCompanies(): Promise<CompanySummary[]> {
    return apiClient.get<CompanySummary[]>('/api/companies/my');
  }
}

export const companyService = new CompanyService();
