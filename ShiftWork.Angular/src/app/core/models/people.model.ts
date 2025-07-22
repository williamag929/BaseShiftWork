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
    //roles?: Role[];
 }