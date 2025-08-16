export interface Employee {
  personId:number;
  firstName?:string;
  lastName?:string;
  managerId?:number;
  isManager: boolean;
  isSchedule: boolean;
  documentNumber?:string;
  createdDate?:Date;
  email?:string;
  phoneNumber?:number;
  mainAddress?:string;
  ManagerId?: number;
  companyId: string;
  isActive: boolean;
  status: string;
  fullName: string;
    // ... other properties
  }