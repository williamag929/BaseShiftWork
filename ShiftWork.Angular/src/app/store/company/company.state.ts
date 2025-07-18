
import { Company } from 'src/app/core/models/company.model';

export interface CompanyState {
  companies: Company[];
  activeCompany: Company | null;
  loading: boolean;
  error: any;
}

export const initialCompanyState: CompanyState = {
  companies: [],
  activeCompany: null,
  loading: false,
  error: null
};