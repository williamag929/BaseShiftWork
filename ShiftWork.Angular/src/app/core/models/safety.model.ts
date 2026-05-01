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

export interface PersonAck {
  personId: number;
  name: string;
  acknowledgedAt?: string;
}

export interface AcknowledgmentStatus {
  totalAssigned: number;
  totalCompleted: number;
  completionRate: number;
  completed: PersonAck[];
  pending: PersonAck[];
}

export interface CreateSafetyContentDto {
  title: string;
  description: string;
  type: string;
  locationId?: number;
  contentUrl?: string;
  textContent?: string;
  thumbnailUrl?: string;
  durationMinutes?: number;
  isAcknowledgmentRequired: boolean;
  scheduledFor?: string;
  tags?: string[];
  status: string;
}

export type UpdateSafetyContentDto = CreateSafetyContentDto;

export interface AcknowledgeDto {
  notes?: string;
}
