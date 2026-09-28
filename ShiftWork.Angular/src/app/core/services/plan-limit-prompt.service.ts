import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { PlanLimitError } from '../errors/plan-limit.error';

@Injectable({ providedIn: 'root' })
export class PlanLimitPromptService {
  constructor(private toastr: ToastrService, private router: Router) {}

  /** Returns true when the error was a plan limit and the upgrade prompt was shown. */
  handle(err: unknown): boolean {
    if (!(err instanceof PlanLimitError)) return false;

    this.toastr
      .warning(err.message, 'Employee limit reached', { timeOut: 8000, tapToDismiss: true })
      .onTap.subscribe(() => this.router.navigate(['/dashboard/billing']));
    return true;
  }
}
