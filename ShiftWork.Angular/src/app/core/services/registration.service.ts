import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CompanyRegistrationRequest {
  firebaseUid: string;
  userEmail: string;
  userDisplayName: string;
  companyName: string;
  companyEmail: string;
  companyPhone?: string;
  timeZone: string;
}

export interface CompanyRegistrationResponse {
  companyId: string;
  plan: string;
  onboardingStatus: string;
  adminUser: any;
}

export interface SandboxStatusResponse {
  hasSandboxData: boolean;
  sandboxPersonCount: number;
  sandboxAreaCount: number;
  sandboxLocationCount: number;
}

export interface PlanUpgradeRequest {
  stripePaymentMethodId: string;
  targetPlan: string;
}

export interface PlanUpgradeResponse {
  success: boolean;
  plan: string;
  stripeSubscriptionId?: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class RegistrationService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private jsonHeaders() {
    return { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) };
  }

  /**
   * POST /api/auth/register — public endpoint.
   * The caller must include a Firebase Bearer token in the Authorization header
   * (handled by the HttpInterceptor when the user is authenticated).
   */
  register(request: CompanyRegistrationRequest): Observable<CompanyRegistrationResponse> {
    return this.http.post<CompanyRegistrationResponse>(
      `${this.apiUrl}/auth/register`,
      request,
      this.jsonHeaders()
    );
  }

  getSandboxStatus(companyId: string): Observable<SandboxStatusResponse> {
    return this.http.get<SandboxStatusResponse>(
      `${this.apiUrl}/companies/${companyId}/sandbox/status`
    );
  }

  hideSandboxData(companyId: string, entityTypes: string[] = ['All']): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/companies/${companyId}/sandbox/hide`,
      { entityTypes },
      this.jsonHeaders()
    );
  }

  resetSandboxData(companyId: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/companies/${companyId}/sandbox/reset`,
      {},
      this.jsonHeaders()
    );
  }

  deleteSandboxData(companyId: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/companies/${companyId}/sandbox/delete`,
      {},
      this.jsonHeaders()
    );
  }

  upgradePlan(companyId: string, request: PlanUpgradeRequest): Observable<PlanUpgradeResponse> {
    return this.http.post<PlanUpgradeResponse>(
      `${this.apiUrl}/companies/${companyId}/plan/upgrade`,
      request,
      this.jsonHeaders()
    );
  }

  /**
   * PATCH /api/companies/{companyId}/onboarding-status
   * Sets OnboardingStatus ("Pending" | "Verified" | "Complete") on the company.
   * Called client-side after Firebase email verification is confirmed.
   */
  patchOnboardingStatus(companyId: string, status: string): Observable<void> {
    return this.http.patch<void>(
      `${this.apiUrl}/companies/${companyId}/onboarding-status`,
      { status },
      this.jsonHeaders()
    );
  }
}
