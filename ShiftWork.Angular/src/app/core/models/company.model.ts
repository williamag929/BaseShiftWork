export interface Company {
    companyId: string;
    name: string;
    address: string;
    phoneNumber: string;
    email: string;
    website: string;
    timeZone: string;
    externalCode?: string;
    currency?: string;
    logoUrl?: string;
 }