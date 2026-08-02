export type AnalyticsGroupBy = 'day' | 'week' | 'month' | 'person' | 'location' | 'area';

export interface AnalyticsFilter {
  from: string;   // ISO date
  to: string;     // ISO date
  locationId?: number | null;
  areaId?: number | null;
  personId?: number | null;
  groupBy: AnalyticsGroupBy;
}

export interface AnalyticsPoint {
  x: string;
  y: number;
}

export interface AnalyticsSeries {
  key: string;
  label: string;
  points: AnalyticsPoint[];
}

export interface AnalyticsResponse {
  series: AnalyticsSeries[];
  totals: Record<string, number>;
  dimension: string;
}

export interface AnalyticsKpi {
  key: string;
  value: number;
  previousValue: number;
  deltaPct: number;
  format: 'hours' | 'percent' | 'count';
}

export interface AnalyticsKpis {
  kpis: AnalyticsKpi[];
}

export interface AnalyticsDrilldownRow {
  day: string;
  personId: number;
  personName: string;
  locationId: number;
  locationName: string;
  scheduledHours: number;
  workedHours: number;
  varianceHours: number;
  status: string;
}

export interface AnalyticsDrilldownResult {
  rows: AnalyticsDrilldownRow[];
  total: number;
  page: number;
  pageSize: number;
}
