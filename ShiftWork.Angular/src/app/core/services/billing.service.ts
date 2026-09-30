import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { BillingSummary, PaidTier } from '../models/billing.model';

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly summarySubject = new BehaviorSubject<BillingSummary | null>(null);
  readonly summary$ = this.summarySubject.asObservable();

  constructor(private http: HttpClient) {}

  private base(companyId: string): string {
    return `${environment.apiUrl}/companies/${companyId}/billing`;
  }

  getSummary(companyId: string): Observable<BillingSummary> {
    return this.http.get<BillingSummary>(this.base(companyId));
  }

  refresh(companyId: string): void {
    this.getSummary(companyId).subscribe({
      next: s => this.summarySubject.next(s),
      error: () => this.summarySubject.next(null)
    });
  }

  startCheckout(companyId: string, tier: PaidTier): Observable<string> {
    return this.http.post<{ url: string }>(`${this.base(companyId)}/checkout-session`, { tier }).pipe(map(r => r.url));
  }

  openPortal(companyId: string): Observable<string> {
    return this.http.post<{ url: string }>(`${this.base(companyId)}/portal-session`, {}).pipe(map(r => r.url));
  }

  redirect(url: string): void {
    window.location.assign(url);
  }
}
