import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

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
export class PlanService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  upgradePlan(companyId: string, request: PlanUpgradeRequest): Observable<PlanUpgradeResponse> {
    return this.http.post<PlanUpgradeResponse>(
      `${this.apiUrl}/companies/${companyId}/plan/upgrade`,
      request
    );
  }
}
