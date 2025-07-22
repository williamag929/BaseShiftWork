export interface Area {
    areaId: number;
    name: string;
    companyId: string;
    locationId?: string;
    status?: string; // Optional, if the area has a status
 }