export interface CostCode {
  costCodeId: number;
  companyId: string;
  code: string;
  name: string;
  description?: string;
  locationId?: number | null;
  externalCode?: string | null;
  status?: string;
}
