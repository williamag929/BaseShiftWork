import '@angular/localize/init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Observable, of, Subject, throwError } from 'rxjs';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { LocationsComponent } from './locations.component';
import '../dashboard.module';
import { LocationService } from 'src/app/core/services/location.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { AreaService } from 'src/app/core/services/area.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { Location } from 'src/app/core/models/location.model';
import { Area } from 'src/app/core/models/area.model';

const COMPANY = { companyId: 'co-1', name: 'Co' };

function loc(id: number, defaultShift?: any): Location {
  return { locationId: id, name: 'L' + id, companyId: 'co-1', defaultShift } as unknown as Location;
}

describe('LocationsComponent default shift', () => {
  let fixture: ComponentFixture<LocationsComponent>;
  let component: LocationsComponent;
  let locSvc: jasmine.SpyObj<LocationService>;
  let toastr: jasmine.SpyObj<ToastrService>;
  let location7: Location;
  let areasSource: Observable<Area[]> | null;
  const areas = [
    { areaId: 12, name: 'Gate', companyId: 'co-1', locationId: '7' },
    { areaId: 13, name: 'Dock', companyId: 'co-1', locationId: 7 },
    { areaId: 14, name: 'Other', companyId: 'co-1', locationId: 8 },
  ] as Area[];

  beforeEach(async () => {
    areasSource = null;
    location7 = loc(7, { start: '07:00', end: '15:30', areaId: 12 });
    locSvc = jasmine.createSpyObj('LocationService', ['getLocations', 'updateLocation', 'createLocation', 'setDefaultShift', 'clearDefaultShift']);
    locSvc.getLocations.and.returnValue(of([location7, loc(8)]));
    toastr = jasmine.createSpyObj('ToastrService', ['success', 'error', 'info']);

    await TestBed.configureTestingModule({
      declarations: [LocationsComponent],
      imports: [CommonModule, ReactiveFormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideMockStore({ initialState: {} }),
        { provide: LocationService, useValue: locSvc },
        { provide: AuthService, useValue: {} },
        { provide: AreaService, useValue: { getAreas: () => areasSource ?? of(areas) } },
        { provide: ToastrService, useValue: toastr },
      ],
    }).compileComponents();

    TestBed.inject(MockStore).overrideSelector(selectActiveCompany, COMPANY as any);
    fixture = TestBed.createComponent(LocationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('fills the form from the selected location default shift', () => {
    component.editLocation(location7);
    expect(component.defaultShiftForm.value).toEqual({ start: '07:00', end: '15:30', areaId: 12 });
  });

  it('leaves the form empty when the location has no default shift', () => {
    component.editLocation(loc(8));
    expect(component.defaultShiftForm.value).toEqual({ start: '', end: '', areaId: null });
  });

  it('saves the default shift once and toasts; ignores a second call while saving', () => {
    const pending = new Subject<any>();
    locSvc.setDefaultShift.and.returnValue(pending);
    component.editLocation(location7);
    component.saveDefaultShift();
    component.saveDefaultShift();
    expect(component.defaultShiftSaving).toBeTrue();
    expect(locSvc.setDefaultShift).toHaveBeenCalledTimes(1);
    expect(locSvc.setDefaultShift).toHaveBeenCalledWith('co-1', 7, { start: '07:00', end: '15:30', areaId: 12 });
    pending.next({ start: '07:00', end: '15:30', areaId: 12 });
    pending.complete();
    expect(component.defaultShiftSaving).toBeFalse();
    expect(toastr.success).toHaveBeenCalledTimes(1);
    expect(component.selectedLocation?.defaultShift).toEqual({ start: '07:00', end: '15:30', areaId: 12 });
  });

  it('allows an overnight shift', () => {
    locSvc.setDefaultShift.and.returnValue(of({ start: '22:00', end: '06:00', areaId: null }));
    component.editLocation(loc(8));
    component.defaultShiftForm.patchValue({ start: '22:00', end: '06:00' });
    expect(component.defaultShiftForm.valid).toBeTrue();
    component.saveDefaultShift();
    expect(locSvc.setDefaultShift).toHaveBeenCalledWith('co-1', 8, { start: '22:00', end: '06:00', areaId: null });
  });

  it('rejects equal start and end without calling the service', () => {
    component.editLocation(location7);
    component.defaultShiftForm.patchValue({ start: '07:00', end: '07:00' });
    expect(component.defaultShiftForm.invalid).toBeTrue();
    expect(component.defaultShiftValidationError).toContain('different');
    component.saveDefaultShift();
    expect(locSvc.setDefaultShift).not.toHaveBeenCalled();
  });

  it('rejects a start without an end', () => {
    component.editLocation(loc(8));
    component.defaultShiftForm.patchValue({ start: '07:00', end: '' });
    expect(component.defaultShiftForm.invalid).toBeTrue();
    expect(component.defaultShiftValidationError).toContain('both');
    component.saveDefaultShift();
    expect(locSvc.setDefaultShift).not.toHaveBeenCalled();
  });

  it('lists only areas of the selected location (string or number locationId)', () => {
    component.editLocation(location7);
    expect(component.defaultShiftAreas.map(a => a.areaId)).toEqual([12, 13]);
  });

  it('resets areaId when switching to a location that does not own the area', () => {
    component.editLocation(location7);
    component.editLocation(loc(8, { start: '08:00', end: '16:00', areaId: 12 }));
    expect(component.defaultShiftForm.value.areaId).toBeNull();
  });

  it('clears the default shift and empties the form', () => {
    locSvc.clearDefaultShift.and.returnValue(of(undefined));
    component.editLocation(location7);
    component.clearDefaultShift();
    expect(locSvc.clearDefaultShift).toHaveBeenCalledWith('co-1', 7);
    expect(component.defaultShiftForm.value).toEqual({ start: '', end: '', areaId: null });
    expect(toastr.success).toHaveBeenCalled();
    expect(component.selectedLocation?.defaultShift).toBeNull();
  });

  it('shows a generic error on service failure and keeps the values', () => {
    locSvc.setDefaultShift.and.returnValue(throwError(() => new Error('Bad Request')));
    component.editLocation(location7);
    component.saveDefaultShift();
    expect(component.defaultShiftError).toBeTruthy();
    expect(component.defaultShiftSaving).toBeFalse();
    expect(component.defaultShiftForm.value).toEqual({ start: '07:00', end: '15:30', areaId: 12 });
  });

  it('does not call updateLocation and hides the section when creating', () => {
    component.editLocation(location7);
    locSvc.setDefaultShift.and.returnValue(of({ start: '07:00', end: '15:30', areaId: 12 }));
    component.saveDefaultShift();
    expect(locSvc.updateLocation).not.toHaveBeenCalled();

    component.cancelEdit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.default-shift-section')).toBeNull();
    component.editLocation(location7);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.default-shift-section')).not.toBeNull();
  });

  it('keeps the saved areaId when the location is opened before areas load, then Save sends it', () => {
    const pendingAreas = new Subject<Area[]>();
    areasSource = pendingAreas;
    fixture = TestBed.createComponent(LocationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.editLocation(location7);
    expect(component.defaultShiftForm.value.areaId).toBe(12);
    pendingAreas.next(areas);
    expect(component.defaultShiftForm.value).toEqual({ start: '07:00', end: '15:30', areaId: 12 });
    locSvc.setDefaultShift.and.returnValue(of({ start: '07:00', end: '15:30', areaId: 12 }));
    component.saveDefaultShift();
    expect(locSvc.setDefaultShift).toHaveBeenCalledWith('co-1', 7, { start: '07:00', end: '15:30', areaId: 12 });
  });

  it('keeps the saved areaId when loading areas failed', () => {
    areasSource = throwError(() => new Error('x'));
    fixture = TestBed.createComponent(LocationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.editLocation(location7);
    expect(component.defaultShiftForm.value.areaId).toBe(12);
  });

  it('ignores a late response for a previously selected location and unsticks the buttons', () => {
    const pending = new Subject<any>();
    locSvc.setDefaultShift.and.returnValue(pending);
    component.editLocation(location7);
    component.saveDefaultShift();
    component.editLocation(loc(8));
    expect(component.defaultShiftSaving).toBeFalse();
    pending.next({ start: '07:00', end: '15:30', areaId: 12 });
    expect(component.defaultShiftForm.value).toEqual({ start: '', end: '', areaId: null });
    expect(component.defaultShiftError).toBeNull();
  });

  it('a late error for a previous location does not set the error on the new one', () => {
    const pending = new Subject<any>();
    locSvc.setDefaultShift.and.returnValue(pending);
    component.editLocation(location7);
    component.saveDefaultShift();
    component.editLocation(loc(8));
    pending.error(new Error('boom'));
    expect(component.defaultShiftError).toBeNull();
    expect(component.defaultShiftSaving).toBeFalse();
  });

  it('main save after a default-shift save sends defaultShift populated', () => {
    locSvc.setDefaultShift.and.returnValue(of({ start: '07:00', end: '15:30', areaId: 12 }));
    locSvc.updateLocation.and.callFake((_c: string, _id: number, l: Location) => of(l));
    component.editLocation(location7);
    component.locationForm.patchValue({ name: 'N', address: 'A', latitude: 1, longitude: 2 });
    component.saveDefaultShift();
    component.saveLocation();
    expect(locSvc.updateLocation).toHaveBeenCalled();
    const sent = locSvc.updateLocation.calls.mostRecent().args[2] as Location;
    expect(sent.defaultShift).toEqual({ start: '07:00', end: '15:30', areaId: 12 });
  });
});
