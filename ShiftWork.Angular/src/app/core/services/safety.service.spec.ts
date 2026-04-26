import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SafetyService } from './safety.service';
import { environment } from '../../../environments/environment';

describe('SafetyService', () => {
  let service: SafetyService;
  let http: HttpTestingController;

  const base = `${environment.apiUrl}/companies/co-1/safety`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(SafetyService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getContents', () => {
    it('sends page and pageSize as query params', () => {
      service.getContents('co-1', undefined, undefined, undefined, 3, 10).subscribe();

      const req = http.expectOne(r => r.url === base);
      expect(req.request.params.get('page')).toBe('3');
      expect(req.request.params.get('pageSize')).toBe('10');
      req.flush({ items: [], totalCount: 0, page: 3, pageSize: 10 });
    });
  });

  describe('getPending', () => {
    it('calls /pending endpoint', () => {
      service.getPending('co-1').subscribe();

      const req = http.expectOne(`${base}/pending`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('acknowledge', () => {
    it('POSTs to /acknowledge endpoint', () => {
      const id = 'safety-guid-1';
      service.acknowledge('co-1', id).subscribe();

      const req = http.expectOne(`${base}/${id}/acknowledge`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  describe('archiveContent', () => {
    it('sends DELETE to the content endpoint', () => {
      const id = 'safety-guid-2';
      service.archiveContent('co-1', id).subscribe();

      const req = http.expectOne(`${base}/${id}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
