import { ActionReducerMap } from '@ngrx/store';
import { companyReducer } from './company/company.reducer';
import { CompanyState } from './company/company.state';

export interface AppState {
  company: CompanyState;
}

export const appReducers: ActionReducerMap<AppState> = {
  company: companyReducer
};
