export interface Schedule {
    scheduleId: number;
    name: string;
    companyId: string;
    personId: number;
    crewId?: number; // Optional, if the schedule is associated with a crew
    taskShiftId?: number; // Optional, if the schedule is associated with a task or shift
    locationId: number;
    areaId: number;
    startDate: Date;
    endDate: Date;
    //startTime: Date;
    //endTime: Date;
    description?: string;
    status: string;
    settings?: {
        isRecurring: boolean;
        recurrencePattern?: string; // e.g., daily, weekly, monthly
        recurrenceEndDate?: Date;
    };
    color?: string; // For UI representation
    //notes?: string; // Additional notes for the schedule
    timezone: string; // Timezone for the schedule
    externalCode?: string; // External reference code if applicable
    type?: string; // Type of schedule (e.g., shift, meeting, event)
 }