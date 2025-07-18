import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { CompanyService } from 'src/app/core/services/company.service';
import { loadCompanies, loadCompaniesSuccess, loadCompaniesFailure } from './company.actions';

@Injectable()
export class CompanyEffects {
  loadCompanies$ = createEffect(() => this.actions$.pipe(
    ofType(loadCompanies),
    mergeMap(() => this.companyService.getCompanies()
      .pipe(
        map((companies: any) => loadCompaniesSuccess({ companies })),
        catchError((error: any) => of(loadCompaniesFailure({ error })))
      ))
  ));

  constructor(
    private actions$: Actions,
    private companyService: CompanyService
  ) { }
}