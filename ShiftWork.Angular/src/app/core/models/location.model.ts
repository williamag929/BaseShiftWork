export interface Location {
    locationId: number;
    name: string;
    address: string;
    city: string;
    state: string;
    region?: string;
    street?: string;
    building?: string;
    floor?: string;
    department?: string;
    country?: string;
    zipCode: string;
    geoCoordinates: {
      latitude: number;
      longitude: number;
    };
    ratioMax: string;
    phoneNumber?: string;
    email?: string;
    externalCode?: string;
    timezone?: string;
    status: string;
    companyId: string;
 }