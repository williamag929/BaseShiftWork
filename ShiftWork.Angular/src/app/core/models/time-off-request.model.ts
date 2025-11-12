export interface TimeOffRequest {
  timeOffRequestId: number;
  companyId: string | null;
  personId: number;
  personName?: string;
  type: string;
  startDate: Date;
  endDate: Date;
  isPartialDay: boolean;
  partialStartTime?: string;
  partialEndTime?: string;
  reason?: string;
  status: string;
  createdAt: Date;
  approvedBy?: number;
  approverName?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  hoursRequested?: number;
  ptoBalanceBefore?: number;
  ptoBalanceAfter?: number;
}

export interface CreateTimeOffRequest {
  personId: number;
  type: string;
  startDate: Date;
  endDate: Date;
  isPartialDay: boolean;
  partialStartTime?: string;
  partialEndTime?: string;
  reason?: string;
}
