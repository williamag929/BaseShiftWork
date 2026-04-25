import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Document,
  DocumentDetail,
  DocumentReadLog,
  UploadDocumentDto,
  InitiateUploadResponse,
  UpdateDocumentDto
} from '../models/document.model';
import { PagedResult } from '../models/paged-result.model';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private get jsonOptions() {
    return { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) };
  }

  private base(companyId: string): string {
    return `${this.apiUrl}/companies/${companyId}/documents`;
  }

  getDocuments(
    companyId: string,
    locationId?: number,
    type?: string,
    search?: string,
    page = 1,
    pageSize = 25
  ): Observable<PagedResult<Document>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    if (locationId != null) params = params.set('locationId', locationId.toString());
    if (type)               params = params.set('type', type);
    if (search)             params = params.set('search', search);

    return this.http
      .get<PagedResult<Document>>(this.base(companyId), { params })
      .pipe(catchError(this.handleError));
  }

  getDocument(companyId: string, documentId: string): Observable<DocumentDetail> {
    return this.http
      .get<DocumentDetail>(`${this.base(companyId)}/${documentId}`)
      .pipe(catchError(this.handleError));
  }

  initiateUpload(companyId: string, dto: UploadDocumentDto): Observable<InitiateUploadResponse> {
    return this.http
      .post<InitiateUploadResponse>(`${this.base(companyId)}/initiate-upload`, dto, this.jsonOptions)
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

  confirmUpload(companyId: string, documentId: string): Observable<Document> {
    return this.http
      .post<Document>(`${this.base(companyId)}/${documentId}/confirm-upload`, {})
      .pipe(catchError(this.handleError));
  }

  updateDocument(companyId: string, documentId: string, dto: UpdateDocumentDto): Observable<Document> {
    return this.http
      .put<Document>(`${this.base(companyId)}/${documentId}`, dto, this.jsonOptions)
      .pipe(catchError(this.handleError));
  }

  archiveDocument(companyId: string, documentId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.base(companyId)}/${documentId}`)
      .pipe(catchError(this.handleError));
  }

  getReadLogs(companyId: string, documentId: string): Observable<DocumentReadLog[]> {
    return this.http
      .get<DocumentReadLog[]>(`${this.base(companyId)}/${documentId}/reads`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    const serverBody = typeof error.error === 'string' ? error.error : (error.error?.message ?? '');
    const message = `Error ${error.status}: ${serverBody || error.message}`;
    console.error(error);
    return throwError(() => new Error(message));
  }
}
