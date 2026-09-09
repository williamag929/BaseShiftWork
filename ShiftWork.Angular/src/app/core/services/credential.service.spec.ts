import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CredentialService } from './credential.service';
import { environment } from '../../../environments/environment';

describe('CredentialService', () => {
  let service: CredentialService;
  let http: HttpTestingController;

  const base = `${environment.apiUrl}/companies/co-1/credentials`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(CredentialService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getCredentials', () => {
    it('sends no filters by default', () => {
      service.getCredentials('co-1').subscribe();

      const req = http.expectOne(r => r.url === base);
      expect(req.request.params.has('personId')).toBeFalse();
      expect(req.request.params.has('status')).toBeFalse();
      req.flush([]);
    });

    it('includes optional filters when provided', () => {
      service.getCredentials('co-1', 42, 'Active').subscribe();

      const req = http.expectOne(r => r.url === base);
      expect(req.request.params.get('personId')).toBe('42');
      expect(req.request.params.get('status')).toBe('Active');
      req.flush([]);
    });
  });

  describe('getCredentialsByPerson', () => {
    it('calls the /person/{id} endpoint', () => {
      service.getCredentialsByPerson('co-1', 42).subscribe();

      const req = http.expectOne(`${base}/person/42`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getExpiring', () => {
    it('defaults withinDays to 30', () => {
      service.getExpiring('co-1').subscribe();

      const req = http.expectOne(r => r.url === `${base}/expiring`);
      expect(req.request.params.get('withinDays')).toBe('30');
      req.flush({ expiredCount: 0, expiringSoonCount: 0, items: [] });
    });
  });

  describe('createCredential', () => {
    it('POSTs to the base endpoint', () => {
      const dto = { personId: 1, name: 'OSHA 30', expiryDate: '2026-12-01' };
      service.createCredential('co-1', dto).subscribe();

      const req = http.expectOne(base);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });
  });

  describe('archiveCredential', () => {
    it('sends DELETE to the credential endpoint', () => {
      service.archiveCredential('co-1', 'c1').subscribe();

      const req = http.expectOne(`${base}/c1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('uploadToS3', () => {
    it('PUTs the file directly to the presigned URL', () => {
      const file = new File(['data'], 'cert.pdf', { type: 'application/pdf' });
      service.uploadToS3('https://s3.example.com/presigned', file).subscribe();

      const req = http.expectOne('https://s3.example.com/presigned');
      expect(req.request.method).toBe('PUT');
      expect(req.request.headers.get('Content-Type')).toBe('application/pdf');
      req.flush(null);
    });
  });
});
