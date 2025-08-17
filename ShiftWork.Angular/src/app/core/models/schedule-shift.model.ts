export interface ScheduleShift {
    scheduleShiftId?: number;
    scheduleId?: number;
    companyId: string;
    locationId: number;
    areaId: number;
    personId: number;
    taskShiftId?: number;
    startDate: Date;
    endDate: Date;
    breakDuration?: number; // in minutes
    geoLocation?: {
        latitude: number;   
        longitude: number;
    };
    notes?: string;
    status: string;
}