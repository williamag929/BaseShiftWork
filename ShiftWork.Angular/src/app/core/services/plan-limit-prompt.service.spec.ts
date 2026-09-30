import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { PlanLimitPromptService } from './plan-limit-prompt.service';
import { PlanLimitError } from '../errors/plan-limit.error';

describe('PlanLimitPromptService', () => {
  let service: PlanLimitPromptService;
  let toastr: jasmine.SpyObj<ToastrService>;
  let router: jasmine.SpyObj<Router>;
  let tap$: Subject<void>;

  beforeEach(() => {
    tap$ = new Subject<void>();
    toastr = jasmine.createSpyObj('ToastrService', ['warning']);
    toastr.warning.and.returnValue({ onTap: tap$.asObservable() } as any);
    router = jasmine.createSpyObj('Router', ['navigate']);
    TestBed.configureTestingModule({
      providers: [
        { provide: ToastrService, useValue: toastr },
        { provide: Router, useValue: router }
      ]
    });
    service = TestBed.inject(PlanLimitPromptService);
  });

  it('shows the server message and reports the error as handled', () => {
    const handled = service.handle(new PlanLimitError('Your Free plan allows 5 active employees.', 'Free', 5, 5));

    expect(handled).toBeTrue();
    expect(toastr.warning.calls.mostRecent().args[0]).toContain('5 active employees');
  });

  it('tapping the prompt opens Plan & Billing', () => {
    service.handle(new PlanLimitError('limit', 'Starter', 25, 25));
    expect(router.navigate).not.toHaveBeenCalled();

    tap$.next();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/billing']);
  });

  it('leaves every other error alone so callers can show their own message', () => {
    expect(service.handle(new Error('boom'))).toBeFalse();
    expect(service.handle(undefined)).toBeFalse();
    expect(toastr.warning).not.toHaveBeenCalled();
  });
});
