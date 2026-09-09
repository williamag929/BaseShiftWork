import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ActiveSiteStatus } from '../models/active-site-status.model';
import { ShiftEvent } from '../models/shift-event.model';

@Injectable({
  providedIn: 'root'
})
export class ActiveSiteService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getActiveSiteStatus(companyId: string): Observable<ActiveSiteStatus[]> {
    return this.http.get<ActiveSiteStatus[]>(`${this.apiUrl}/companies/${companyId}/locations/active-status`)
      .pipe(
        catchError(this.handleError)
      );
  }

  reviewGeofenceFlag(companyId: string, eventLogId: string, reviewerPersonId?: number): Observable<ShiftEvent> {
    const params: Record<string, string> = {};
    if (reviewerPersonId != null) {
      params['reviewerPersonId'] = String(reviewerPersonId);
    }
    return this.http.patch<ShiftEvent>(
      `${this.apiUrl}/companies/${companyId}/shiftevents/${eventLogId}/review-geofence`,
      {},
      { params }
    ).pipe(
      catchError(this.handleError)
    );
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
