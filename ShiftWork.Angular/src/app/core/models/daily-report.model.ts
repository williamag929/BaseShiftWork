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

export interface UpdateDailyReportDto {
  notes?: string;
  status: string;
}
