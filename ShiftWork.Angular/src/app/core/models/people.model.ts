import { ScheduleDetail } from "./schedule-detail.model";

export interface People {
    personId: number;
    name: string;
    companyId: string;
    pin?: string;
    email: string;
    address?: string;
    city?: string;
    state?: string;
    region?: string;
    street?: string;
    building?: string;
    floor?: string;
    externalCode?: string;
    status?: string;
    photoUrl?: string;
    phoneNumber?: string;
    roleId?: number; // Optional, if the person has a role
    scheduleDetails?: ScheduleDetail[]; // Optional, if the person has associated schedule details
    
    // PTO configuration fields (optional)
    ptoAccrualRatePerMonth?: number;
    ptoStartingBalance?: number;
    ptoStartDate?: Date;
    ptoLastAccruedAt?: Date;
    //roles?: Role[];
 }