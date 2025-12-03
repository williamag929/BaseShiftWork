import { apiClient } from './api-client';

export interface TimeOffRequest {
  timeOffRequestId: number;
  companyId: string;
  personId: number;
  personName?: string;
  type: 'Vacation' | 'Sick' | 'PTO' | 'Unpaid' | 'Personal';
  startDate: string;
  endDate: string;
  isPartialDay: boolean;
  partialStartTime?: string;
  partialEndTime?: string;
  reason?: string;
  status: 'Pending' | 'Approved' | 'Denied' | 'Cancelled';
  createdAt: string;
  approvedBy?: number;
  approverName?: string;
  approvedAt?: string;
  approvalNotes?: string;
  hoursRequested?: number;
  ptoBalanceBefore?: number;
  ptoBalanceAfter?: number;
}

export interface CreateTimeOffRequest {
  personId: number;
  type: 'Vacation' | 'Sick' | 'PTO' | 'Unpaid' | 'Personal';
  startDate: string;
  endDate: string;
  isPartialDay?: boolean;
  partialStartTime?: string;
  partialEndTime?: string;
  reason?: string;
}

export interface PtoBalance {
  personId: number;
  balance: number;
  asOf: string;
}

class TimeOffRequestService {
  /**
   * Get all time off requests for a person
   */
  async getTimeOffRequests(
    companyId: string,
    personId: number,
    status?: 'Pending' | 'Approved' | 'Denied' | 'Cancelled'
  ): Promise<TimeOffRequest[]> {
    const params: any = { personId };
    if (status) {
      params.status = status;
    }
    try {
      const response = await apiClient.get<TimeOffRequest[]>(
        `/api/companies/${companyId}/timeoff-requests`,
        { params }
      );
      return response;
    } catch (err: any) {
      if (err?.statusCode === 404) return [];
      throw err;
    }
  }

  /**
   * Get a specific time off request
   */
  async getTimeOffRequest(
    companyId: string,
    personId: number,
    requestId: number
  ): Promise<TimeOffRequest> {
    const response = await apiClient.get<TimeOffRequest>(
      `/api/companies/${companyId}/timeoff-requests/${requestId}`
    );
    return response;
  }

  /**
   * Create a new time off request
   */
  async createTimeOffRequest(
    companyId: string,
    request: CreateTimeOffRequest
  ): Promise<TimeOffRequest> {
    const response = await apiClient.post<TimeOffRequest>(
      `/api/companies/${companyId}/timeoff-requests`,
      request
    );
    return response;
  }

  /**
   * Update a time off request (for employees before approval)
   */
  async updateTimeOffRequest(
    companyId: string,
    personId: number,
    requestId: number,
    request: Partial<CreateTimeOffRequest>
  ): Promise<TimeOffRequest> {
    const response = await apiClient.put<TimeOffRequest>(
      `/api/companies/${companyId}/timeoff-requests/${requestId}`,
      request
    );
    return response;
  }

  /**
   * Cancel a time off request
   */
  async cancelTimeOffRequest(
    companyId: string,
    personId: number,
    requestId: number
  ): Promise<void> {
    await apiClient.delete(
      `/api/companies/${companyId}/timeoff-requests/${requestId}`
    );
  }

  /**
   * Get PTO balance for a person
   */
  async getPtoBalance(
    companyId: string,
    personId: number,
    asOf?: Date
  ): Promise<PtoBalance> {
    const params = asOf ? { asOf: asOf.toISOString() } : {};
    const response = await apiClient.get<PtoBalance>(
      `/api/companies/${companyId}/pto/balance/${personId}`,
      { params }
    );
    return response;
  }

  /**
   * Get upcoming time off (next 30 days)
   */
  async getUpcomingTimeOff(
    companyId: string,
    personId: number
  ): Promise<TimeOffRequest[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + 30);

    const allRequests = await this.getTimeOffRequests(companyId, personId, 'Approved');
    return allRequests.filter(req => {
      const startDate = new Date(req.startDate);
      return startDate >= now && startDate <= future;
    });
  }

  /**
   * Get time off history (past 90 days)
   */
  async getTimeOffHistory(
    companyId: string,
    personId: number
  ): Promise<TimeOffRequest[]> {
    const now = new Date();
    const past = new Date();
    past.setDate(past.getDate() - 90);

    const allRequests = await this.getTimeOffRequests(companyId, personId);
    return allRequests
      .filter(req => {
        const endDate = new Date(req.endDate);
        return endDate >= past && endDate <= now;
      })
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
  }

  /**
   * Get pending time off requests
   */
  async getPendingTimeOff(
    companyId: string,
    personId: number
  ): Promise<TimeOffRequest[]> {
    return this.getTimeOffRequests(companyId, personId, 'Pending');
  }

  /**
   * Calculate business days between two dates (excluding weekends)
   */
  calculateBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }

  /**
   * Calculate hours requested (8 hours per business day by default)
   */
  calculateHoursRequested(
    startDate: Date,
    endDate: Date,
    isPartialDay: boolean = false,
    partialStartTime?: string,
    partialEndTime?: string
  ): number {
    if (isPartialDay && partialStartTime && partialEndTime) {
      // Calculate hours between start and end time
      const [startHour, startMin] = partialStartTime.split(':').map(Number);
      const [endHour, endMin] = partialEndTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      return (endMinutes - startMinutes) / 60;
    }
    
    const businessDays = this.calculateBusinessDays(startDate, endDate);
    return businessDays * 8; // 8 hours per business day
  }
}

export const timeOffRequestService = new TimeOffRequestService();
