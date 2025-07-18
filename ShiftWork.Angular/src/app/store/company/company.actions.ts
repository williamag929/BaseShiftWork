import { createAction, props } from '@ngrx/store';
import { Company } from '../../core/models/company.model';

export const loadCompanies = createAction('[Company] Load Companies');
export const loadCompaniesSuccess = createAction('[Company] Load Companies Success', props<{ companies: Company[] }>());
export const loadCompaniesFailure = createAction('[Company] Load Companies Failure', props<{ error: any }>());
export const setActiveCompany = createAction('[Company] Set Active Company', props<{ company: Company }>());