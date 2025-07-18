import { Injectable } from '@angular/core';
import { People } from '../models/people.model';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PeopleService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  getPeople(companyId: string): Observable<People[]> {
    return this.http.get<People[]>(`${this.apiUrl}/companies/${companyId}/people`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getPerson(companyId: string, id: number): Observable<People> {
    return this.http.get<People>(`${this.apiUrl}/companies/${companyId}/people/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  createPerson(companyId: string, person: People): Observable<People> {
    return this.http.post<People>(`${this.apiUrl}/companies/${companyId}/people`, person, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  updatePerson(companyId: string, id: number, person: People): Observable<People> {
    return this.http.put<People>(`${this.apiUrl}/companies/${companyId}/people/${id}`, person, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  deletePerson(companyId: string, id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/companies/${companyId}/people/${id}`, this.getHttpOptions())
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