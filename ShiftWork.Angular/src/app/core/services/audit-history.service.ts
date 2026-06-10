import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  AuditHistoryDto,
  AuditHistoryPagedResult,
  AuditSummaryDto,
  AuditHistoryParams
} from '../models/audit-history.model';

@Injectable({
  providedIn: 'root'
})
export class AuditHistoryService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get audit history for a specific entity
   * @param params Audit history query parameters
   */
  getAuditHistoryForEntity(params: AuditHistoryParams): Observable<AuditHistoryPagedResult> {
    const { companyId, entityName, entityId, actionType, startDate, endDate, page = 1, pageSize = 20 } = params;
    
    let httpParams = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (actionType) {
      httpParams = httpParams.set('actionType', actionType);
    }
    if (startDate) {
      httpParams = httpParams.set('startDate', startDate.toISOString().split('T')[0]);
    }
    if (endDate) {
      httpParams = httpParams.set('endDate', endDate.toISOString().split('T')[0]);
    }

    return this.http.get<AuditHistoryPagedResult>(
      `${this.apiUrl}/companies/${companyId}/audit-history/${entityName}/${entityId}`,
      { params: httpParams }
    );
  }

  /**
   * Get related audit history (shifts, schedules for an employee)
   * @param companyId Company ID
   * @param entityName Entity type (e.g., 'Person')
   * @param entityId Entity ID
   */
  getRelatedAuditHistory(
    companyId: string,
    entityName: string,
    entityId: string,
    months: number = 3
  ): Observable<AuditHistoryDto[]> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const params = new HttpParams()
      .set('startDate', startDate.toISOString().split('T')[0])
      .set('pageSize', '1000');

    return this.http.get<AuditHistoryDto[]>(
      `${this.apiUrl}/companies/${companyId}/audit-history/${entityName}/${entityId}/related`,
      { params }
    );
  }

  /**
   * Get audit summary for a company
   * @param companyId Company ID
   * @param startDate Start date filter
   * @param endDate End date filter
   */
  getAuditSummary(
    companyId: string,
    startDate?: Date,
    endDate?: Date
  ): Observable<AuditSummaryDto[]> {
    let params = new HttpParams();

    if (startDate) {
      params = params.set('startDate', startDate.toISOString().split('T')[0]);
    }
    if (endDate) {
      params = params.set('endDate', endDate.toISOString().split('T')[0]);
    }

    return this.http.get<AuditSummaryDto[]>(
      `${this.apiUrl}/companies/${companyId}/audit-history/summary`,
      { params }
    );
  }

  /**
   * Get changes for a specific field
   * @param companyId Company ID
   * @param entityName Entity type
   * @param entityId Entity ID
   * @param fieldName Field name
   */
  getFieldHistory(
    companyId: string,
    entityName: string,
    entityId: string,
    fieldName: string
  ): Observable<AuditHistoryDto[]> {
    const params = new HttpParams()
      .set('fieldName', fieldName)
      .set('pageSize', '1000');

    return this.http.get<AuditHistoryDto[]>(
      `${this.apiUrl}/companies/${companyId}/audit-history/${entityName}/${entityId}`,
      { params }
    );
  }
}
