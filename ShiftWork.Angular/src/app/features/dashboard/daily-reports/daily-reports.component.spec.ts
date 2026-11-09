import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { DailyReportsComponent } from './daily-reports.component';
import './daily-reports.module';
import { DailyReportService } from 'src/app/core/services/daily-report.service';
import { LocationService } from 'src/app/core/services/location.service';
import { PermissionService } from 'src/app/core/services/permission.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { DailyReport } from 'src/app/core/models/daily-report.model';
import { Location } from 'src/app/core/models/location.model';
import { Company } from 'src/app/core/models/company.model';
import { SharedModule } from 'src/app/shared/shared.module';

const MOCK_COMPANY: Company = {
  companyId: 'co-test', name: 'Test Co', address: '1 Main St',
  phoneNumber: '555-0000', email: 'test@test.com', website: 'https://test.com', timeZone: 'UTC'
};

const MOCK_LOCATION: Location = {
  locationId: 1, name: 'Main Office', companyId: 'co-test',
  address: '1 Main St', city: 'Testville', state: 'TX', zipCode: '12345',
  geoCoordinates: { latitude: 0, longitude: 0 },
  ratioMax: 10, status: 'Active'
};

const MOCK_REPORT: DailyReport = {
  reportId: 'r1', companyId: 'co-test', locationId: 1, reportDate: '2026-04-30',
  totalEmployees: 5, totalHours: 40, status: 'Draft', notes: 'All clear.', media: [],
  createdAt: '2026-04-30T00:00:00Z', updatedAt: '2026-04-30T00:00:00Z'
};

