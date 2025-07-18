export interface Company {
    companyId: string;
    name: string;
    address: string;
    phoneNumber: string;
    email: string;
    website: string;
    timezone: string;
    externalCode?: string;
    currency?: string;
    logoUrl?: string;
 }