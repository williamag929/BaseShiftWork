import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BillingService } from './billing.service';
import { environment } from '../../../environments/environment';

describe('BillingService', () => {
  let service: BillingService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/companies/co-1/billing`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(BillingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('never doubles the /api prefix', () => {
    service.getSummary('co-1').subscribe();
    const req = http.expectOne(base);
    expect(req.request.url).not.toContain('/api/api/');
    req.flush({});
  });

  it('refresh() publishes the summary on summary$', () => {
    let latest: any = null;
    service.summary$.subscribe(s => (latest = s));
    service.refresh('co-1');
    http.expectOne(base).flush({ tier: 'Pro', isTrial: true });
    expect(latest.tier).toBe('Pro');
  });

  it('refresh() publishes null when the request fails', () => {
    let latest: any = 'unset';
    service.summary$.subscribe(s => (latest = s));
    service.refresh('co-1');
    http.expectOne(base).flush({}, { status: 500, statusText: 'Server Error' });
    expect(latest).toBeNull();
  });

  it('startCheckout posts the tier and returns the url', () => {
    let url = '';
    service.startCheckout('co-1', 'Starter').subscribe(u => (url = u));
    const req = http.expectOne(`${base}/checkout-session`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tier: 'Starter' });
    req.flush({ url: 'https://checkout.stripe.com/x' });
    expect(url).toBe('https://checkout.stripe.com/x');
  });

  it('openPortal posts and returns the url', () => {
    let url = '';
    service.openPortal('co-1').subscribe(u => (url = u));
    http.expectOne(`${base}/portal-session`).flush({ url: 'https://billing.stripe.com/p' });
    expect(url).toBe('https://billing.stripe.com/p');
  });
});
