import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BulletinService } from './bulletin.service';
import { environment } from '../../../environments/environment';

describe('BulletinService', () => {
  let service: BulletinService;
  let http: HttpTestingController;

  const base = `${environment.apiUrl}/companies/co-1/bulletins`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(BulletinService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getBulletins', () => {
    it('sends page and pageSize as query params', () => {
      service.getBulletins('co-1', undefined, undefined, undefined, 2, 10).subscribe();

      const req = http.expectOne(r => r.url === base);
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('pageSize')).toBe('10');
      req.flush({ items: [], totalCount: 0, page: 2, pageSize: 10 });
    });

    it('defaults to page 1 and pageSize 25', () => {
      service.getBulletins('co-1').subscribe();

      const req = http.expectOne(r => r.url === base);
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('pageSize')).toBe('25');
      req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
    });

    it('includes optional filters when provided', () => {
      service.getBulletins('co-1', 7, 'General', 'Published').subscribe();

      const req = http.expectOne(r => r.url === base);
      expect(req.request.params.get('locationId')).toBe('7');
      expect(req.request.params.get('type')).toBe('General');
      expect(req.request.params.get('status')).toBe('Published');
      req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
    });
  });

  describe('getUnread', () => {
    it('calls the /unread endpoint', () => {
      service.getUnread('co-1').subscribe();

      const req = http.expectOne(`${base}/unread`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('sends urgentOnly=true when requested', () => {
      service.getUnread('co-1', true).subscribe();

      const req = http.expectOne(r => r.url === `${base}/unread`);
      expect(req.request.params.get('urgentOnly')).toBe('true');
      req.flush([]);
    });
  });

  describe('markAsRead', () => {
    it('POSTs to the /read endpoint', () => {
      const bulletinId = 'abc-123';
      service.markAsRead('co-1', bulletinId).subscribe();

      const req = http.expectOne(`${base}/${bulletinId}/read`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  describe('archiveBulletin', () => {
    it('sends DELETE to the bulletin endpoint', () => {
      const bulletinId = 'abc-456';
      service.archiveBulletin('co-1', bulletinId).subscribe();

      const req = http.expectOne(`${base}/${bulletinId}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
