// Auth state types
export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  token: string;
}

export interface AuthState {
  user: AuthUser | null;
  person: PersonDto | null;
  companyId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// App state types
export interface ClockState {
  isClockingIn: boolean;
  lastClockEvent?: ShiftEventDto;
  currentShift?: ScheduleShiftDto;
}

export interface ScheduleState {
  selectedDate: Date;
  viewMode: 'day' | 'week' | 'month';
  schedules: ScheduleDto[];
  shifts: ScheduleShiftDto[];
}

// Navigation types
export type RootStackParamList = {
  '(auth)': undefined;
  '(tabs)': undefined;
  'login': undefined;
  'pin-verify': { personId: number };
  'dashboard': undefined;
  'schedule': undefined;
  'clock': undefined;
  'profile': undefined;
};

// Import PersonDto and other types
import type {
  PersonDto,
  ScheduleDto,
  ScheduleShiftDto,
  ShiftEventDto,
} from './api';
