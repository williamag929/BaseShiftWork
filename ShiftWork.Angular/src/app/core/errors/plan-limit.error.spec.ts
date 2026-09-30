import { HttpErrorResponse } from '@angular/common/http';
import { PlanLimitError } from './plan-limit.error';

describe('PlanLimitError', () => {
  it('recognizes a 409 plan_limit_exceeded body', () => {
    const e = PlanLimitError.from(new HttpErrorResponse({
      status: 409,
      error: { code: 'plan_limit_exceeded', tier: 'Free', cap: 5, count: 5, message: 'Your Free plan allows 5 active employees.' }
    }));
    expect(e).toBeTruthy();
    expect(e!.cap).toBe(5);
    expect(e!.tier).toBe('Free');
    expect(e!.message).toContain('5 active employees');
  });

  it('ignores other conflicts', () => {
    expect(PlanLimitError.from(new HttpErrorResponse({ status: 409, error: { code: 'subscription_exists' } }))).toBeNull();
    expect(PlanLimitError.from(new HttpErrorResponse({ status: 500 }))).toBeNull();
  });

  it('ignores a plan_limit_exceeded code on a non-409 status', () => {
    expect(PlanLimitError.from(new HttpErrorResponse({ status: 400, error: { code: 'plan_limit_exceeded' } }))).toBeNull();
  });
});
