import { apiClient } from './api-client';

export interface ReportMedia {
  mediaId: string;
  mediaType: string;
  mediaUrl: string;
  caption?: string;
  personId: number;
  personName?: string;
  uploadedAt: string;
}

export interface DailyReport {
  reportId: string;
  companyId: string;
  locationId: number;
  reportDate: string;
  weatherData?: any;
  notes?: string;
  totalEmployees: number;
  totalHours: number;
  status: string;
  submittedByPersonId?: number;
  media: ReportMedia[];
  createdAt: string;
  updatedAt: string;
}

export const dailyReportService = {
  async getReport(companyId: string, locationId: number, date: string): Promise<DailyReport> {
    return apiClient.get(
      `/api/companies/${companyId}/locations/${locationId}/daily-reports/${date}`
    );
  },

  async updateReport(
    companyId: string,
    locationId: number,
    reportId: string,
    notes: string | null,
    status: string
  ): Promise<DailyReport> {
    return apiClient.put(
      `/api/companies/${companyId}/locations/${locationId}/daily-reports/${reportId}`,
      { notes, status }
    );
  },

  async addNoteText(
    companyId: string,
    locationId: number,
    reportId: string,
    text: string
  ): Promise<ReportMedia> {
    const formData = new FormData();
    const blob = new Blob([text], { type: 'text/plain' });
    formData.append('file', blob as any, `note_${Date.now()}.txt`);
    formData.append('mediaType', 'Note');
    formData.append('caption', text);
    return apiClient.post(
      `/api/companies/${companyId}/locations/${locationId}/daily-reports/${reportId}/media`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  async addMedia(
    companyId: string,
    locationId: number,
    reportId: string,
    file: { uri: string; name: string; type: string },
    mediaType: string,
    caption?: string
  ): Promise<ReportMedia> {
    const formData = new FormData();
    formData.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    formData.append('mediaType', mediaType);
    if (caption) formData.append('caption', caption);
    return apiClient.post(
      `/api/companies/${companyId}/locations/${locationId}/daily-reports/${reportId}/media`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
};
