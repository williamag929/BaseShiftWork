// Schedule Grid specific types for the calendar view

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
  locationName?: string;
  areaName?: string;
  status: 'published' | 'unpublished' | 'locked' | 'open';
  isLocked?: boolean;
}

export interface DaySchedule {
  date: Date;
  dayName: string; // e.g., "Wed 5"
  unavailableCount: number;
  shifts: ShiftBlock[];
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
