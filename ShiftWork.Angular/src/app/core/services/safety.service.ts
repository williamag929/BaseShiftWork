import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  SafetyContent,
  AcknowledgmentStatus,
  CreateSafetyContentDto,
  UpdateSafetyContentDto,
  AcknowledgeDto
} from '../models/safety.model';

@Injectable({
  providedIn: 'root'
})
export class SafetyService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private get jsonOptions() {
    return { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) };
  }

  private base(companyId: string): string {
    return `${this.apiUrl}/companies/${companyId}/safety`;
  }

  getContents(
    companyId: string,
    locationId?: number,
    type?: string,
    status?: string
  ): Observable<SafetyContent[]> {
    let params = new HttpParams();
    if (locationId != null) params = params.set('locationId', locationId.toString());
    if (type)               params = params.set('type', type);
    if (status)             params = params.set('status', status);

    return this.http
      .get<SafetyContent[]>(this.base(companyId), { params })
      .pipe(catchError(this.handleError));
  }

  getPending(companyId: string): Observable<SafetyContent[]> {
    return this.http
      .get<SafetyContent[]>(`${this.base(companyId)}/pending`)
      .pipe(catchError(this.handleError));
  }

  getContent(companyId: string, safetyContentId: string): Observable<SafetyContent> {
    return this.http
      .get<SafetyContent>(`${this.base(companyId)}/${safetyContentId}`)
      .pipe(catchError(this.handleError));
  }

  createContent(companyId: string, dto: CreateSafetyContentDto): Observable<SafetyContent> {
    return this.http
      .post<SafetyContent>(this.base(companyId), dto, this.jsonOptions)
      .pipe(catchError(this.handleError));
  }

  updateContent(
    companyId: string,
    safetyContentId: string,
    dto: UpdateSafetyContentDto
  ): Observable<SafetyContent> {
    return this.http
      .put<SafetyContent>(`${this.base(companyId)}/${safetyContentId}`, dto, this.jsonOptions)
      .pipe(catchError(this.handleError));
  }

  archiveContent(companyId: string, safetyContentId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.base(companyId)}/${safetyContentId}`)
      .pipe(catchError(this.handleError));
  }

  acknowledge(companyId: string, safetyContentId: string, dto: AcknowledgeDto = {}): Observable<void> {
    return this.http
      .post<void>(`${this.base(companyId)}/${safetyContentId}/acknowledge`, dto, this.jsonOptions)
      .pipe(catchError(this.handleError));
  }

  getAcknowledgmentStatus(companyId: string, safetyContentId: string): Observable<AcknowledgmentStatus> {
    return this.http
      .get<AcknowledgmentStatus>(`${this.base(companyId)}/${safetyContentId}/acknowledgments`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    const serverBody = typeof error.error === 'string' ? error.error : (error.error?.message ?? '');
    const message = `Error ${error.status}: ${serverBody || error.message}`;
    console.error(error);
    return throwError(() => new Error(message));
  }
}
