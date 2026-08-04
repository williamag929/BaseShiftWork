import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';

export interface CompanyBillingInfo {
  companyId: string;
  name: string;
  plan: string;
  trialDaysRemaining: number;
  planExpiresAt: string | null;
  employeeCount: number;
  employeeLimit: number;
  isTrialExpired: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class BillingService {
  public billingInfoSubject = new BehaviorSubject<CompanyBillingInfo | null>(null);
  public billingInfo$ = this.billingInfoSubject.asObservable();

  constructor(private http: HttpClient) {}

  getBillingInfo(companyId: string): Observable<CompanyBillingInfo> {
    return this.http.get<CompanyBillingInfo>(
      `${environment.apiUrl}/api/companies/${companyId}/billing`
    );
  }

  refreshBillingInfo(companyId: string): void {
    this.getBillingInfo(companyId).subscribe({
      next: (info) => this.billingInfoSubject.next(info),
      error: (error) => console.error('Failed to refresh billing info:', error)
    });
  }

  getCurrentBillingInfo(): CompanyBillingInfo | null {
    return this.billingInfoSubject.value;
  }

  openBillingPortal(companyId: string, returnUrl: string): void {
    this.http.post<{ portalUrl: string }>(
      `${environment.apiUrl}/api/companies/${companyId}/billing-portal-session`,
      { returnUrl }
    ).subscribe({
      next: (response) => {
        window.location.href = response.portalUrl;
      },
      error: (error) => console.error('Failed to open billing portal:', error)
    });
  }
}
