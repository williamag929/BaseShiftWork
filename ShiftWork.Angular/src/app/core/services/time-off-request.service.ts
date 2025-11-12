import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TimeOffRequest, CreateTimeOffRequest } from '../models/time-off-request.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TimeOffRequestService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  getTimeOffRequests(
    companyId: string,
    personId?: number,
    status?: string,
    startDate?: Date,
    endDate?: Date
  ): Observable<TimeOffRequest[]> {
    let params = new HttpParams();
    if (personId) params = params.set('personId', personId.toString());
    if (status) params = params.set('status', status);
    if (startDate) params = params.set('startDate', startDate.toISOString());
    if (endDate) params = params.set('endDate', endDate.toISOString());

    return this.http.get<TimeOffRequest[]>(
      `${this.apiUrl}/companies/${companyId}/timeoff-requests`,
      { ...this.getHttpOptions(), params }
    ).pipe(catchError(this.handleError));
  }

  getTimeOffRequest(companyId: string, requestId: number): Observable<TimeOffRequest> {
    return this.http.get<TimeOffRequest>(
      `${this.apiUrl}/companies/${companyId}/timeoff-requests/${requestId}`,
      this.getHttpOptions()
    ).pipe(catchError(this.handleError));
  }

  createTimeOffRequest(companyId: string, request: CreateTimeOffRequest): Observable<TimeOffRequest> {
    return this.http.post<TimeOffRequest>(
      `${this.apiUrl}/companies/${companyId}/timeoff-requests`,
      request,
      this.getHttpOptions()
    ).pipe(catchError(this.handleError));
  }

  approveTimeOffRequest(
    companyId: string,
    requestId: number,
    approved: boolean,
    notes?: string,
    approverId?: number
  ): Observable<TimeOffRequest> {
    let params = new HttpParams();
    if (approverId) params = params.set('approverId', approverId.toString());

    return this.http.patch<TimeOffRequest>(
      `${this.apiUrl}/companies/${companyId}/timeoff-requests/${requestId}/approve`,
      { approved, notes },
      { ...this.getHttpOptions(), params }
    ).pipe(catchError(this.handleError));
  }

  cancelTimeOffRequest(companyId: string, requestId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/companies/${companyId}/timeoff-requests/${requestId}`,
      this.getHttpOptions()
    ).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Unknown error!';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      if (error.error && typeof error.error === 'string') {
        errorMessage += `\nDetails: ${error.error}`;
      }
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
