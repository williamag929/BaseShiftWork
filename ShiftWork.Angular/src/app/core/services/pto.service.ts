import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PtoBalance, ConfigurePtoDto } from '../models/pto.model';

@Injectable({
  providedIn: 'root'
})
export class PtoService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getBalance(companyId: string, personId: number, asOf?: Date): Observable<PtoBalance> {
    const params: any = {};
    if (asOf) {
      params.asOf = asOf.toISOString();
    }
    return this.http.get<PtoBalance>(
      `${this.apiUrl}/companies/${companyId}/pto/balance/${personId}`,
      { params }
    );
  }

  configurePto(companyId: string, personId: number, config: ConfigurePtoDto): Observable<void> {
    return this.http.put<void>(
      `${this.apiUrl}/companies/${companyId}/pto/config/${personId}`,
      config
    );
  }
}
