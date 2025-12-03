import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { CompanyUser } from '../models/company-user.model';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';


@Injectable({
  providedIn: 'root'
})
export class CompanyUsersService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  getCompanyUsers(companyId: string): Observable<CompanyUser[]> {
    return this.http.get<CompanyUser[]>(`${this.apiUrl}/companies/${companyId}/usercompanies`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getCompanyUser(companyId: string, companyUserId: string): Observable<CompanyUser> {
    return this.http.get<CompanyUser>(`${this.apiUrl}/companies/${companyId}/usercompanies/${companyUserId}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  createCompanyUser(companyId: string, companyUser: CompanyUser): Observable<CompanyUser> {
    return this.http.post<CompanyUser>(`${this.apiUrl}/companies/${companyId}/usercompanies`, companyUser, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  updateCompanyUser(companyId: string, companyUserId: string, companyUser: CompanyUser): Observable<CompanyUser> {
    return this.http.put<CompanyUser>(`${this.apiUrl}/companies/${companyId}/usercompanies/${companyUserId}`, companyUser, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteCompanyUser(companyId: string, companyUserId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/companies/${companyId}/usercompanies/${companyUserId}`, this.getHttpOptions())
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
