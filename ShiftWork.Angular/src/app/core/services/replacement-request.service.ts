import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CreateReplacementRequest, NotifyReplacementDto, ReplacementRequest } from '../models/replacement-request.model';

@Injectable({ providedIn: 'root' })
export class ReplacementRequestService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  createReplacementRequest(companyId: string, payload: CreateReplacementRequest): Observable<ReplacementRequest> {
    return this.http.post<ReplacementRequest>(`${this.apiUrl}/companies/${companyId}/replacement-requests`, payload);
  }

  notifyReplacementCandidates(companyId: string, requestId: number, payload: NotifyReplacementDto): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/companies/${companyId}/replacement-requests/${requestId}/notify`, payload);
  }
}
