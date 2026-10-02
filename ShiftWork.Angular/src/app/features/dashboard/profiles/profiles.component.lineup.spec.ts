import '@angular/localize/init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { ProfilesComponent } from './profiles.component';
import { SharedModule } from 'src/app/shared/shared.module';
import { RoleService } from 'src/app/core/services/role.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { CompanyUserProfileService } from 'src/app/core/services/company-user-profile.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { Role } from 'src/app/core/models/role.model';

const COMPANY = { companyId: 'co-1', name: 'Co' };
const LINEUP = ['lineup.view', 'lineup.edit', 'lineup.all-locations'];

describe('ProfilesComponent lineup permissions', () => {
  let fixture: ComponentFixture<ProfilesComponent>;
  let component: ProfilesComponent;
  let roleSvc: jasmine.SpyObj<RoleService>;

  beforeEach(async () => {
    roleSvc = jasmine.createSpyObj('RoleService', ['getRoles', 'createRole', 'updateRole']);
    roleSvc.getRoles.and.returnValue(of([]));
    roleSvc.createRole.and.callFake((_c: string, r: Role) => of(r));
    roleSvc.updateRole.and.callFake((_c: string, _id: number, r: Role) => of(r));

    await TestBed.configureTestingModule({
      declarations: [ProfilesComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        provideMockStore({ initialState: {} }),
        { provide: RoleService, useValue: roleSvc },
        { provide: PeopleService, useValue: { getPeople: () => of([]) } },
        { provide: CompanyUserProfileService, useValue: {} },
        { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['success', 'error', 'info']) },
      ],
    }).compileComponents();

    TestBed.inject(MockStore).overrideSelector(selectActiveCompany, COMPANY as any);
    fixture = TestBed.createComponent(ProfilesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('has a Lineup group with exactly the three keys', () => {
    expect(component.availablePermissions['Lineup']).toEqual(LINEUP);
  });

  it('builds a form control for each lineup key', () => {
    const perms = component.roleForm.get('permissions') as any;
    for (const k of LINEUP) {
      expect(perms.controls[k]).toBeTruthy();
    }
  });

  it('labels the lineup keys', () => {
    expect(component.getPermissionLabel('lineup.view')).toBe('View');
    expect(component.getPermissionLabel('lineup.edit')).toBe('Edit');
    expect(component.getPermissionLabel('lineup.all-locations')).toBe('All locations');
    expect(component.getPermissionLabel('crews.assign')).toBe('Assign');
  });

  it('renders the Lineup group and labels', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Lineup');
    expect(text).toContain('All locations');
  });

  it('checks the control for a role holding lineup.edit', () => {
    component.editRole({ roleId: 1, name: 'Foreman', description: 'd', status: 'Active', companyId: 'co-1', permissions: ['lineup.edit'] });
    const perms = component.roleForm.get('permissions') as any;
    expect(perms.controls['lineup.edit'].value).toBeTrue();
    expect(perms.controls['lineup.view'].value).toBeFalsy();
  });

  it('sends checked lineup keys when saving a role', () => {
    component.editRole({ roleId: 1, name: 'Foreman', description: 'd', status: 'Active', companyId: 'co-1', permissions: ['lineup.edit'] });
    (component.roleForm.get('permissions') as any).controls['lineup.all-locations'].setValue(true);
    component.saveRole();
    const sent = roleSvc.updateRole.calls.mostRecent().args[2] as Role;
    expect(sent.permissions.sort()).toEqual(['lineup.all-locations', 'lineup.edit']);
  });

  it('sends lineup keys when creating a role', () => {
    component.cancelEdit();
    component.roleForm.patchValue({ name: 'N', description: 'D' });
    (component.roleForm.get('permissions') as any).controls['lineup.view'].setValue(true);
    component.saveRole();
    const sent = roleSvc.createRole.calls.mostRecent().args[1] as Role;
    expect(sent.permissions).toEqual(['lineup.view']);
  });
});
