import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { CompanySwitchComponent } from './company-switch.component';
import { AppState } from 'src/app/store/app.state';
import { loadCompanies, setActiveCompany } from 'src/app/store/company/company.actions';
import { Company } from 'src/app/core/models/company.model';
import { ToastrService } from 'ngx-toastr';

describe('CompanySwitchComponent', () => {
  let component: CompanySwitchComponent;
  let fixture: ComponentFixture<CompanySwitchComponent>;
  let store: MockStore<AppState>;
  let toastrService: jasmine.SpyObj<ToastrService>;

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

    await TestBed.configureTestingModule({
      declarations: [ CompanySwitchComponent ],
      providers: [
        provideMockStore({ initialState }),
        { provide: ToastrService, useValue: toastrService }
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
      address: '',
      timezone: 'America/New_York',
    };
    component.switchCompany(company);
    expect(store.dispatch).toHaveBeenCalledWith(setActiveCompany({ company }));
    expect(toastrService.success).toHaveBeenCalledWith('Switched to Test Company');
  });
});
