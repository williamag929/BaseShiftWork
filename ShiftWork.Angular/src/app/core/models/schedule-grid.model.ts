// Schedule Grid specific interfaces

/** View mode for the schedule grid location dropdown */
export type ViewMode = 'single' | 'grouped' | 'all';

export interface TeamMember {
  personId: number;
  initials: string;
  fullName: string;
  totalHours: string; // e.g., "41h"
  profilePhotoUrl?: string;
}

export interface ShiftBlock {
  scheduleShiftId: number;
  personId: number;
  personName: string;
  startTime: string; // e.g., "7am"
  endTime: string; // e.g., "3:30pm"
  startDate: Date;
  endDate: Date;
  locationId?: number;
  locationName?: string;
  areaName?: string;
  status: 'published' | 'unpublished' | 'locked' | 'open';
  isLocked?: boolean;
  // UI helpers
  isOnShiftNow?: boolean; // true when person is currently OnShift and within this block's time window
  isCompleted?: boolean;  // true when the shift's end time is in the past (completed)
}

export interface DaySchedule {
  date: Date;
  dayName: string; // e.g., "Wed 5"
  unavailableCount: number;
  shifts: ShiftBlock[];
}

/** A location section for grouped view mode */
export interface LocationGroup {
  locationId: number;
  locationName: string;
  teamMembers: TeamMember[];
  days: DaySchedule[];
}

export interface ScheduleGridData {
  weekStart: Date;
  weekEnd: Date;
  locationName: string;
  teamMembers: TeamMember[];
  days: DaySchedule[];
  stats: {
    empty: number;
    unpublished: number;
    published: number;
    requireConfirmation: number;
    openShifts: number;
    warnings: number;
    leaveApproved: number;
    leavePending: number;
    unavailable: number;
  };
}

export interface ScheduleFilters {
  searchQuery?: string;
  shiftTypes?: string[]; // e.g., ["Empty", "Open"]
  trainingTypes?: string[]; // e.g., ["Cash handling", "Forklift"]
  sortBy?: 'name' | 'hours' | 'availability';
}
