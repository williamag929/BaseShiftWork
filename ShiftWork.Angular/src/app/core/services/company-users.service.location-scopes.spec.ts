import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CompanyUsersService } from './company-users.service';
import { environment } from '../../../environments/environment';

describe('CompanyUsersService location scopes', () => {
  let service: CompanyUsersService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/companies/co-1/users/u-9/location-scopes`;

  beforeEach(() => {
    spyOn(console, 'error');
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(CompanyUsersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getLocationScopes GETs and returns locationIds', () => {
    let result: number[] | undefined;
    service.getLocationScopes('co-1', 'u-9').subscribe(r => (result = r));
    const req = http.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush({ locationIds: [1, 3] });
    expect(result).toEqual([1, 3]);
  });

  it('getLocationScopes propagates a 400 error', () => {
    let error: any;
    service.getLocationScopes('co-1', 'u-9').subscribe({ error: e => (error = e) });
    http.expectOne(url).flush({}, { status: 400, statusText: 'Bad Request' });
    expect(error.message).toContain('400');
  });

  it('setLocationScopes PUTs { locationIds } and returns response ids', () => {
    let result: number[] | undefined;
    service.setLocationScopes('co-1', 'u-9', [1, 3]).subscribe(r => (result = r));
    const req = http.expectOne(url);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ locationIds: [1, 3] });
    req.flush({ locationIds: [1, 3] });
    expect(result).toEqual([1, 3]);
  });

  it('setLocationScopes propagates a 400 error', () => {
    let error: any;
    service.setLocationScopes('co-1', 'u-9', [1]).subscribe({ error: e => (error = e) });
    http.expectOne(url).flush({ message: 'bad' }, { status: 400, statusText: 'Bad Request' });
    expect(error.message).toContain('400');
  });
});
