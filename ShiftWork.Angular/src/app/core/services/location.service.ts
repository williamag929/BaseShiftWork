import { Injectable } from '@angular/core';
import { Location } from '../models/location.model';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LocationService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  getLocations(companyId: string): Observable<Location[]> {
    return this.http.get<Location[]>(`${this.apiUrl}/companies/${companyId}/locations`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getLocation(companyId: string, id: number): Observable<Location> {
    return this.http.get<Location>(`${this.apiUrl}/companies/${companyId}/locations/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  createLocation(companyId: string, location: Location): Observable<Location> {
    return this.http.post<Location>(`${this.apiUrl}/companies/${companyId}/locations`, location, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  updateLocation(companyId: string, id: number, location: Location): Observable<Location> {
    return this.http.put<Location>(`${this.apiUrl}/companies/${companyId}/locations/${id}`, location, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteLocation(companyId: string, id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/companies/${companyId}/locations/${id}`, this.getHttpOptions())
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