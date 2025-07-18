export interface People {
    personId: number;
    name: string;
    companyId: string;
    phoneNumber: string;
    email: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    externalCode?: string;
    status?: string;
    photoUrl?: string;
    //roles?: Role[];
 }