import { apiClient } from './api-client';

export interface SafetyContent {
  safetyContentId: string;
  companyId: string;
  locationId?: number;
  title: string;
  description: string;
  type: string;
  contentUrl?: string;
  textContent?: string;
  thumbnailUrl?: string;
  durationMinutes?: number;
  isAcknowledgmentRequired: boolean;
  scheduledFor?: string;
  tags?: string[];
  status: string;
  createdByName: string;
  isAcknowledgedByCurrentUser: boolean;
  createdAt: string;
}

export interface AcknowledgmentStatus {
  totalAssigned: number;
  totalCompleted: number;
  completionRate: number;
  completed: { personId: number; name: string; acknowledgedAt?: string }[];
  pending:   { personId: number; name: string; acknowledgedAt?: string }[];
}

export const safetyService = {
  async getContents(companyId: string, locationId?: number, type?: string): Promise<SafetyContent[]> {
    const params: Record<string, any> = {};
    if (locationId != null) params.locationId = locationId;
    if (type)               params.type = type;
    return apiClient.get(`/api/companies/${companyId}/safety`, { params });
  },

  async getPending(companyId: string): Promise<SafetyContent[]> {
    return apiClient.get(`/api/companies/${companyId}/safety/pending`);
  },

  async getById(companyId: string, safetyContentId: string): Promise<SafetyContent> {
    return apiClient.get(`/api/companies/${companyId}/safety/${safetyContentId}`);
  },

  async acknowledge(companyId: string, safetyContentId: string, notes?: string): Promise<void> {
    return apiClient.post(`/api/companies/${companyId}/safety/${safetyContentId}/acknowledge`, { notes });
  },
};
