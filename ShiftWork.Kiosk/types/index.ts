// ─── Domain types shared across the kiosk app ────────────────────────────────

export interface KioskEmployee {
  personId: number;
  name: string;
  photoUrl?: string;
  statusShiftWork?: string; // "OnShift" | "OffShift" | etc.
}

export interface KioskQuestion {
  questionId: number;
  companyId: string;
  questionText: string;
  questionType: 'text' | 'yes_no' | 'multiple_choice';
  options?: string[];
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
}

export interface KioskAnswer {
  kioskQuestionId: number;
  answerText: string;
}

export interface KioskLocation {
  locationId: number;
  companyId: string;
  name: string;
  address?: string;
  isActive: boolean;
}

export type ClockEventType = 'ClockIn' | 'ClockOut';

export interface KioskClockRequest {
  personId: number;
  eventType: ClockEventType;
  locationId?: number;
  photoUrl?: string;
  geoLocation?: string;
  kioskDevice: string;
  answers?: KioskAnswer[];
}

export interface KioskClockResponse {
  eventLogId: string;
  eventType: ClockEventType;
  eventDate: string;
  personName: string;
}

// ─── Device enrollment stored in SecureStore ─────────────────────────────────

export interface DeviceEnrollment {
  companyId: string;
  locationId: number;
  locationName: string;
  kioskDeviceId: string;
}

// ─── User profile returned by /api/auth/user/{email} ────────────────────────

export interface KioskUserProfile {
  personId: number;
  name: string;
  email: string;
  companyId: string;
}

// ─── Per-transaction kiosk session (reset after success) ─────────────────────

export interface KioskSession {
  employee: KioskEmployee | null;
  clockType: ClockEventType | null;
  capturedPhotoUri: string | null;
  geoLocation: string | null;
}
