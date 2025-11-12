export interface ReplacementRequest {
  requestId: number;
  shiftId: number;
  companyId?: string;
  initiatedBy?: number;
  status: string; // Open, Accepted, Cancelled
  createdAt: string;
  acceptedBy?: number;
  acceptedAt?: string;
  notes?: string;
}

export interface CreateReplacementRequest {
  shiftId: number;
  notes?: string;
}

export interface NotifyReplacementDto {
  personIds: number[];
  channel?: 'push' | 'sms' | 'email';
}
