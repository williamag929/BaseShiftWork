import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Credential,
  CreateCredentialDto,
  UpdateCredentialDto,
  InitiateCredentialUploadResponse,
  ExpiringCredentialsSummary
} from '../models/credential.model';

@Injectable({
  providedIn: 'root'
})
export class CredentialService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private get jsonOptions() {
    return { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) };
  }

  private base(companyId: string): string {
    return `${this.apiUrl}/companies/${companyId}/credentials`;
  }

  getCredentials(companyId: string, personId?: number, status?: string): Observable<Credential[]> {
    let params = new HttpParams();
    if (personId != null) params = params.set('personId', personId.toString());
    if (status)           params = params.set('status', status);

    return this.http
      .get<Credential[]>(this.base(companyId), { params })
      .pipe(catchError(this.handleError));
  }

  getCredentialsByPerson(companyId: string, personId: number): Observable<Credential[]> {
    return this.http
      .get<Credential[]>(`${this.base(companyId)}/person/${personId}`)
      .pipe(catchError(this.handleError));
  }

  getExpiring(companyId: string, withinDays = 30): Observable<ExpiringCredentialsSummary> {
    const params = new HttpParams().set('withinDays', withinDays.toString());
    return this.http
      .get<ExpiringCredentialsSummary>(`${this.base(companyId)}/expiring`, { params })
      .pipe(catchError(this.handleError));
  }

  getCredential(companyId: string, credentialId: string): Observable<Credential> {
    return this.http
      .get<Credential>(`${this.base(companyId)}/${credentialId}`)
      .pipe(catchError(this.handleError));
  }

  createCredential(companyId: string, dto: CreateCredentialDto): Observable<Credential> {
    return this.http
      .post<Credential>(this.base(companyId), dto, this.jsonOptions)
      .pipe(catchError(this.handleError));
  }

  initiateUpload(companyId: string, dto: CreateCredentialDto): Observable<InitiateCredentialUploadResponse> {
    return this.http
      .post<InitiateCredentialUploadResponse>(`${this.base(companyId)}/initiate-upload`, dto, this.jsonOptions)
      .pipe(catchError(this.handleError));
  }

  /** PUT the file directly to S3 using the presigned URL — no auth header needed. */
  uploadToS3(presignedUrl: string, file: File): Observable<void> {
    return this.http
      .put<void>(presignedUrl, file, {
        headers: new HttpHeaders({ 'Content-Type': file.type })
      })
      .pipe(catchError(this.handleError));
  }

  confirmUpload(companyId: string, credentialId: string): Observable<Credential> {
    return this.http
      .post<Credential>(`${this.base(companyId)}/${credentialId}/confirm-upload`, {})
      .pipe(catchError(this.handleError));
  }

  updateCredential(companyId: string, credentialId: string, dto: UpdateCredentialDto): Observable<Credential> {
    return this.http
      .put<Credential>(`${this.base(companyId)}/${credentialId}`, dto, this.jsonOptions)
      .pipe(catchError(this.handleError));
  }

  archiveCredential(companyId: string, credentialId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.base(companyId)}/${credentialId}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    const serverBody = typeof error.error === 'string' ? error.error : (error.error?.message ?? '');
    const message = `Error ${error.status}: ${serverBody || error.message}`;
    console.error(error);
    return throwError(() => new Error(message));
  }
}
