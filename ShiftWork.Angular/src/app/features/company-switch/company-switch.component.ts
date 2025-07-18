import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { Company } from 'src/app/core/models/company.model';
import { loadCompanies, setActiveCompany } from 'src/app/store/company/company.actions';
import { selectCompanies, selectCompanyLoading, selectCompanyError } from 'src/app/store/company/company.selectors';
import { AppState } from 'src/app/store/app.state';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

@Component({
  selector: 'app-company-switch',
  templateUrl: './company-switch.component.html',
  styleUrls: ['./company-switch.component.css'],
  standalone: false
})
export class CompanySwitchComponent implements OnInit {
  companies$ = this.store.select(selectCompanies);
  loading$ = this.store.select(selectCompanyLoading);
  error$ = this.store.select(selectCompanyError);

  constructor(private store: Store<AppState>,
     private toastr: ToastrService,
      private router: Router) { }

  ngOnInit(): void {
    this.store.dispatch(loadCompanies());
  }

  switchCompany(company: Company): void {
    this.store.dispatch(setActiveCompany({ company }));
    this.toastr.success(`Switched to ${company.name}`);
    console.log(`Switched to company: ${company.name}`);
    this.router.navigate(['/dashboard']);
  }
}
