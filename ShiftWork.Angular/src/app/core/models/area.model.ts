export interface Area {
    areaId: number;
    name: string;
    companyId: string;
    locationId?: number | string;
    costCodeId?: number | null;
    status?: string; // Optional, if the area has a status
 }