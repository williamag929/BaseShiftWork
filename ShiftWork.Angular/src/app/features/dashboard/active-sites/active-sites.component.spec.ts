import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';

import { ActiveSitesComponent } from './active-sites.component';
import { ActiveSiteService } from 'src/app/core/services/active-site.service';
import { PermissionService } from 'src/app/core/services/permission.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { ActiveSiteStatus } from 'src/app/core/models/active-site-status.model';

function buildSite(overrides: Partial<ActiveSiteStatus> = {}): ActiveSiteStatus {
  return {
    locationId: 1,
    name: 'Main Site',
    address: '123 Main St',
    onShiftCount: 1,
    roster: [
      {
        personId: 1,
        name: 'Alex Guard',
        roleName: 'Guard',
        clockInTime: '2026-01-01T09:00:00Z',
        timingStatus: 'OnTime',
        geofenceStatus: 'Inside',
        geofenceReviewed: false,
        shiftEventId: 'evt-1',
      },
    ],
    ...overrides,
  };
}

describe('ActiveSitesComponent', () => {
  let component: ActiveSitesComponent;
  let fixture: ComponentFixture<ActiveSitesComponent>;
  let activeSiteSvc: jasmine.SpyObj<ActiveSiteService>;
  let permSvc: jasmine.SpyObj<PermissionService>;

  beforeEach(async () => {
    activeSiteSvc = jasmine.createSpyObj('ActiveSiteService', ['getActiveSiteStatus', 'reviewGeofenceFlag']);
    activeSiteSvc.getActiveSiteStatus.and.returnValue(of([buildSite()]));

    permSvc = jasmine.createSpyObj('PermissionService', ['hasPermission']);
    permSvc.hasPermission.and.returnValue(true);

    const authServiceStub = { user$: of({ personId: 42 }) };

    await TestBed.configureTestingModule({
      imports: [ActiveSitesComponent],
      providers: [
        { provide: ActiveSiteService, useValue: activeSiteSvc },
        { provide: PermissionService, useValue: permSvc },
        { provide: AuthService, useValue: authServiceStub },
        provideMockStore({ initialState: {}, selectors: [{ selector: selectActiveCompany, value: { companyId: 'test' } }] }),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ActiveSitesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('loads active site status on init once the active company resolves', () => {
    fixture.detectChanges();
    expect(activeSiteSvc.getActiveSiteStatus).toHaveBeenCalledWith('test');
    expect(component.sites.length).toBe(1);
    expect(component.loading).toBeFalse();
  });

  it('sets an error and stops loading on failure', () => {
    activeSiteSvc.getActiveSiteStatus.and.returnValue(throwError(() => new Error('fail')));

    fixture.detectChanges();

    expect(component.error).toBeTruthy();
    expect(component.loading).toBeFalse();
  });

  it('isFlagged is true only for an unreviewed Outside geofence status', () => {
    fixture.detectChanges();
    const outsideUnreviewed = { ...component.sites[0].roster[0], geofenceStatus: 'Outside', geofenceReviewed: false };
    const outsideReviewed = { ...component.sites[0].roster[0], geofenceStatus: 'Outside', geofenceReviewed: true };
    const inside = { ...component.sites[0].roster[0], geofenceStatus: 'Inside', geofenceReviewed: false };

    expect(component.isFlagged(outsideUnreviewed)).toBeTrue();
    expect(component.isFlagged(outsideReviewed)).toBeFalse();
    expect(component.isFlagged(inside)).toBeFalse();
  });

  it('markReviewed calls the service and flips geofenceReviewed on success', () => {
    activeSiteSvc.reviewGeofenceFlag.and.returnValue(of({} as any));
    fixture.detectChanges();

    const site = component.sites[0];
    const entry = site.roster[0];
    entry.geofenceStatus = 'Outside';
    entry.geofenceReviewed = false;

    component.markReviewed(site, entry);

    expect(activeSiteSvc.reviewGeofenceFlag).toHaveBeenCalledWith('test', 'evt-1', 42);
    expect(entry.geofenceReviewed).toBeTrue();
  });

  it('canView and canReview reflect the permission service', () => {
    permSvc.hasPermission.and.callFake((key: string) => key === 'active-sites.view');
    expect(component.canView).toBeTrue();
    expect(component.canReview).toBeFalse();
  });
});
