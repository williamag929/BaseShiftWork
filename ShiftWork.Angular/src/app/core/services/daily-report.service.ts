import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { DailyReport, ReportMedia, UpdateDailyReportDto } from '../models/daily-report.model';

@Injectable({
  providedIn: 'root'
})
export class DailyReportService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private get jsonOptions() {
    return { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) };
  }

  private base(companyId: string, locationId: number): string {
    return `${this.apiUrl}/companies/${companyId}/locations/${locationId}/daily-reports`;
  }

  getReports(
    companyId: string,
    locationId: number,
    startDate?: string,
    endDate?: string,
    status?: string
  ): Observable<DailyReport[]> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate)   params = params.set('endDate', endDate);
    if (status)    params = params.set('status', status);

    return this.http
      .get<DailyReport[]>(this.base(companyId, locationId), { params })
      .pipe(catchError(this.handleError));
  }

  getReport(companyId: string, locationId: number, date: string): Observable<DailyReport> {
    return this.http
      .get<DailyReport>(`${this.base(companyId, locationId)}/${date}`)
      .pipe(catchError(this.handleError));
  }

  updateReport(
    companyId: string,
    locationId: number,
    reportId: string,
    dto: UpdateDailyReportDto
  ): Observable<DailyReport> {
    return this.http
      .put<DailyReport>(`${this.base(companyId, locationId)}/${reportId}`, dto, this.jsonOptions)
      .pipe(catchError(this.handleError));
  }

  addMedia(
    companyId: string,
    locationId: number,
    reportId: string,
    file: File,
    mediaType: string,
    caption?: string,
    shiftEventId?: string
  ): Observable<ReportMedia> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('mediaType', mediaType);
    if (caption)      form.append('caption', caption);
    if (shiftEventId) form.append('shiftEventId', shiftEventId);

    return this.http
      .post<ReportMedia>(`${this.base(companyId, locationId)}/${reportId}/media`, form)
      .pipe(catchError(this.handleError));
  }

  removeMedia(
    companyId: string,
    locationId: number,
    reportId: string,
    mediaId: string
  ): Observable<void> {
    return this.http
      .delete<void>(`${this.base(companyId, locationId)}/${reportId}/media/${mediaId}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    const serverBody = typeof error.error === 'string' ? error.error : (error.error?.message ?? '');
    const message = `Error ${error.status}: ${serverBody || error.message}`;
    console.error(error);
    return throwError(() => new Error(message));
  }
}
