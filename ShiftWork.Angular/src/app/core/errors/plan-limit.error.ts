import { HttpErrorResponse } from '@angular/common/http';

export class PlanLimitError extends Error {
  constructor(message: string, public tier: string, public cap: number, public count: number) {
    super(message);
    this.name = 'PlanLimitError';
  }

  static from(err: HttpErrorResponse): PlanLimitError | null {
    const b = err?.error;
    if (err?.status !== 409 || b?.code !== 'plan_limit_exceeded') return null;
    return new PlanLimitError(b.message, b.tier, b.cap, b.count);
  }
}
