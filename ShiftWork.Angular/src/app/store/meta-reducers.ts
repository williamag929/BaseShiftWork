import { ActionReducer, MetaReducer } from '@ngrx/store';
import { CompanyState } from './company/company.state';
import { AppState } from './app.state';

export function companyMetaReducer(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  return function (state, action) {
    const nextState = reducer(state, action);
    // You can add logic here to modify the company state if needed
    return nextState;
  };
}

export const metaReducers: MetaReducer<AppState>[] = [companyMetaReducer];
