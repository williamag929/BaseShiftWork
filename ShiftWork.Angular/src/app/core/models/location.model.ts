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
    requirePin?: boolean;
    requirePhoto?: boolean;
    requireNfc?: boolean;
    /** Server-owned; the tag link is https://t.loqzen.com/t/<nfcTagKey>. */
    nfcTagKey?: string | null;
    nfcLastTappedAt?: string | null;
 }