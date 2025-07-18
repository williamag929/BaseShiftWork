import { Injectable } from '@angular/core';
import { Role } from '../models/role.model';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RoleService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  getRoles(companyId: string): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/companies/${companyId}/roles`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getRole(companyId: string, id: number): Observable<Role> {
    return this.http.get<Role>(`${this.apiUrl}/companies/${companyId}/roles/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  createRole(companyId: string, role: Role): Observable<Role> {
    return this.http.post<Role>(`${this.apiUrl}/companies/${companyId}/roles`, role, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  updateRole(companyId: string, id: number, role: Role): Observable<Role> {
    return this.http.put<Role>(`${this.apiUrl}/companies/${companyId}/roles/${id}`, role, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteRole(companyId: string, id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/companies/${companyId}/roles/${id}`, this.getHttpOptions())
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
