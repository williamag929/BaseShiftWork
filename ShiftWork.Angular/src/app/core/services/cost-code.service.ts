import { Injectable } from '@angular/core';
import { CostCode } from '../models/cost-code.model';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CostCodeService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  getCostCodes(companyId: string): Observable<CostCode[]> {
    return this.http.get<CostCode[]>(`${this.apiUrl}/companies/${companyId}/costcodes`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getCostCode(companyId: string, id: number): Observable<CostCode> {
    return this.http.get<CostCode>(`${this.apiUrl}/companies/${companyId}/costcodes/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  createCostCode(companyId: string, costCode: CostCode): Observable<CostCode> {
    return this.http.post<CostCode>(`${this.apiUrl}/companies/${companyId}/costcodes`, costCode, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  updateCostCode(companyId: string, id: number, costCode: CostCode): Observable<CostCode> {
    return this.http.put<CostCode>(`${this.apiUrl}/companies/${companyId}/costcodes/${id}`, costCode, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteCostCode(companyId: string, id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/companies/${companyId}/costcodes/${id}`, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Unknown error!';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