describe('DailyReportsComponent', () => {
  let component: DailyReportsComponent;
  let fixture: ComponentFixture<DailyReportsComponent>;
  let store: MockStore;
  let reportSvc: jasmine.SpyObj<DailyReportService>;
  let locationSvc: jasmine.SpyObj<LocationService>;
  let permSvc: jasmine.SpyObj<PermissionService>;

  beforeEach(async () => {
    reportSvc = jasmine.createSpyObj('DailyReportService', ['getReport', 'updateReport', 'addMedia', 'removeMedia']);
    locationSvc = jasmine.createSpyObj('LocationService', ['getLocations']);
    permSvc = jasmine.createSpyObj('PermissionService', ['hasPermission']);

    permSvc.hasPermission.and.returnValue(false);
    locationSvc.getLocations.and.returnValue(of([MOCK_LOCATION]));
    reportSvc.getReport.and.returnValue(of(MOCK_REPORT));

    await TestBed.configureTestingModule({
      declarations: [DailyReportsComponent],
      imports: [ReactiveFormsModule, NoopAnimationsModule, SharedModule],
      providers: [
        provideMockStore({ initialState: {} }),
        { provide: DailyReportService, useValue: reportSvc },
        { provide: LocationService, useValue: locationSvc },
        { provide: PermissionService, useValue: permSvc },
        { provide: ToastrService, useValue: { success: () => {}, error: () => {} } }
      ]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    store.overrideSelector(selectActiveCompany, MOCK_COMPANY);

    fixture = TestBed.createComponent(DailyReportsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads report for first location on init', () => {
    fixture.detectChanges();

    expect(component.report).toEqual(MOCK_REPORT);
    expect(component.notes).toBe('All clear.');
    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBeNull();
  });

  it('sets errorMessage when getReport fails', () => {
    reportSvc.getReport.and.returnValue(throwError(() => new Error('fail')));

    fixture.detectChanges();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBeTruthy();
  });

  it('retry() clears error and reloads report', () => {
    reportSvc.getReport.and.returnValue(throwError(() => new Error('fail')));
    fixture.detectChanges();
    expect(component.errorMessage).toBeTruthy();

    reportSvc.getReport.and.returnValue(of(MOCK_REPORT));
    component.retry();

    expect(component.errorMessage).toBeNull();
    expect(component.report).toEqual(MOCK_REPORT);
  });

  it('saveDraft() calls updateReport with Draft status', () => {
    fixture.detectChanges();
    reportSvc.updateReport.and.returnValue(of({ ...MOCK_REPORT, status: 'Draft' }));
    component.notes = 'Updated notes';

    component.saveDraft();

    expect(reportSvc.updateReport).toHaveBeenCalledWith(
      'co-test', 1, 'r1', { notes: 'Updated notes', status: 'Draft' }
    );
  });

  it('submitReport() calls updateReport with Submitted status', () => {
    fixture.detectChanges();
    const submitted = { ...MOCK_REPORT, status: 'Submitted' };
    reportSvc.updateReport.and.returnValue(of(submitted));

    component.submitReport();

    expect(reportSvc.updateReport).toHaveBeenCalledWith(
      'co-test', 1, 'r1', { notes: 'All clear.', status: 'Submitted' }
    );
    expect(component.report!.status).toBe('Submitted');
  });

  it('canApprove reflects permission service', () => {
    permSvc.hasPermission.and.callFake(key => key === 'reports.approve');
    expect(component.canApprove).toBeTrue();
  });

  it('weatherDesc returns No data when report has no weather', () => {
    fixture.detectChanges();
    component.report = { ...MOCK_REPORT, weatherData: null };

    expect(component.weatherDesc()).toBe('No data');
  });

  it('weatherIcon returns wb_sunny when no weather data', () => {
    fixture.detectChanges();
    component.report = { ...MOCK_REPORT, weatherData: null };

    expect(component.weatherIcon()).toBe('wb_sunny');
  });

  it('statusColor returns primary for Approved, accent for Submitted', () => {
    expect(component.statusColor('Approved')).toBe('primary');
    expect(component.statusColor('Submitted')).toBe('accent');
    expect(component.statusColor('Draft')).toBe('');
  });
});

describe('DailyReportsComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<DailyReportsComponent>;
  let reportSvc: jasmine.SpyObj<DailyReportService>;
  let perms: jasmine.SpyObj<PermissionService>;
  let toastr: { success: jasmine.Spy; error: jasmine.Spy };
  const el = () => fixture.nativeElement as HTMLElement;
  const report = (extra: Partial<DailyReport> = {}): DailyReport => ({
    ...MOCK_REPORT, totalHours: 40.25, weatherData: { description: 'Light rain', temperature: 61.4 }, ...extra,
  });

  async function setup(result: DailyReport | { fail: unknown }, canApprove = false, locations: Location[] = [MOCK_LOCATION]) {
    reportSvc = jasmine.createSpyObj('DailyReportService', ['getReport', 'updateReport']);
    reportSvc.getReport.and.returnValue('fail' in result ? throwError(() => result.fail) : of(result as DailyReport));
    reportSvc.updateReport.and.callFake((_c, _l, _id, dto) => of({ ...MOCK_REPORT, ...dto }));
    perms = jasmine.createSpyObj('PermissionService', ['hasPermission']);
    perms.hasPermission.and.callFake((k: string) => k === 'reports.approve' && canApprove);
    toastr = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') };
    await TestBed.configureTestingModule({
      declarations: [DailyReportsComponent],
      imports: [ReactiveFormsModule, NoopAnimationsModule, SharedModule],
      providers: [
        provideMockStore({ initialState: {}, selectors: [{ selector: selectActiveCompany, value: MOCK_COMPANY }] }),
        { provide: DailyReportService, useValue: reportSvc },
        { provide: LocationService, useValue: { getLocations: () => of(locations) } },
        { provide: PermissionService, useValue: perms },
        { provide: ToastrService, useValue: toastr },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DailyReportsComponent);
    await settle();
  }

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const click = async (target: Element | null) => {
    (target as HTMLElement).click();
    await settle();
  };

  it('renders one h1 through lz-page-header and exactly one primary button, with no Material form fields', async () => {
    await setup(report());
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Daily reports');
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    expect(el().querySelector('[variant="primary"]')!.textContent).toContain('Submit');
    expect(el().querySelector('mat-form-field, .page-container, .stat-card, .status-banner')).toBeNull();
  });

  it('moves the primary button to Approve when a submitted report can be approved', async () => {
    await setup(report({ status: 'Submitted' }), true);
    const primary = el().querySelectorAll('[variant="primary"]');
    expect(primary.length).toBe(1);
    expect(primary[0].textContent).toContain('Approve');
  });

  it('shows employees, hours and weather in an lz-summary-strip', async () => {
    await setup(report());
    const strip = el().querySelector('lz-summary-strip')!;
    const text = strip.textContent!;
    expect(text).toContain('5');
    expect(text).toContain('Employees');
    expect(text).toContain('40.3');
    expect(text).toContain('Total hours');
    expect(text).toContain('61°');
    expect(text).toContain('Light rain');
  });

  it('shows the status as text in an lz-status-chip', async () => {
    await setup(report({ status: 'Submitted' }));
    expect(el().querySelector('lz-status-chip')!.textContent!.trim()).toBe('Submitted');
  });

  it('shows lz-empty-state for a missing report but not together with a load error', async () => {
    await setup({ fail: new Error('boom') });
    expect(el().querySelector('lz-alert[role="alert"]')!.textContent).toContain('Could not load the report');
    expect(el().querySelector('lz-empty-state')).toBeNull();
    reportSvc.getReport.and.returnValue(of(report()));
    await click(Array.from(el().querySelectorAll('lz-alert button')).find(b => b.textContent!.includes('Retry'))!);
    expect(reportSvc.getReport).toHaveBeenCalledTimes(2);
    expect(el().querySelector('lz-alert[role="alert"]')).toBeNull();
    expect(el().querySelector('lz-summary-strip')).not.toBeNull();
  });

  it('shows lz-empty-state for access denied without an error alert or a second empty state', async () => {
    await setup({ fail: { status: 403 } });
    expect(el().querySelectorAll('lz-empty-state').length).toBe(1);
    expect(el().querySelector('lz-empty-state')!.textContent).toContain('Access denied');
    expect(el().querySelector('lz-alert[role="alert"]')).toBeNull();
  });

  it('asks to select a location when there are none', async () => {
    await setup(report(), false, []);
    expect(el().querySelectorAll('lz-empty-state').length).toBe(1);
    expect(el().querySelector('lz-empty-state')!.textContent).toContain('Select a location');
  });

  it('saving a draft shows a localized sentence-case toast and a failure shows an error toast', async () => {
    await setup(report());
    await click(Array.from(el().querySelectorAll('button')).find(b => b.textContent!.includes('Save draft'))!);
    expect(toastr.success).toHaveBeenCalledWith('Draft saved.');
    reportSvc.updateReport.and.returnValue(throwError(() => new Error('boom')));
    await click(Array.from(el().querySelectorAll('button')).find(b => b.textContent!.includes('Save draft'))!);
    expect(toastr.error).toHaveBeenCalledWith('Could not save the draft.');
  });

  it('submitting and approving show localized toasts', async () => {
    await setup(report({ status: 'Submitted' }), true);
    await click(Array.from(el().querySelectorAll('button')).find(b => b.textContent!.includes('Approve'))!);
    expect(toastr.success).toHaveBeenCalledWith('Report approved.');
  });

  it('the date field loads the report for the chosen day and previous/next day buttons are labelled', async () => {
    await setup(report());
    const date = el().querySelector('#report-date') as HTMLInputElement;
    date.value = '2026-05-02';
    date.dispatchEvent(new Event('change'));
    await settle();
    expect(reportSvc.getReport).toHaveBeenCalledWith('co-test', 1, '2026-05-02');
    await click(el().querySelector('[aria-label="Next day"]'));
    expect(reportSvc.getReport).toHaveBeenCalledWith('co-test', 1, '2026-05-03');
    await click(el().querySelector('[aria-label="Previous day"]'));
    expect(reportSvc.getReport).toHaveBeenCalledWith('co-test', 1, '2026-05-02');
  });

  it('keeps controls and action buttons at least 48px', async () => {
    await setup(report({ status: 'Submitted' }), true);
    const targets = [
      ...Array.from(el().querySelectorAll('select[lzField], input[lzField], textarea[lzField]')),
      ...Array.from(el().querySelectorAll('button')),
    ];
    expect(targets.length).toBeGreaterThan(5);
    for (const t of targets) {
      expect(t.getBoundingClientRect().height).withContext(t.id || t.textContent!.trim() || t.getAttribute('aria-label') || '').toBeGreaterThanOrEqual(48);
    }
  });

  for (const width of [360, 768]) {
    it(`has no horizontal page overflow at ${width}px`, async () => {
      await setup(report({ media: [{ mediaId: 'm1', mediaType: 'photo', mediaUrl: 'x.png', caption: 'Gate', personId: 1, uploadedAt: '' }] }));
      const host = el();
      host.style.display = 'block';
      host.style.width = `${Math.min(width, window.innerWidth)}px`;
      expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
      expect(document.body.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      expect(el().querySelector('lz-panel li')!.textContent).toContain('Gate');
    });
  }
});
