import { apiClient } from './api-client';

export interface Bulletin {
  bulletinId: string;
  companyId: string;
  locationId?: number;
  title: string;
  content: string;
  type: string;
  priority: string;
  attachmentUrls?: string[];
  publishedAt: string;
  expiresAt?: string;
  status: string;
  createdByName: string;
  isReadByCurrentUser: boolean;
  totalReads: number;
  createdAt: string;
}

export interface CreateBulletinDto {
  title: string;
  content: string;
  type: string;
  priority: string;
  locationId?: number;
  expiresAt?: string;
  attachmentUrls?: string[];
  status: string;
}

export const bulletinService = {
  async getBulletins(companyId: string, locationId?: number, type?: string, status?: string): Promise<Bulletin[]> {
    const params: Record<string, any> = {};
    if (locationId != null) params.locationId = locationId;
    if (type)               params.type = type;
    if (status)             params.status = status;
    return apiClient.get(`/api/companies/${companyId}/bulletins`, { params });
  },

  async getUnread(companyId: string, urgentOnly = false): Promise<Bulletin[]> {
    return apiClient.get(`/api/companies/${companyId}/bulletins/unread`, {
      params: urgentOnly ? { urgentOnly: true } : {},
    });
  },

  async getById(companyId: string, bulletinId: string): Promise<Bulletin> {
    return apiClient.get(`/api/companies/${companyId}/bulletins/${bulletinId}`);
  },

  async markAsRead(companyId: string, bulletinId: string): Promise<void> {
    return apiClient.post(`/api/companies/${companyId}/bulletins/${bulletinId}/read`);
  },

  async create(companyId: string, dto: CreateBulletinDto): Promise<Bulletin> {
    return apiClient.post(`/api/companies/${companyId}/bulletins`, dto);
  },

  async archive(companyId: string, bulletinId: string): Promise<void> {
    return apiClient.delete(`/api/companies/${companyId}/bulletins/${bulletinId}`);
  },
};
