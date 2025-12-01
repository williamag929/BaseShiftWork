// API DTOs matching ShiftWork.Api backend models

export interface PersonDto {
  personId: number;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  pin?: string;
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

export interface ShiftEventDto {
  eventLogId: string;
  eventDate: Date;
  eventType: 'clockin' | 'clockout' | 'break_start' | 'break_end';
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
