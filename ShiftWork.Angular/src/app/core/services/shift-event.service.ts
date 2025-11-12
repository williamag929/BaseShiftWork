import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ShiftEvent } from '../models/shift-event.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ShiftEventService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  getShiftEvents(companyId: string): Observable<ShiftEvent[]> {
    return this.http.get<ShiftEvent[]>(`${this.apiUrl}/companies/${companyId}/shiftevents`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getShiftEvent(companyId: string, eventLogId: string): Observable<ShiftEvent> {
    return this.http.get<ShiftEvent>(`${this.apiUrl}/companies/${companyId}/shiftevents/${eventLogId}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  createShiftEvent(companyId: string, shiftEvent: ShiftEvent): Observable<ShiftEvent> {
    return this.http.post<ShiftEvent>(`${this.apiUrl}/companies/${companyId}/shiftevents`, shiftEvent, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  updateShiftEvent(companyId: string, eventLogId: string, shiftEvent: ShiftEvent): Observable<ShiftEvent> {
    return this.http.put<ShiftEvent>(`${this.apiUrl}/companies/${companyId}/shiftevents/${eventLogId}`, shiftEvent, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteShiftEvent(companyId: string, eventLogId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/companies/${companyId}/shiftevents/${eventLogId}`, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  getShiftEventsByPersonId(companyId: string, personId: number): Observable<ShiftEvent[]> {
    return this.http.get<ShiftEvent[]>(`${this.apiUrl}/companies/${companyId}/shiftevents/person/${personId}`)
      .pipe(
        catchError(this.handleError)
      );
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
