/**
 * Audit History Models
 * Used for displaying change history across the application
 */

export interface AuditHistoryDto {
  id: string;
  entityName: string;
  entityId: string;
  actionType: 'Created' | 'Updated' | 'Deleted';
  actionDate: Date | string;
  userId: string;
  userName?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  description?: string;
  metadata?: string;
}

export interface AuditHistoryParams {
  companyId: string;
  entityName?: string;
  entityId?: string;
  actionType?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface AuditHistoryPagedResult {
  items: AuditHistoryDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditSummaryDto {
  entityName: string;
  totalChanges: number;
  lastModified: Date | string;
  lastModifiedBy: string;
}

export enum AuditActionType {
  Created = 'Created',
  Updated = 'Updated',
  Deleted = 'Deleted'
}

export enum AuditEntityType {
  Person = 'Person',
  Schedule = 'Schedule',
  ScheduleShift = 'ScheduleShift',
  Location = 'Location',
  ShiftEvent = 'ShiftEvent',
  Task = 'Task',
  TaskShift = 'TaskShift',
  Department = 'Department',
  Position = 'Position',
  Note = 'Note',
  Notification = 'Notification'
}
