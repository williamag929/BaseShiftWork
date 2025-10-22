import { Injectable } from '@angular/core';
import { People } from '../models/people.model';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
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

  getPeople(companyId: string, pageNumber = 1, pageSize = 10, searchQuery = ''): Observable<People[]> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());
    if (searchQuery) {
      params = params.set('searchQuery', searchQuery);
    }

    return this.http.get<People[]>(`${this.apiUrl}/companies/${companyId}/People`, { params })
      .pipe(
        catchError(this.handleError)
      );
  }

  getPerson(companyId: string, id: number): Observable<People> {
    return this.http.get<People>(`${this.apiUrl}/companies/${companyId}/People/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  createPerson(companyId: string, person: People): Observable<People> {
    return this.http.post<People>(`${this.apiUrl}/companies/${companyId}/People`, person, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  updatePerson(companyId: string, id: number, person: People): Observable<People> {
    return this.http.put<People>(`${this.apiUrl}/companies/${companyId}/People/${id}`, person, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  deletePerson(companyId: string, id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/companies/${companyId}/People/${id}`, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  getPersonStatus(companyId: string, personId: number): Observable<string> {
    return this.http.get<string>(`${this.apiUrl}/companies/${companyId}/people/${personId}/status`)
      .pipe(
        catchError(this.handleError)
      );
  }
  
  updatePersonStatus(companyId: string, personId: number, status: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/companies/${companyId}/people/${personId}/status`, { status }, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  getPersonByEmail(companyId: string, email: string): Observable<People> {
    return this.http.get<People>(`${this.apiUrl}/companies/${companyId}/people/by-email/${email}`)
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