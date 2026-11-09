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

  describe('rendering', () => {
    const companies = [
      { companyId: '1', name: 'Alpha Co' },
      { companyId: '2', name: 'Beta Co' },
    ] as Company[];

    const render = (patch: Record<string, unknown>) => {
      store.setState({ company: { ...initialState.company, ...patch } } as unknown as AppState);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    it('renders each company as a button of at least 48px that switches company', () => {
      const root = render({ companies });
      spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      const rows = Array.from(root.querySelectorAll('button[lzButton]')) as HTMLButtonElement[];
      expect(rows.length).toBe(2);
      expect(rows[0].textContent).toContain('Alpha Co');
      expect(rows[0].classList.contains('min-h-12')).toBeTrue();
      expect(rows[0].getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
      expect(root.querySelector('div[class*=company-item]')).toBeNull();
      expect(getComputedStyle(rows[0]).justifyContent).toBe('space-between');
      spyOn(store, 'dispatch');
      rows[1].click();
      expect(store.dispatch).toHaveBeenCalledWith(setActiveCompany({ company: companies[1] }));
    });

    it('renders one h1 and a danger alert on error', () => {
      const root = render({ error: 'boom' });
      expect(root.querySelectorAll('h1').length).toBe(1);
      const alert = root.querySelector('lz-alert')!;
      expect(alert.getAttribute('role')).toBe('alert');
      expect(alert.className).toContain('bg-danger-bg');
    });

    it('renders the empty state as an info alert', () => {
      const root = render({ companies: [] });
      expect(root.querySelector('lz-alert')!.textContent).toContain('No companies available');
    });

    it('uses the wide shell only when there are more than four companies', () => {
      const many = Array.from({ length: 5 }, (_, i) => ({ companyId: `${i}`, name: `C${i}` })) as Company[];
      let card = render({ companies })!.querySelector('lz-auth-shell > div')!;
      expect(card.classList.contains('max-w-md')).toBeTrue();
      card = render({ companies: many }).querySelector('lz-auth-shell > div')!;
      expect(card.classList.contains('max-w-2xl')).toBeTrue();
    });
  });
});
