import '@angular/localize/init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';
import { UserLocationScopeDialogComponent } from './user-location-scope-dialog.component';
import { CompanyUsersService } from 'src/app/core/services/company-users.service';
import { LocationService } from 'src/app/core/services/location.service';

function loc(id: number, name: string, status = 'Active'): any {
  return { locationId: id, name, status, companyId: 'co-1' };
}

describe('UserLocationScopeDialogComponent', () => {
  let fixture: ComponentFixture<UserLocationScopeDialogComponent>;
  let component: UserLocationScopeDialogComponent;
  let usersSvc: jasmine.SpyObj<CompanyUsersService>;
  let locSvc: jasmine.SpyObj<LocationService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<UserLocationScopeDialogComponent>>;

  function create(scope: number[] | 'fail' = [2, 9], locations: any[] | 'fail' = [loc(3, 'Zeta'), loc(2, 'Beta', 'Inactive'), loc(1, 'Alpha')]) {
    locSvc.getLocations.and.returnValue(locations === 'fail' ? throwError(() => new Error('x')) : of(locations));
    usersSvc.getLocationScopes.and.returnValue(scope === 'fail' ? throwError(() => new Error('x')) : of(scope));
    fixture = TestBed.createComponent(UserLocationScopeDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    usersSvc = jasmine.createSpyObj('CompanyUsersService', ['getLocationScopes', 'setLocationScopes']);
    locSvc = jasmine.createSpyObj('LocationService', ['getLocations']);
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    await TestBed.configureTestingModule({
      declarations: [UserLocationScopeDialogComponent],
      imports: [CommonModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: CompanyUsersService, useValue: usersSvc },
        { provide: LocationService, useValue: locSvc },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { companyId: 'co-1', user: { uid: 'u-1', email: 'a@b.c' } } },
      ],
    }).compileComponents();
  });

  it('loads locations and the current scope, pre-checking scoped ones', () => {
    create([1, 2]);
    expect(locSvc.getLocations).toHaveBeenCalledWith('co-1');
    expect(usersSvc.getLocationScopes).toHaveBeenCalledWith('co-1', 'u-1');
    expect(component.loading).toBeFalse();
    expect(Array.from(component.selected).sort()).toEqual([1, 2]);
  });

  it('sorts inactive locations after active ones, marks them, and keeps a scoped inactive one checked', () => {
    create([2]);
    expect(component.locations.map(l => l.locationId)).toEqual([1, 3, 2]);
    expect(component.selected.has(2)).toBeTrue();
    const items = fixture.nativeElement.querySelectorAll('.location-item');
    expect(items.length).toBe(3);
    expect(items[2].classList).toContain('inactive');
    expect(items[2].querySelector('.inactive-tag')).toBeTruthy();
    expect(items[0].querySelector('.inactive-tag')).toBeNull();
  });

  it('toggle adds and removes', () => {
    create([]);
    component.toggle(3);
    expect(component.selected.has(3)).toBeTrue();
    component.toggle(3);
    expect(component.selected.has(3)).toBeFalse();
  });

  it('save sends sorted ids once, ignores a second call while saving, and closes with the result', () => {
    create([]);
    const result = new Subject<number[]>();
    usersSvc.setLocationScopes.and.returnValue(result);
    component.toggle(3);
    component.toggle(1);
    component.save();
    component.save();
    expect(usersSvc.setLocationScopes).toHaveBeenCalledTimes(1);
    expect(usersSvc.setLocationScopes).toHaveBeenCalledWith('co-1', 'u-1', [1, 3]);
    expect(component.saving).toBeTrue();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button.save').disabled).toBeTrue();
    result.next([1, 3]);
    expect(dialogRef.close).toHaveBeenCalledWith([1, 3]);
  });

  it('shows a generic error on save failure and keeps the dialog open and re-enabled', () => {
    create([1]);
    usersSvc.setLocationScopes.and.returnValue(throwError(() => new Error('Unknown locations: 9')));
    component.save();
    expect(component.error).toBeTruthy();
    expect(component.error).not.toContain('Unknown locations');
    expect(component.saving).toBeFalse();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('allows saving with nothing selected and shows the warning', () => {
    create([]);
    usersSvc.setLocationScopes.and.returnValue(of([]));
    expect(fixture.nativeElement.querySelector('.none-warning')).toBeTruthy();
    component.save();
    expect(usersSvc.setLocationScopes).toHaveBeenCalledWith('co-1', 'u-1', []);
    expect(dialogRef.close).toHaveBeenCalledWith([]);
  });

  it('hides the warning when something is selected', () => {
    create([1]);
    expect(fixture.nativeElement.querySelector('.none-warning')).toBeNull();
  });

  it('shows error_load and blocks saving when loading fails', () => {
    create('fail');
    expect(component.error).toContain('Could not load');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button.save').disabled).toBeTrue();
    component.save();
    expect(usersSvc.setLocationScopes).not.toHaveBeenCalled();
  });

  it('selectAll and clear work', () => {
    create([]);
    component.selectAll();
    expect(component.selected.size).toBe(3);
    component.clear();
    expect(component.selected.size).toBe(0);
  });

  it('preserves scoped ids that are not in the locations list, unless cleared', () => {
    create([1, 99]);
    expect(component.selected.has(99)).toBeFalse();
    usersSvc.setLocationScopes.and.returnValue(of([1, 99]));
    component.save();
    expect(usersSvc.setLocationScopes).toHaveBeenCalledWith('co-1', 'u-1', [1, 99]);

    create([1, 99]);
    usersSvc.setLocationScopes.calls.reset();
    component.clear();
    component.save();
    expect(usersSvc.setLocationScopes).toHaveBeenCalledWith('co-1', 'u-1', []);
  });

  it('cancel closes with undefined', () => {
    create([]);
    component.cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });
});
