import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LocationService } from './location.service';
import { DefaultShift } from '../models/location.model';
import { environment } from '../../../environments/environment';

describe('LocationService default shift', () => {
  let service: LocationService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/companies/co-1/locations/7/default-shift`;
  const shift: DefaultShift = { start: '07:00', end: '15:30', areaId: 12 };

  beforeEach(() => {
    spyOn(console, 'error');
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(LocationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('setDefaultShift PUTs the shift and returns the response', () => {
    let result: DefaultShift | undefined;
    service.setDefaultShift('co-1', 7, shift).subscribe(r => (result = r));
    const req = http.expectOne(url);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ start: '07:00', end: '15:30', areaId: 12 });
    req.flush({ start: '07:00', end: '15:30', areaId: 12 });
    expect(result).toEqual(shift);
  });

  it('setDefaultShift propagates a 400 error', () => {
    let error: any;
    service.setDefaultShift('co-1', 7, shift).subscribe({ error: e => (error = e) });
    http.expectOne(url).flush({ message: 'bad' }, { status: 400, statusText: 'Bad Request' });
    expect(error).toBeTruthy();
    expect(error.message).toContain('400');
  });

  it('clearDefaultShift sends DELETE', () => {
    let done = false;
    service.clearDefaultShift('co-1', 7).subscribe(() => (done = true));
    const req = http.expectOne(url);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(done).toBeTrue();
  });

  it('clearDefaultShift propagates a 400 error', () => {
    let error: any;
    service.clearDefaultShift('co-1', 7).subscribe({ error: e => (error = e) });
    http.expectOne(url).flush({ title: 'bad' }, { status: 400, statusText: 'Bad Request' });
    expect(error.message).toContain('400');
  });
});
