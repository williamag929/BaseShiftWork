import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActiveSiteService } from './active-site.service';
import { environment } from '../../../environments/environment';

describe('ActiveSiteService', () => {
  let service: ActiveSiteService;
  let http: HttpTestingController;

  const companyBase = `${environment.apiUrl}/companies/co-1`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(ActiveSiteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getActiveSiteStatus', () => {
    it('GETs the locations active-status endpoint', () => {
      service.getActiveSiteStatus('co-1').subscribe();

      const req = http.expectOne(`${companyBase}/locations/active-status`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('reviewGeofenceFlag', () => {
    it('PATCHes the review-geofence endpoint with reviewerPersonId as a query param', () => {
      service.reviewGeofenceFlag('co-1', 'evt-1', 42).subscribe();

      const req = http.expectOne(r => r.url === `${companyBase}/shiftevents/evt-1/review-geofence`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.params.get('reviewerPersonId')).toBe('42');
      req.flush({});
    });

    it('omits reviewerPersonId when not provided', () => {
      service.reviewGeofenceFlag('co-1', 'evt-1').subscribe();

      const req = http.expectOne(r => r.url === `${companyBase}/shiftevents/evt-1/review-geofence`);
      expect(req.request.params.has('reviewerPersonId')).toBeFalse();
      req.flush({});
    });
  });
});
