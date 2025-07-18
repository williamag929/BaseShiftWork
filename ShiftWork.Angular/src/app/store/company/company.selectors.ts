import { createSelector } from '@ngrx/store';
import { AppState } from '../app.state';
import { CompanyState } from './company.state';

export const selectCompanyState = (state: AppState) => state.company;

export const selectCompanies = createSelector(
  selectCompanyState,
  (state: CompanyState) => state.companies
);

export const selectActiveCompany = createSelector(
  selectCompanyState,
  (state: CompanyState) => state.activeCompany
);

export const selectCompanyLoading = createSelector(
  selectCompanyState,
  (state: CompanyState) => state.loading
);

export const selectCompanyError = createSelector(
  selectCompanyState,
  (state: CompanyState) => state.error
);