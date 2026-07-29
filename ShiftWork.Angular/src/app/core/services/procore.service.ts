import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ProcoreConnection, ProcoreConnectionInput, ProcoreSyncResult } from '../models/procore-connection.model';

@Injectable({
  providedIn: 'root'
})
export class ProcoreService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  getConnection(companyId: string): Observable<ProcoreConnection | null> {
    return this.http.get<ProcoreConnection | null>(`${this.apiUrl}/companies/${companyId}/procore/connection`)
      .pipe(catchError(this.handleError));
  }

  saveConnection(companyId: string, input: ProcoreConnectionInput): Observable<ProcoreConnection> {
    return this.http.put<ProcoreConnection>(`${this.apiUrl}/companies/${companyId}/procore/connection`, input, this.getHttpOptions())
      .pipe(catchError(this.handleError));
  }

  testConnection(companyId: string): Observable<ProcoreSyncResult> {
    return this.http.post<ProcoreSyncResult>(`${this.apiUrl}/companies/${companyId}/procore/test`, {}, this.getHttpOptions())
      .pipe(catchError(this.handleError));
  }

  syncDailyReport(companyId: string, reportId: string): Observable<ProcoreSyncResult> {
    return this.http.post<ProcoreSyncResult>(`${this.apiUrl}/companies/${companyId}/procore/sync/daily-report/${reportId}`, {}, this.getHttpOptions())
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Unknown error!';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
