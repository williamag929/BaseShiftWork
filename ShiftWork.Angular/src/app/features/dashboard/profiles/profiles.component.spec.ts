import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MockStore } from '@ngrx/store/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatIconModule } from '@angular/material/icon';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { Observable, of, throwError } from 'rxjs';
import { Role } from 'src/app/core/models/role.model';
import { CompanyUserProfileService } from 'src/app/core/services/company-user-profile.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { RoleService } from 'src/app/core/services/role.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import {
  LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzFieldComponent, LzFieldDirective, LzPageHeaderComponent, LzPagerComponent,
  LzSidePanelComponent, LzStatusChipComponent, LzTableDirective, LzTableScrollComponent,
} from 'src/app/shared/ui';
import { AssignUsersPanelComponent } from './assign-users-panel.component';
import { ProfilesComponent } from './profiles.component';

const role = (id: number, over: Partial<Role> = {}): Role => ({ roleId: id, name: `Role ${id}`, description: `Desc ${id}`, status: 'Active', permissions: ['crews.read', 'crews.assign'], companyId: 'c1', ...over } as Role);

describe('ProfilesComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<ProfilesComponent>;
  let roles: Record<string, jasmine.Spy>;
  let profiles: Record<string, jasmine.Spy>;
  let toastr: Record<string, jasmine.Spy>;
  const el = () => fixture.nativeElement as HTMLElement;

  afterEach(() => selectActiveCompany.clearResult());
  const panel = () => document.querySelector('lz-side-panel [role="dialog"]') as HTMLElement | null;
  const assign = () => document.querySelector('app-assign-users-panel [role="dialog"]') as HTMLElement | null;

  let peopleList: any[] | undefined;
  async function setup(list: Role[] | Observable<Role[]> = [role(1), role(2, { status: 'Inactive' })], ppl?: any[]) {
    peopleList = ppl;
    TestBed.resetTestingModule();
    roles = {
      getRoles: jasmine.createSpy().and.returnValue(Array.isArray(list) ? of(list) : list),
      createRole: jasmine.createSpy().and.callFake((_c: string, r: Role) => of({ ...r, roleId: 50 })),
      updateRole: jasmine.createSpy().and.callFake((_c: string, _id: number, r: Role) => of(r)),
    };
    profiles = {
      getRoleProfiles: jasmine.createSpy().and.returnValue(of([{ profileId: 9, personId: 1, isActive: true }])),
      assignRoleToPerson: jasmine.createSpy().and.returnValue(of({})),
      removeRoleAssignment: jasmine.createSpy().and.returnValue(of({})),
    };
    toastr = { success: jasmine.createSpy(), error: jasmine.createSpy(), info: jasmine.createSpy() };
    await TestBed.configureTestingModule({
      declarations: [ProfilesComponent],
      imports: [
        ReactiveFormsModule, MatIconModule, AssignUsersPanelComponent, LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzFieldComponent,
        LzFieldDirective, LzPageHeaderComponent, LzPagerComponent, LzSidePanelComponent, LzStatusChipComponent, LzTableDirective, LzTableScrollComponent,
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideNoopAnimations(),
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'c1' } }] }),
        { provide: RoleService, useValue: roles },
        { provide: CompanyUserProfileService, useValue: profiles },
        { provide: PeopleService, useValue: { getPeople: () => of(peopleList ?? [{ personId: 1, name: 'Ana Ruiz', email: 'ana@x.com' }, { personId: 2, name: 'Bo Li', email: 'bo@x.com' }]) } },
        { provide: ToastrService, useValue: toastr },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfilesComponent);
    await settle();
  }
  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const click = async (t: Element | null) => { (t as HTMLElement).click(); await settle(); };
  const setInput = async (root: ParentNode, sel: string, value: string) => {
    const i = root.querySelector(sel) as HTMLInputElement;
    i.value = value;
    i.dispatchEvent(new Event('input'));
    await settle();
  };

  it('renders one h1, one primary Add role button and no legacy markup or form before opening', async () => {
    await setup();
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Roles and permissions');
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    expect(el().querySelector('[variant="primary"]')!.textContent).toContain('Add role');
    expect(document.querySelector('form#role-form')).toBeNull();
    expect(el().querySelector('.page-container, .role-item, mat-form-field, mat-checkbox')).toBeNull();
  });

  it('lists roles in lz-table-scroll with status chips that carry text and a permission count', async () => {
    await setup();
    expect(el().querySelector('lz-table-scroll table')).not.toBeNull();
    const rows = el().querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('lz-status-chip')!.textContent!.trim()).toBe('Active');
    expect(rows[1].querySelector('lz-status-chip')!.textContent!.trim()).toBe('Inactive');
    expect(rows[0].textContent).toContain('2');
    el().querySelectorAll('thead th').forEach(th => expect(th.getAttribute('scope')).toBe('col'));
  });

  it('Add role opens the side panel with required cues, one primary, and creates the role with selected permissions', async () => {
    await setup();
    await click(el().querySelector('lz-page-header button'));
    expect(panel()).not.toBeNull();
    expect(el().querySelector('lz-page-header [variant]')!.getAttribute('variant')).toBe('secondary');
    expect(document.querySelectorAll('[variant="primary"]').length).toBe(1);
    expect(panel()!.querySelector('label[for="role-name"]')!.textContent).toContain('*');
    expect(panel()!.querySelector('label[for="role-desc"]')!.textContent).toContain('*');
    const submit = document.querySelector('lz-side-panel button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBeTrue();
    await setInput(panel()!, '#role-name', 'Foreman');
    await setInput(panel()!, '#role-desc', 'Runs a site');
    const perm = Array.from(panel()!.querySelectorAll('fieldset')).find(f => f.querySelector('legend')!.textContent!.trim() === 'Crews')!.querySelectorAll('input[type="checkbox"]')[0] as HTMLInputElement;
    perm.click();
    await settle();
    await click(submit);
    expect(roles['createRole']).toHaveBeenCalled();
    const sent = roles['createRole'].calls.mostRecent().args[1];
    expect(sent.name).toBe('Foreman');
    expect(sent.permissions).toEqual(['crews.read']);
    expect(toastr['success']).toHaveBeenCalledWith('Role created.');
    expect(panel()).toBeNull();
    expect(el().querySelectorAll('tbody tr').length).toBe(3);
  });

  it('keeps the panel open with an alert when creating fails', async () => {
    await setup();
    roles['createRole'].and.returnValue(throwError(() => new Error('x')));
    await click(el().querySelector('lz-page-header button'));
    await setInput(panel()!, '#role-name', 'Foreman');
    await setInput(panel()!, '#role-desc', 'Runs a site');
    await click(document.querySelector('lz-side-panel button[type="submit"]'));
    expect(panel()).not.toBeNull();
    expect(panel()!.querySelector('lz-alert[role="alert"]')!.textContent).toContain('Could not create the role.');
  });

  it('editing prefills the form and permissions, saves through updateRole and does not leak into the next new role', async () => {
    await setup();
    const opener = el().querySelector('[aria-label="Edit Role 1"]') as HTMLElement;
    opener.focus();
    await click(opener);
    expect((panel()!.querySelector('#role-name') as HTMLInputElement).value).toBe('Role 1');
    const checked = Array.from(panel()!.querySelectorAll('input[type="checkbox"]')).filter(c => (c as HTMLInputElement).checked);
    expect(checked.length).toBe(2);
    await setInput(panel()!, '#role-name', 'Role 1b');
    await click(document.querySelector('lz-side-panel button[type="submit"]'));
    expect(roles['updateRole']).toHaveBeenCalled();
    expect(roles['updateRole'].calls.mostRecent().args[2].name).toBe('Role 1b');
    expect(toastr['success']).toHaveBeenCalledWith('Role updated.');
    await click(el().querySelector('lz-page-header button'));
    expect((panel()!.querySelector('#role-name') as HTMLInputElement).value).toBe('');
    expect(Array.from(panel()!.querySelectorAll('input[type="checkbox"]')).some(c => (c as HTMLInputElement).checked)).toBeFalse();
  });

  it('clicking a row opens the editor once, and the edit button does not double fire the row click', async () => {
    await setup();
    const spy = spyOn(fixture.componentInstance, 'editRole').and.callThrough();
    await click(el().querySelector('tbody tr'));
    expect(spy).toHaveBeenCalledTimes(1);
    await click(panel()!.querySelector('[aria-label="Close"]'));
    await settle();
    spy.calls.reset();
    const opener = el().querySelector('[aria-label="Edit Role 1"]') as HTMLElement;
    opener.focus();
    await click(opener);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(panel()!.querySelectorAll('#role-name').length).toBe(1);
    await click(panel()!.querySelector('[aria-label="Close"]'));
    await settle();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('pages more than 25 roles', async () => {
    await setup(Array.from({ length: 26 }, (_, i) => role(i + 1)));
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(el().querySelectorAll('tbody tr').length).toBe(1);
  });

  it('clamps the roles page when a company switch reloads fewer roles', async () => {
    await setup(Array.from({ length: 26 }, (_, i) => role(i + 1)));
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(fixture.componentInstance.page).toBe(2);
    roles['getRoles'].and.returnValue(of([role(1), role(2), role(3)]));
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectActiveCompany, { companyId: 'c2' } as any);
    store.refreshState();
    await settle();
    expect(fixture.componentInstance.page).toBe(1);
    expect(el().querySelectorAll('tbody tr').length).toBe(3);
  });

  it('pages the people in the assign dialog beyond 25', async () => {
    const ppl = Array.from({ length: 30 }, (_, i) => ({ personId: i + 1, name: `Person ${i + 1}`, email: `p${i + 1}@x.com` }));
    await setup(undefined, ppl);
    await click(el().querySelector('[aria-label="Assign users to Role 1"]'));
    expect(assign()!.querySelectorAll('li').length).toBe(25);
    await click(assign()!.querySelector('lz-pager [aria-label="Next page"]'));
    expect(assign()!.querySelectorAll('li').length).toBe(5);
    await setInput(assign()!, '#assign-search', 'Person 3');
    expect(assign()!.querySelectorAll('li').length).toBe(2);
  });

  it('shows the empty state with an add action that opens the panel, and no empty state when loading failed', async () => {
    await setup([]);
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    await click(el().querySelector('lz-empty-state button'));
    expect(panel()).not.toBeNull();
    await setup(throwError(() => new Error('x')));
    expect(el().querySelector('lz-empty-state')).toBeNull();
    expect(el().querySelector('lz-alert[role="alert"]')).not.toBeNull();
  });

  it('assigns users in a dialog, saving the added and removed people', async () => {
    await setup();
    await click(el().querySelector('[aria-label="Assign users to Role 1"]'));
    expect(assign()).not.toBeNull();
    expect(assign()!.textContent).toContain('Assign users to Role 1');
    expect(document.querySelectorAll('[variant="primary"]').length).toBe(1);
    expect(el().querySelector('lz-page-header [variant]')!.getAttribute('variant')).toBe('secondary');
    const boxes = assign()!.querySelectorAll('input[type="checkbox"]');
    expect((boxes[0] as HTMLInputElement).checked).toBeTrue();
    (boxes[0] as HTMLElement).click();
    (boxes[1] as HTMLElement).click();
    await settle();
    await click(Array.from(assign()!.querySelectorAll('button')).find(b => b.textContent!.trim() === 'Save')!);
    expect(profiles['assignRoleToPerson']).toHaveBeenCalledWith('c1', { personId: 2, roleId: 1 });
    expect(profiles['removeRoleAssignment']).toHaveBeenCalledWith('c1', 9);
    expect(toastr['success']).toHaveBeenCalledWith('Role assignments updated.');
    expect(assign()).toBeNull();
  });

  it('Escape closes the assign dialog and returns focus to its button', async () => {
    await setup();
    const opener = el().querySelector('[aria-label="Assign users to Role 1"]') as HTMLElement;
    opener.focus();
    await click(opener);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    await settle();
    expect(assign()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('filters and pages the people in the assign dialog', async () => {
    await setup();
    await click(el().querySelector('[aria-label="Assign users to Role 1"]'));
    await setInput(assign()!, '#assign-search', 'bo');
    expect(assign()!.querySelectorAll('li').length).toBe(1);
    await setInput(assign()!, '#assign-search', 'nobody');
    expect(assign()!.textContent).toContain('No people found.');
  });

  it('uses accessible sizes: 24px checkboxes in 48px rows and 26px heading', async () => {
    await setup();
    await click(el().querySelector('[aria-label="Edit Role 1"]'));
    const cb = panel()!.querySelector('input[type="checkbox"]') as HTMLElement;
    expect(cb.getBoundingClientRect().width).toBeGreaterThanOrEqual(24);
    expect((cb.closest('label') as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect(getComputedStyle(el().querySelector('h1')!).fontSize).toBe('26px');
    expect((el().querySelector('[aria-label="Edit Role 1"]') as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
  });
});
