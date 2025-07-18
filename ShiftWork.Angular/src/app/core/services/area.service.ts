import { Injectable } from '@angular/core';
import { Area } from '../models/area.model';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AreaService {

  private readonly apiUrl = environment.apiUrl

  constructor(private http: HttpClient) { }

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  getAreas(companyId: string): Observable<Area[]> {
    return this.http.get<Area[]>(`${this.apiUrl}/companies/${companyId}/areas`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getArea(companyId: string, id: number): Observable<Area> {
    return this.http.get<Area>(`${this.apiUrl}/companies/${companyId}/areas/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  createArea(companyId: string, area: Area): Observable<Area> {
    return this.http.post<Area>(`${this.apiUrl}/companies/${companyId}/areas`, area, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  updateArea(companyId: string, id: number, area: Area): Observable<Area> {
    return this.http.put<Area>(`${this.apiUrl}/companies/${companyId}/areas/${id}`, area, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteArea(companyId: string, id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/companies/${companyId}/areas/${id}`, this.getHttpOptions())
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
