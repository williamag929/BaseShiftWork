import { createReducer, on } from '@ngrx/store';
import { initialCompanyState } from './company.state';
import { loadCompanies, loadCompaniesSuccess, loadCompaniesFailure, setActiveCompany } from './company.actions';

export const companyReducer = createReducer(
  initialCompanyState,
  on(loadCompanies, state => ({
    ...state,
    loading: true,
    error: null
  })),
  on(loadCompaniesSuccess, (state, { companies }) => ({
    ...state,
    companies: companies,
    loading: false
  })),
  on(loadCompaniesFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error: error
  })),
  on(setActiveCompany, (state, { company }) => ({
    ...state,
    activeCompany: company
  }))
);