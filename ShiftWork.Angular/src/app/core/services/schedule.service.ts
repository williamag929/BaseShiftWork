import { Injectable } from '@angular/core';
import { Schedule } from '../models/schedule.model';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ScheduleService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  getSchedules(companyId: string): Observable<Schedule[]> {
    return this.http.get<Schedule[]>(`${this.apiUrl}/companies/${companyId}/schedules`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getSchedule(companyId: string, id: number): Observable<Schedule> {
    return this.http.get<Schedule>(`${this.apiUrl}/companies/${companyId}/schedules/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  createSchedule(companyId: string, schedule: Schedule): Observable<Schedule> {
    return this.http.post<Schedule>(`${this.apiUrl}/companies/${companyId}/schedules`, schedule, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  updateSchedule(companyId: string, id: number, schedule: Schedule): Observable<Schedule> {
    return this.http.put<Schedule>(`${this.apiUrl}/companies/${companyId}/schedules/${id}`, schedule, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteSchedule(companyId: string, id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/companies/${companyId}/schedules/${id}`, this.getHttpOptions())
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
