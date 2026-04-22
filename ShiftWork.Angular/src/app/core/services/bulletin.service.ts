import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Bulletin, BulletinRead, CreateBulletinDto, UpdateBulletinDto } from '../models/bulletin.model';

@Injectable({
  providedIn: 'root'
})
export class BulletinService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private get jsonOptions() {
    return { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) };
  }

  getBulletins(
    companyId: string,
    locationId?: number,
    type?: string,
    status?: string
  ): Observable<Bulletin[]> {
    let params = new HttpParams();
    if (locationId != null) params = params.set('locationId', locationId.toString());
    if (type)               params = params.set('type', type);
    if (status)             params = params.set('status', status);

    return this.http
      .get<Bulletin[]>(`${this.apiUrl}/companies/${companyId}/bulletins`, { params })
      .pipe(catchError(this.handleError));
  }

  getUnread(companyId: string, urgentOnly = false): Observable<Bulletin[]> {
    let params = new HttpParams();
    if (urgentOnly) params = params.set('urgentOnly', 'true');

    return this.http
      .get<Bulletin[]>(`${this.apiUrl}/companies/${companyId}/bulletins/unread`, { params })
      .pipe(catchError(this.handleError));
  }

  getBulletin(companyId: string, bulletinId: string): Observable<Bulletin> {
    return this.http
      .get<Bulletin>(`${this.apiUrl}/companies/${companyId}/bulletins/${bulletinId}`)
      .pipe(catchError(this.handleError));
  }

  createBulletin(companyId: string, dto: CreateBulletinDto): Observable<Bulletin> {
    return this.http
      .post<Bulletin>(`${this.apiUrl}/companies/${companyId}/bulletins`, dto, this.jsonOptions)
      .pipe(catchError(this.handleError));
  }

  updateBulletin(companyId: string, bulletinId: string, dto: UpdateBulletinDto): Observable<Bulletin> {
    return this.http
      .put<Bulletin>(`${this.apiUrl}/companies/${companyId}/bulletins/${bulletinId}`, dto, this.jsonOptions)
      .pipe(catchError(this.handleError));
  }

  archiveBulletin(companyId: string, bulletinId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/companies/${companyId}/bulletins/${bulletinId}`)
      .pipe(catchError(this.handleError));
  }

  markAsRead(companyId: string, bulletinId: string): Observable<void> {
    return this.http
      .post<void>(`${this.apiUrl}/companies/${companyId}/bulletins/${bulletinId}/read`, {})
      .pipe(catchError(this.handleError));
  }

  getReads(companyId: string, bulletinId: string): Observable<BulletinRead[]> {
    return this.http
      .get<BulletinRead[]>(`${this.apiUrl}/companies/${companyId}/bulletins/${bulletinId}/reads`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    const serverBody = typeof error.error === 'string' ? error.error : (error.error?.message ?? '');
    const message = `Error ${error.status}: ${serverBody || error.message}`;
    console.error(error);
    return throwError(() => new Error(message));
  }
}
