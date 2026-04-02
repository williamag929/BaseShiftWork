import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { BehaviorSubject, of } from 'rxjs';

import { KioskComponent } from './kiosk.component';
import { AuthService } from 'src/app/core/services/auth.service';
import { KioskService } from './core/services/kiosk.service';
import { LocationService } from 'src/app/core/services/location.service';
import { LocationSelectDialogComponent } from './location-select-dialog/location-select-dialog.component';
import { AdminPasswordDialogComponent } from './admin-password-dialog/admin-password-dialog.component';
import { Location } from 'src/app/core/models/location.model';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';

// ─────────────────────────────────────────────────────────────────────────────
// Test data
// ─────────────────────────────────────────────────────────────────────────────

const mockCompany = { companyId: 'company-1', name: 'Test Company' };

const mockLocation: Location = {
  locationId: 1,
  companyId: 'company-1',
  name: 'Main Office',
  address: '123 Main St',
  city: 'New York',
  state: 'NY',
  zipCode: '10001',
  geoCoordinates: { latitude: 0, longitude: 0 } as any,
  ratioMax: 1,
  status: 'Active',
};

const initialState = {
  company: {
    companies: [],
    activeCompany: mockCompany,
    loading: false,
    error: null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function createDialogRef<T = any>(result: T | null = null): jasmine.SpyObj<MatDialogRef<T>> {
  return jasmine.createSpyObj<MatDialogRef<T>>('MatDialogRef', {
    afterClosed: of(result),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('KioskComponent', () => {
  let component: KioskComponent;
  let fixture: ComponentFixture<KioskComponent>;
  let store: MockStore<AppState>;
  let kioskServiceSpy: jasmine.SpyObj<KioskService>;
  let locationServiceSpy: jasmine.SpyObj<LocationService>;
  let dialogSpy: jasmine.SpyObj<MatDialog>;
  let selectedLocationSubject: BehaviorSubject<Location | null>;

  beforeEach(async () => {
    selectedLocationSubject = new BehaviorSubject<Location | null>(null);

    kioskServiceSpy = jasmine.createSpyObj<KioskService>('KioskService', [
      'hasDeviceLocation',
      'saveDeviceLocation',
      'setSelectedLocation',
      'clearDeviceLocation',
      'getDeviceLocation',
    ]);
    (kioskServiceSpy as any).selectedLocation$ = selectedLocationSubject.asObservable();
    kioskServiceSpy.hasDeviceLocation.and.returnValue(false);

    locationServiceSpy = jasmine.createSpyObj<LocationService>('LocationService', [
      'getLocations',
    ]);
    locationServiceSpy.getLocations.and.returnValue(of([mockLocation]));

    dialogSpy = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    // Default: dialog closes with null result — handles auto-opens from ngOnInit
    dialogSpy.open.and.returnValue(createDialogRef(null));

    await TestBed.configureTestingModule({
      imports: [KioskComponent],
      providers: [
        provideMockStore({ initialState }),
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['signOut']) },
        { provide: KioskService, useValue: kioskServiceSpy },
        { provide: LocationService, useValue: locationServiceSpy },
        { provide: MatDialog, useValue: dialogSpy },
      ],
    })
      .overrideComponent(KioskComponent, {
        // Replace the real template/imports to isolate class logic from
        // RouterOutlet / AnalogClockComponent rendering concerns.
        set: { imports: [CommonModule], template: `<div></div>` },
      })
      .compileComponents();

    store = TestBed.inject(MockStore);
    store.overrideSelector(selectActiveCompany, mockCompany);
    store.refreshState();

    fixture = TestBed.createComponent(KioskComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    store.resetSelectors();
    // Keep timers cleaned up; safe to call even if ngOnDestroy was already called.
    component.ngOnDestroy();
  });

  // ── Creation ────────────────────────────────────────────────────────────────

  describe('creation', () => {
    it('should create', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should initialise currentTime as a Date before change detection', () => {
      expect(component.currentTime).toBeInstanceOf(Date);
    });
  });

  // ── ngOnInit ─────────────────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('should set activeCompany from the store selector', () => {
      fixture.detectChanges();
      expect(component.activeCompany).toEqual(mockCompany);
    });

    it('should set selectedLocation when kioskService emits a location', () => {
      fixture.detectChanges();
      selectedLocationSubject.next(mockLocation);
      expect(component.selectedLocation).toEqual(mockLocation);
    });

    it('should open the location dialog when location is null and no device location', () => {
      fixture.detectChanges();
      expect(dialogSpy.open).toHaveBeenCalledWith(
        LocationSelectDialogComponent,
        jasmine.objectContaining({ width: '400px' }),
      );
    });

    it('should NOT open the dialog when a device location is already saved', () => {
      kioskServiceSpy.hasDeviceLocation.and.returnValue(true);
      fixture.detectChanges();
      expect(dialogSpy.open).not.toHaveBeenCalled();
    });

    it('should NOT open the dialog when selectedLocation$ emits a valid location', () => {
      // Replace the observable so ngOnInit subscribes to one that starts with a location
      selectedLocationSubject = new BehaviorSubject<Location | null>(mockLocation);
      (kioskServiceSpy as any).selectedLocation$ = selectedLocationSubject.asObservable();
      fixture.detectChanges();
      expect(dialogSpy.open).not.toHaveBeenCalled();
    });

    it('should update currentTime once per second', fakeAsync(() => {
      fixture.detectChanges();
      tick(0); // flush initial t=0 emission from timer(0, 1000)
      const t0 = component.currentTime.getTime();

      tick(1000);
      expect(component.currentTime.getTime()).toBeGreaterThan(t0);

      component.ngOnDestroy(); // clear the interval so fakeAsync zone is clean
    }));
  });

  // ── openLocationSelectDialog ──────────────────────────────────────────────────

  describe('openLocationSelectDialog', () => {
    beforeEach(() => {
      fixture.detectChanges();
      // Reset call counts polluted by the ngOnInit-triggered automatic open
      locationServiceSpy.getLocations.calls.reset();
      dialogSpy.open.calls.reset();
      kioskServiceSpy.saveDeviceLocation.calls.reset();
      kioskServiceSpy.setSelectedLocation.calls.reset();
    });

    it('should return early without opening a dialog when activeCompany is null', () => {
      component.activeCompany = null;
      component.openLocationSelectDialog();
      expect(locationServiceSpy.getLocations).not.toHaveBeenCalled();
      expect(dialogSpy.open).not.toHaveBeenCalled();
    });

    it('should fetch locations for the active company', () => {
      component.openLocationSelectDialog();
      expect(locationServiceSpy.getLocations).toHaveBeenCalledWith(mockCompany.companyId);
    });

    it('should open LocationSelectDialogComponent with the fetched locations', () => {
      component.openLocationSelectDialog();
      expect(dialogSpy.open).toHaveBeenCalledWith(
        LocationSelectDialogComponent,
        jasmine.objectContaining({ width: '400px', data: { locations: [mockLocation] } }),
      );
    });

    it('should set disableClose to true when no device location is assigned', () => {
      kioskServiceSpy.hasDeviceLocation.and.returnValue(false);
      component.openLocationSelectDialog();
      expect(dialogSpy.open).toHaveBeenCalledWith(
        LocationSelectDialogComponent,
        jasmine.objectContaining({ disableClose: true }),
      );
    });

    it('should set disableClose to false when a device location is assigned', () => {
      kioskServiceSpy.hasDeviceLocation.and.returnValue(true);
      component.openLocationSelectDialog();
      expect(dialogSpy.open).toHaveBeenCalledWith(
        LocationSelectDialogComponent,
        jasmine.objectContaining({ disableClose: false }),
      );
    });

    it('should call saveDeviceLocation when dialog closes with assignToDevice=true', () => {
      dialogSpy.open.and.returnValue(
        createDialogRef({ assignToDevice: true, location: mockLocation }),
      );
      component.openLocationSelectDialog();
      expect(kioskServiceSpy.saveDeviceLocation).toHaveBeenCalledWith(mockLocation);
      expect(kioskServiceSpy.setSelectedLocation).not.toHaveBeenCalled();
    });

    it('should call setSelectedLocation when dialog closes without assignToDevice', () => {
      dialogSpy.open.and.returnValue(
        createDialogRef({ assignToDevice: false, location: mockLocation }),
      );
      component.openLocationSelectDialog();
      expect(kioskServiceSpy.setSelectedLocation).toHaveBeenCalledWith(mockLocation);
      expect(kioskServiceSpy.saveDeviceLocation).not.toHaveBeenCalled();
    });

    it('should call neither save nor set when dialog is dismissed with no result', () => {
      dialogSpy.open.and.returnValue(createDialogRef(null));
      component.openLocationSelectDialog();
      expect(kioskServiceSpy.saveDeviceLocation).not.toHaveBeenCalled();
      expect(kioskServiceSpy.setSelectedLocation).not.toHaveBeenCalled();
    });
  });

  // ── openLocationSettings ──────────────────────────────────────────────────────

  describe('openLocationSettings', () => {
    beforeEach(() => {
      fixture.detectChanges();
      dialogSpy.open.calls.reset();
      locationServiceSpy.getLocations.calls.reset();
      kioskServiceSpy.clearDeviceLocation.calls.reset();
    });

    it('should open AdminPasswordDialogComponent with the active companyId', () => {
      dialogSpy.open.and.returnValue(createDialogRef(false));
      component.openLocationSettings();
      expect(dialogSpy.open).toHaveBeenCalledWith(
        AdminPasswordDialogComponent,
        jasmine.objectContaining({
          width: '350px',
          disableClose: true,
          data: { companyId: mockCompany.companyId },
        }),
      );
    });

    it('should clear the device location and open the location selector when authenticated', () => {
      dialogSpy.open.and.returnValues(
        createDialogRef(true),   // AdminPasswordDialog → authentication success
        createDialogRef(null),   // LocationSelectDialog → dismissed
      );
      component.openLocationSettings();
      expect(kioskServiceSpy.clearDeviceLocation).toHaveBeenCalled();
      expect(locationServiceSpy.getLocations).toHaveBeenCalledWith(mockCompany.companyId);
    });

    it('should NOT clear the device location when authentication is rejected', () => {
      dialogSpy.open.and.returnValue(createDialogRef(false));
      component.openLocationSettings();
      expect(kioskServiceSpy.clearDeviceLocation).not.toHaveBeenCalled();
      expect(locationServiceSpy.getLocations).not.toHaveBeenCalled();
    });

    it('should NOT open the location selector when dialog result is null', () => {
      dialogSpy.open.and.returnValue(createDialogRef(null));
      component.openLocationSettings();
      expect(kioskServiceSpy.clearDeviceLocation).not.toHaveBeenCalled();
    });
  });

  // ── ngOnDestroy ───────────────────────────────────────────────────────────────

  describe('ngOnDestroy', () => {
    it('should unsubscribe from the timer on destroy', () => {
      fixture.detectChanges();
      const unsubSpy = spyOn(component.timeSubscription, 'unsubscribe').and.callThrough();
      component.ngOnDestroy();
      expect(unsubSpy).toHaveBeenCalled();
    });

    it('should not throw when called before ngOnInit runs (empty subscription)', () => {
      // timeSubscription is initialised to new Subscription() in the constructor
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});
