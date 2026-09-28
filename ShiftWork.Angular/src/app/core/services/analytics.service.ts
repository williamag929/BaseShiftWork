import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AnalyticsFilter,
  AnalyticsResponse,
  AnalyticsKpis,
  AnalyticsDrilldownResult,
} from '../models/analytics.model';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private base(companyId: string) {
    return `${this.apiUrl}/companies/${companyId}/analytics`;
  }

  private params(filter: AnalyticsFilter): HttpParams {
    let p = new HttpParams().set('from', filter.from).set('to', filter.to).set('groupBy', filter.groupBy);
    if (filter.locationId != null) p = p.set('locationId', String(filter.locationId));
    if (filter.areaId != null) p = p.set('areaId', String(filter.areaId));
    if (filter.personId != null) p = p.set('personId', String(filter.personId));
    return p;
  }

  hoursSummary(companyId: string, filter: AnalyticsFilter): Observable<AnalyticsResponse> {
    return this.http
      .get<AnalyticsResponse>(`${this.base(companyId)}/hours-summary`, { params: this.params(filter) })
      .pipe(catchError(this.handleError));
  }

  scheduleCoverage(companyId: string, filter: AnalyticsFilter): Observable<AnalyticsResponse> {
    return this.http
      .get<AnalyticsResponse>(`${this.base(companyId)}/schedule-coverage`, { params: this.params(filter) })
      .pipe(catchError(this.handleError));
  }

  attendance(companyId: string, filter: AnalyticsFilter): Observable<AnalyticsResponse> {
    return this.http
      .get<AnalyticsResponse>(`${this.base(companyId)}/attendance`, { params: this.params(filter) })
      .pipe(catchError(this.handleError));
  }

  variance(companyId: string, filter: AnalyticsFilter): Observable<AnalyticsResponse> {
    return this.http
      .get<AnalyticsResponse>(`${this.base(companyId)}/variance`, { params: this.params(filter) })
      .pipe(catchError(this.handleError));
  }

  kpis(companyId: string, filter: AnalyticsFilter): Observable<AnalyticsKpis> {
    return this.http
      .get<AnalyticsKpis>(`${this.base(companyId)}/kpis`, { params: this.params(filter) })
      .pipe(catchError(this.handleError));
  }

  drilldown(
    companyId: string,
    filter: AnalyticsFilter,
    bucket?: string | null,
    page = 1,
    pageSize = 25
  ): Observable<AnalyticsDrilldownResult> {
    let params = this.params(filter).set('page', String(page)).set('pageSize', String(pageSize));
    if (bucket) params = params.set('bucket', bucket);
    return this.http
      .get<AnalyticsDrilldownResult>(`${this.base(companyId)}/drilldown`, { params })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    const serverBody = typeof error.error === 'string' ? error.error : error.error?.message ?? '';
    console.error(error);
    return throwError(() => new Error(`Error ${error.status}: ${serverBody || error.message}`));
  }
}
