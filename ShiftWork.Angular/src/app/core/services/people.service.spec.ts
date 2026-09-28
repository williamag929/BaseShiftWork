import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PeopleService } from './people.service';
import { PlanLimitError } from '../errors/plan-limit.error';
import { environment } from '../../../environments/environment';

describe('PeopleService plan-limit handling', () => {
  let service: PeopleService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/companies/co-1/People`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PeopleService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('createPerson surfaces PlanLimitError on 409 plan_limit_exceeded', () => {
    let caught: any;
    service.createPerson('co-1', { name: 'x' } as any).subscribe({ error: e => (caught = e) });
    http.expectOne(url).flush(
      { code: 'plan_limit_exceeded', tier: 'Free', cap: 5, count: 5, message: 'limit' },
      { status: 409, statusText: 'Conflict' });
    expect(caught instanceof PlanLimitError).toBeTrue();
    expect(caught.cap).toBe(5);
  });

  it('updatePerson surfaces PlanLimitError when reactivation is blocked', () => {
    let caught: any;
    service.updatePerson('co-1', 7, { name: 'x' } as any).subscribe({ error: e => (caught = e) });
    http.expectOne(`${url}/7`).flush(
      { code: 'plan_limit_exceeded', tier: 'Starter', cap: 25, count: 25, message: 'limit' },
      { status: 409, statusText: 'Conflict' });
    expect(caught instanceof PlanLimitError).toBeTrue();
  });

  it('other failures keep the generic error', () => {
    spyOn(console, 'error');
    let caught: any;
    service.createPerson('co-1', { name: 'x' } as any).subscribe({ error: e => (caught = e) });
    http.expectOne(url).flush({}, { status: 500, statusText: 'Server Error' });
    expect(caught instanceof PlanLimitError).toBeFalse();
    expect(caught.message).toContain('Error Code: 500');
  });
});
