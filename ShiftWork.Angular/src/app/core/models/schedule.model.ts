export interface Schedule {
    scheduleId: number;
    name: string;
    companyId: string;
    personId: number;
    locationId: number;
    areaId: number;
    startDate: Date;
    endDate: Date;
    startTime: Date;
    endTime: Date;
    description?: string;
    status: string;
    settings?: {
        isRecurring: boolean;
        recurrencePattern?: string; // e.g., daily, weekly, monthly
        recurrenceEndDate?: Date;
    };
    color?: string; // For UI representation
    notes?: string; // Additional notes for the schedule
    timezone: string; // Timezone for the schedule
    externalCode?: string; // External reference code if applicable
    type?: string; // Type of schedule (e.g., shift, meeting, event)
 }