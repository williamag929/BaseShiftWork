import { apiClient } from './api-client';

export interface Document {
  documentId: string;
  companyId: string;
  locationId?: number;
  title: string;
  description?: string;
  type: string;
  mimeType: string;
  fileSize: number;
  version: string;
  tags?: string[];
  accessLevel: string;
  status: string;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends Document {
  presignedUrl: string;
  totalReads: number;
}

export const documentService = {
  async getDocuments(
    companyId: string,
    locationId?: number,
    type?: string,
    search?: string
  ): Promise<Document[]> {
    const params: Record<string, any> = {};
    if (locationId != null) params.locationId = locationId;
    if (type)               params.type = type;
    if (search)             params.search = search;
    return apiClient.get(`/api/companies/${companyId}/documents`, { params });
  },

  async getById(companyId: string, documentId: string): Promise<DocumentDetail> {
    return apiClient.get(`/api/companies/${companyId}/documents/${documentId}`);
  },
};
