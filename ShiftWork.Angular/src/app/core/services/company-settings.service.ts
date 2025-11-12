import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CompanySettings } from '../models/company-settings.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CompanySettingsService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get company settings (creates defaults if none exist)
   */
  getSettings(companyId: string): Observable<CompanySettings> {
    return this.http.get<CompanySettings>(`${this.apiUrl}/companies/${companyId}/settings`);
  }

  /**
   * Update company settings
   */
  updateSettings(companyId: string, settings: CompanySettings): Observable<CompanySettings> {
    return this.http.put<CompanySettings>(`${this.apiUrl}/companies/${companyId}/settings`, settings);
  }
}
