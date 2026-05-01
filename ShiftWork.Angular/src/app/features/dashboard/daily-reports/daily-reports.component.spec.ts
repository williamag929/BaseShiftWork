import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { DailyReportsComponent } from './daily-reports.component';
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
