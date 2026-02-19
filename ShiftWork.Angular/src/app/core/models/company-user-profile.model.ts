export interface CompanyUserProfile {
  profileId: number;
  companyUserId: string;
  companyId: string;
  roleId: number;
  personId?: number;
  isActive: boolean;
  assignedAt: Date;
  assignedBy?: string;
  lastUpdatedAt?: Date;
  lastUpdatedBy?: string;
  
  // Navigation properties
  role?: any;
  person?: any;
  companyUser?: any;
}

export interface AssignRoleRequest {
  companyUserId: string;
  roleId: number;
  personId?: number;
}

export interface AssignRoleToPersonRequest {
  personId: number;
  roleId: number;
}
