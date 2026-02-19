import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SendInviteRequest, SendInviteResponse, CompleteInviteRequest, InviteStatusResponse } from '../models/invite.model';

@Injectable({
  providedIn: 'root'
})
export class InviteService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  /**
   * Send app invite to an employee
   */
  sendInvite(companyId: string, personId: number, request: SendInviteRequest): Observable<SendInviteResponse> {
    return this.http.post<SendInviteResponse>(
      `${this.apiUrl}/companies/${companyId}/people/${personId}/send-invite`,
      request,
      this.getHttpOptions()
    ).pipe(catchError(this.handleError));
  }

  /**
   * Complete invite after Firebase account creation
   */
  completeInvite(companyId: string, request: CompleteInviteRequest): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/companies/${companyId}/people/complete-invite`,
      request,
      this.getHttpOptions()
    ).pipe(catchError(this.handleError));
  }

  /**
   * Get invite status for an employee
   */
  getInviteStatus(companyId: string, personId: number): Observable<InviteStatusResponse> {
    return this.http.get<InviteStatusResponse>(
      `${this.apiUrl}/companies/${companyId}/people/${personId}/invite-status`
    ).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = error.error?.message || error.message || `Error Code: ${error.status}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
