export interface Role {
    roleId: number;
    name: string;
    description?: string;
    permissions: string[]; // Array of permission strings
    status: string; // e.g., active, inactive
    companyId: string;    
 }