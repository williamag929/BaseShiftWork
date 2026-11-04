import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { CompanySwitchComponent } from './company-switch.component';
import './company-switch.module';
import { AppState } from 'src/app/store/app.state';
import { loadCompanies, setActiveCompany } from 'src/app/store/company/company.actions';
import { Company } from 'src/app/core/models/company.model';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

describe('CompanySwitchComponent', () => {
  let component: CompanySwitchComponent;
  let fixture: ComponentFixture<CompanySwitchComponent>;
  let store: MockStore<AppState>;
  let toastrService: jasmine.SpyObj<ToastrService>;
  const route = { snapshot: { queryParamMap: convertToParamMap({}) } };

  const initialState = {
    company: {
      companies: [],
      activeCompany: null,
      loading: false,
      error: null
    }
  };

  beforeEach(async () => {
    toastrService = jasmine.createSpyObj('ToastrService', ['success']);
    route.snapshot.queryParamMap = convertToParamMap({});

    await TestBed.configureTestingModule({
      declarations: [ CompanySwitchComponent ],
      providers: [
        provideMockStore({ initialState }),
        { provide: ToastrService, useValue: toastrService },
        { provide: ActivatedRoute, useValue: route }
      ]
    })
    .compileComponents();

    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(CompanySwitchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should dispatch loadCompanies action on init', () => {
    spyOn(store, 'dispatch');
    component.ngOnInit();
    expect(store.dispatch).toHaveBeenCalledWith(loadCompanies());
  });

  it('should dispatch setActiveCompany action and show success toastr on switchCompany', () => {
    spyOn(store, 'dispatch');
    const company: Company = {
      companyId: '1', name: 'Test Company', email: 'test@test.com', phoneNumber: '1234567890', website: 'test.com',
      address: '', timeZone: 'America/New_York',
    };
    component.switchCompany(company);
    expect(store.dispatch).toHaveBeenCalledWith(setActiveCompany({ company }));
    expect(toastrService.success).toHaveBeenCalledWith('Switched to Test Company');
  });

  describe('landing page after switching', () => {
    const company = { companyId: '1', name: 'Test Company' } as Company;
    let navigate: jasmine.Spy;

    beforeEach(() => {
      navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    });

    it('goes to the dashboard by default', () => {
      component.switchCompany(company);
      expect(navigate).toHaveBeenCalledWith('/dashboard');
    });

    it('honours ?next= for a dashboard page', () => {
      route.snapshot.queryParamMap = convertToParamMap({ next: '/dashboard/people' });
      component.switchCompany(company);
      expect(navigate).toHaveBeenCalledWith('/dashboard/people');
    });

    it('ignores ?next= pointing anywhere else', () => {
      for (const next of ['https://evil.example', '//evil.example', '/admin', '/dashboard/../admin']) {
        navigate.calls.reset();
        route.snapshot.queryParamMap = convertToParamMap({ next });
        component.switchCompany(company);
        expect(navigate).toHaveBeenCalledWith('/dashboard');
      }
    });
  });
});
