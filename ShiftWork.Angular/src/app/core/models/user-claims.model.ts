export interface UserClaims {
  companyId: string;
  userId: string;
  roles: string[];
  permissions: string[];
  permissionsVersion: number;
}
