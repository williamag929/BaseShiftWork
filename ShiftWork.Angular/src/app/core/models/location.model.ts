export interface Location {
    locationId: number;
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    geoCoordinates: {
      latitude: number;
      longitude: number;
    };
    ratioMax: string;
    phoneNumber: string;
    email: string;
    externalCode: string;
    timezone: string;
    status: string;
    companyId: string;
 }