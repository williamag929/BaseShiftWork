import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ScheduleShift } from '../models/schedule-shift.model';
import { ReplacementCandidate } from '../models/replacement-candidate.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ScheduleShiftService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  getScheduleShifts(companyId: string): Observable<ScheduleShift[]> {
    return this.http.get<ScheduleShift[]>(`${this.apiUrl}/companies/${companyId}/scheduleshifts`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getScheduleShift(companyId: string, id: number): Observable<ScheduleShift> {
    return this.http.get<ScheduleShift>(`${this.apiUrl}/companies/${companyId}/scheduleshifts/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  createScheduleShift(companyId: string, scheduleShift: ScheduleShift): Observable<ScheduleShift> {
    return this.http.post<ScheduleShift>(`${this.apiUrl}/companies/${companyId}/scheduleshifts`, scheduleShift, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  updateScheduleShift(companyId: string, id: number, scheduleShift: ScheduleShift): Observable<ScheduleShift> {
    return this.http.put<ScheduleShift>(`${this.apiUrl}/companies/${companyId}/scheduleshifts/${id}`, scheduleShift, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteScheduleShift(companyId: string, id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/companies/${companyId}/scheduleshifts/${id}`, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  getReplacementCandidatesByWindow(
    companyId: string,
    start: Date,
    end: Date,
    locationId?: number,
    areaId?: number,
    excludePersonId?: number
  ): Observable<ReplacementCandidate[]> {
    const params = new URLSearchParams();
    params.set('start', start.toISOString());
    params.set('end', end.toISOString());
    if (locationId != null) params.set('locationId', String(locationId));
    if (areaId != null) params.set('areaId', String(areaId));
    if (excludePersonId != null) params.set('excludePersonId', String(excludePersonId));
    const url = `${this.apiUrl}/companies/${companyId}/scheduleshifts/replacement-candidates?${params.toString()}`;
    return this.http.get<ReplacementCandidate[]>(url).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Unknown error!';
    if (error.error instanceof ErrorEvent) {
      // Client-side errors
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side errors
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
