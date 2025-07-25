export interface People {
    personId: number;
    name: string;
    companyId: string;
    phoneNumber: string;
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
    roleId?: number; // Optional, if the person has a role
    //roles?: Role[];
 }