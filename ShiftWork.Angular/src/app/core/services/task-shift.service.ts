import { Injectable } from '@angular/core';
import { TaskShift } from '../models/task-shift.model';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TaskShiftService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  getTaskShifts(companyId: string): Observable<TaskShift[]> {
    return this.http.get<TaskShift[]>(`${this.apiUrl}/companies/${companyId}/taskshifts`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getTaskShift(companyId: string, id: number): Observable<TaskShift> {
    return this.http.get<TaskShift>(`${this.apiUrl}/companies/${companyId}/taskshifts/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  createTaskShift(companyId: string, taskShift: TaskShift): Observable<TaskShift> {
    return this.http.post<TaskShift>(`${this.apiUrl}/companies/${companyId}/taskshifts`, taskShift, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  updateTaskShift(companyId: string, id: number, taskShift: TaskShift): Observable<TaskShift> {
    return this.http.put<TaskShift>(`${this.apiUrl}/companies/${companyId}/taskshifts/${id}`, taskShift, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteTaskShift(companyId: string, id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/companies/${companyId}/taskshifts/${id}`, this.getHttpOptions())
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
