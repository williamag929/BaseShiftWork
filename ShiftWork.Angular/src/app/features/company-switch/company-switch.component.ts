import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '@ngrx/store';
import { Company } from 'src/app/core/models/company.model';
import { loadCompanies, setActiveCompany } from 'src/app/store/company/company.actions';
import { selectCompanies, selectCompanyLoading, selectCompanyError } from 'src/app/store/company/company.selectors';
import { AppState } from 'src/app/store/app.state';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';

@Component({
  selector: 'app-company-switch',
  templateUrl: './company-switch.component.html',
  styleUrls: ['./company-switch.component.css'],
  standalone: false
})
export class CompanySwitchComponent implements OnInit, OnDestroy {
  companies$ = this.store.select(selectCompanies);
  loading$ = this.store.select(selectCompanyLoading);
  error$ = this.store.select(selectCompanyError);
  private autoSwitchSub?: Subscription;

  constructor(private store: Store<AppState>,
     private toastr: ToastrService,
      private router: Router) { }

  ngOnInit(): void {
    this.store.dispatch(loadCompanies());

    // Auto-select if user belongs to exactly one company
    this.autoSwitchSub = this.companies$.pipe(
      filter(companies => companies !== null && companies !== undefined && companies.length > 0),
      take(1)
    ).subscribe(companies => {
      if (companies.length === 1) {
        this.switchCompany(companies[0]);
      }
    });
  }

  ngOnDestroy(): void {
    this.autoSwitchSub?.unsubscribe();
  }

  switchCompany(company: Company): void {
    this.store.dispatch(setActiveCompany({ company }));
    this.toastr.success(`Switched to ${company.name}`);
    console.log(`Switched to company: ${company.name}`);
    this.router.navigate(['/dashboard']);
  }
}
