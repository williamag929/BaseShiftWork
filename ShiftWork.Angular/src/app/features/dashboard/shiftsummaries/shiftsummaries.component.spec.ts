import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';

import { ShiftsummariesComponent } from './shiftsummaries.component';
import { SummaryShiftService } from 'src/app/core/services/summary-shift.service';
import { LocationService } from 'src/app/core/services/location.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';

describe('ShiftsummariesComponent', () => {
  let component: ShiftsummariesComponent;
  let fixture: ComponentFixture<ShiftsummariesComponent>;

  beforeEach(async () => {
    const summaryShiftServiceStub = {
      getSummaryShifts: () => of([]),
      upsertApproval: () => of({})
    };
    const locationServiceStub = { getLocations: () => of([]) };
    const peopleServiceStub = { getPeople: () => of([]) };
    const authServiceStub = { user$: of({ personId: 1 }) };

    await TestBed.configureTestingModule({
      imports: [ShiftsummariesComponent],
      providers: [
        { provide: SummaryShiftService, useValue: summaryShiftServiceStub },
        { provide: LocationService, useValue: locationServiceStub },
        { provide: PeopleService, useValue: peopleServiceStub },
        { provide: AuthService, useValue: authServiceStub },
        provideMockStore({ initialState: {}, selectors: [{ selector: selectActiveCompany, value: { companyId: 'test' } }] })
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShiftsummariesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
