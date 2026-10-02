import '@angular/localize/init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { BehaviorSubject, of } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { CompanyUsersAdminComponent } from './company-users-admin.component';
import { UserLocationScopeDialogComponent } from '../user-location-scope-dialog/user-location-scope-dialog.component';
import { CompanyUsersService } from 'src/app/core/services/company-users.service';
import { PermissionService } from 'src/app/core/services/permission.service';
import { HasPermissionDirective } from 'src/app/core/directives/has-permission.directive';
import { selectCompanies, selectActiveCompany } from 'src/app/store/company/company.selectors';

const USERS = [
  { companyUserId: 'cu-1', uid: 'u-1', email: 'a@x.com', displayName: 'A', isActive: true, createdAt: new Date() },
  { companyUserId: 'cu-2', uid: 'u-2', email: 'b@x.com', displayName: 'B', isActive: true, createdAt: new Date() },
];

describe('CompanyUsersAdminComponent location scope', () => {
  let fixture: ComponentFixture<CompanyUsersAdminComponent>;
  let perms$: BehaviorSubject<{ permissions: string[] } | null>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let toastr: jasmine.SpyObj<ToastrService>;

  function setup(permissions: string[]) {
    perms$ = new BehaviorSubject<{ permissions: string[] } | null>({ permissions });
    const permissionService = {
      permissions$: perms$.asObservable(),
      hasAllPermissions: (p: string[]) => !!perms$.value && p.every(x => perms$.value!.permissions.includes(x)),
    };
    dialog = jasmine.createSpyObj('MatDialog', ['open']);
    dialog.open.and.returnValue({ afterClosed: () => of([1]) } as any);
    toastr = jasmine.createSpyObj('ToastrService', ['success', 'error']);
    TestBed.configureTestingModule({
      declarations: [CompanyUsersAdminComponent],
      imports: [CommonModule, MatTableModule, HasPermissionDirective],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideMockStore({
          initialState: {},
          selectors: [
            { selector: selectCompanies, value: [{ companyId: 'co-1', name: 'Co' }] },
            { selector: selectActiveCompany, value: { companyId: 'co-1', name: 'Co' } },
          ],
        }),
        { provide: CompanyUsersService, useValue: { getCompanyUsers: () => of(USERS) } },
        { provide: PermissionService, useValue: permissionService },
        { provide: MatDialog, useValue: dialog },
        { provide: ToastrService, useValue: toastr },
      ],
    });
    fixture = TestBed.createComponent(CompanyUsersAdminComponent);
    fixture.detectChanges();
    fixture.detectChanges();
  }

  it('renders one Locations button per user row with the permission', () => {
    setup(['company-users.roles.update']);
    expect(fixture.nativeElement.querySelectorAll('button.scope-btn').length).toBe(2);
  });

  it('omits the button without the permission', () => {
    setup(['company-users.read']);
    expect(fixture.nativeElement.querySelectorAll('button.scope-btn').length).toBe(0);
  });

  it('opens the dialog with companyId and user, and toasts on save', () => {
    setup(['company-users.roles.update']);
    fixture.nativeElement.querySelectorAll('button.scope-btn')[1].click();
    expect(dialog.open).toHaveBeenCalledTimes(1);
    const [cmp, cfg] = dialog.open.calls.mostRecent().args as any[];
    expect(cmp).toBe(UserLocationScopeDialogComponent);
    expect(cfg.data).toEqual({ companyId: 'co-1', user: USERS[1] });
    expect(toastr.success).toHaveBeenCalled();
  });
});
