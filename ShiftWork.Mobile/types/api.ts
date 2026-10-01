// API DTOs matching ShiftWork.Api backend models

export interface PersonDto {
  personId: number;
  companyId: string;
  name: string;
  email: string;
  phoneNumber?: string;
  photoUrl?: string;
  pin?: string;
  preferredLanguage?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleDto {
  scheduleId: number;
  companyId: string;
  personId: number;
  locationId: number;
  areaId: number;
  startDate: Date;
  endDate: Date;
  status: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleShiftDto {
  scheduleShiftId: number;
  scheduleId: number;
  companyId: string;
  locationId: number;
  areaId: number;
  personId: number;
  startDate: Date;
  endDate: Date;
  status: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ShiftEventTypes = {
  ClockIn: 'clockin',
  ClockOut: 'clockout',
  BreakStart: 'break_start',
  BreakEnd: 'break_end',
} as const;

export type ShiftEventType = typeof ShiftEventTypes[keyof typeof ShiftEventTypes];

export interface ShiftEventDto {
  eventLogId: string;
  eventDate: Date;
  eventType: ShiftEventType;
  companyId: string;
  personId: number;
  scheduleShiftId?: number;
  description?: string;
  kioskDevice?: string;
  geoLocation?: string;
  photoUrl?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  /** Job site checked against for geofencing. Resolved server-side from today's schedule if omitted. */
  locationId?: number;
  /** Output only: "Inside" | "Outside" | "Unknown". */
  geofenceStatus?: string;
  geofenceDistanceMeters?: number;
}

export type CredentialExpiryStatus = 'Valid' | 'ExpiringSoon' | 'Expired';

export interface CredentialDto {
  credentialId: string;
  companyId: string;
  personId: number;
  personName: string;
  name: string;
  type?: string;
  issuingAuthority?: string;
  credentialNumber?: string;
  issueDate?: string;
  expiryDate: string;
  expiryStatus: CredentialExpiryStatus;
  hasDocument: boolean;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LocationDto {
  locationId: number;
  companyId: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  /** Phone punches at this site must come from an NFC tag tap. */
  requireNfc?: boolean;
  /** Set when the site has a tag link (https://t.loqzen.com/t/<nfcTagKey>). */
  nfcTagKey?: string | null;
}

export interface AreaDto {
  areaId: number;
  companyId: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface KioskQuestionDto {
  questionId: number;
  companyId: string;
  locationId?: number;
  questionText: string;
  questionType: 'text' | 'yes_no' | 'multiple_choice';
  options?: string[];
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
}

export interface KioskAnswerDto {
  answerId?: number;
  questionId: number;
  personId: number;
  companyId: string;
  eventLogId: string;
  answerText: string;
  answeredAt: Date;
}

export interface CompanyDto {
  companyId: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  isActive: boolean;
}

export interface RoleDto {
  roleId: number;
  companyId: string;
  name: string;
  description?: string;
  isActive: boolean;
}

// Request/Response types
export interface PinVerificationRequest {
  personId: number;
  pin: string;
}

export interface PinVerificationResponse {
  verified: boolean;
  message?: string;
}

export interface ScheduleSearchParams {
  personId?: number;
  locationId?: number;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages?: number;
}

// API Response wrapper
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

// Error response
export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  statusCode: number;
}

export interface NfcPunchRequest {
  tagKey: string;
  /** Client-generated; reused on retry so a saved punch is never recorded twice. */
  eventLogId: string;
  /** Tap time, ISO UTC. */
  eventDate: string;
  geoLocation?: string;
  device?: string;
}

export interface NfcPunchResult {
  eventLogId: string;
  eventType: 'clockin' | 'clockout';
  eventDate: string;
  locationId: number;
  locationName: string;
  /** "Inside" | "Outside" | "Unknown" */
  geofenceStatus: string;
  /** True when the tap repeated a punch from the last minute and recorded nothing new. */
  repeated: boolean;
}

export interface NfcTagLink {
  locationId: number;
  name: string;
  requireNfc: boolean;
  tagUrl: string | null;
  nfcLastTappedAt: string | null;
}
