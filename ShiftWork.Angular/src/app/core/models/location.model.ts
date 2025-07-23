import { GeoCoordinate } from "./geo-coordinate.model";

export interface Location {
    locationId: number;
    name: string;
    companyId: string;
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
    geoCoordinates: GeoCoordinate;
    ratioMax: number;
    phoneNumber?: string;
    email?: string;
    externalCode?: string;
    timezone?: string;
    status: string;
 }