import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { SummaryShift, SummaryShiftService } from 'src/app/core/services/summary-shift.service';
import { LocationService } from 'src/app/core/services/location.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { Location } from 'src/app/core/models/location.model';
import { People } from 'src/app/core/models/people.model';
import { Company } from 'src/app/core/models/company.model';
import { CommonModule } from '@angular/common';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';


@Component({
  selector: 'app-shiftsummaries',
  templateUrl: './shiftsummaries.component.html',
  styleUrls: ['./shiftsummaries.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule]
})
export class ShiftsummariesComponent implements OnInit {

  filterForm: FormGroup = this.fb.group({
    startDate: [new Date().toISOString().substring(0, 10)],
    endDate: [new Date().toISOString().substring(0, 10)],
    locationId: [null],
    personId: [null]
  });
  shifts$: Observable<SummaryShift[]> = of([]);
  locations$: Observable<Location[]> = of([]);
  people$: Observable<People[]> = of([]);
  activeCompany$: Observable<any>;
  activeCompany: any;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private summaryShiftService: SummaryShiftService,
    private locationService: LocationService,
    private peopleService: PeopleService,
    private authService: AuthService,
    private store: Store<AppState>
  ) {

    this.activeCompany$ = this.store.select(selectActiveCompany);

    this.activeCompany$.subscribe((company: any) => {
      if (company) {
        this.activeCompany = company;
        console.log('Active company set:', this.activeCompany);
      } else {
        console.log('No active company found');
      }
    });

  }

  ngOnInit(): void {
    this.activeCompany$.subscribe((company: { companyId: string }) => {
      if (company) {
        this.activeCompany = company;
        console.log('Active company set:', this.activeCompany);
        this.loading = true;
        this.activeCompany = company;
        this.locations$ = this.locationService.getLocations(company.companyId);
        this.people$ = this.peopleService.getPeople(company.companyId);
        this.getShifts();
        this.loading = false;
      }
    });
  }


  getShifts(): void {
    if (this.filterForm.valid && this.activeCompany) {
      const { startDate, endDate, locationId, personId } = this.filterForm.value;
      this.shifts$ = this.summaryShiftService.getSummaryShifts(
        this.activeCompany.companyId,
        startDate,
        endDate,
        locationId,
        personId
      );
    }
  }
}
