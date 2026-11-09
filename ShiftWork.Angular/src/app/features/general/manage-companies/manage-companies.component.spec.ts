import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable, of, throwError } from 'rxjs';
import { Company } from 'src/app/core/models/company.model';
import { CompanyService } from 'src/app/core/services/company.service';
import { CompanyUsersService } from 'src/app/core/services/company-users.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { ManageCompaniesComponent } from './manage-companies.component';

const company = (i: number) => ({ companyId: `c${i}`, name: `Company ${i}` }) as Company;
const member = (i: number, over: any = {}) => ({ companyUserId: `u${i}`, email: `m${i}@x.com`, displayName: `Member ${i}`, isActive: true, ...over });

describe('ManageCompaniesComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<ManageCompaniesComponent>;
  let companies: Record<string, jasmine.Spy>;
  let users: Record<string, jasmine.Spy>;
  let router: { navigate: jasmine.Spy };
  let toastr: Record<string, jasmine.Spy>;
  const el = () => fixture.nativeElement as HTMLElement;

  async function setup(list: Company[] | Observable<Company[]> = [company(1), company(2)], members: any[] = [member(1), member(2, { isActive: false })]) {
    TestBed.resetTestingModule();
    companies = {
      getCompanies: jasmine.createSpy().and.returnValue(Array.isArray(list) ? of(list) : list),
      deleteCompany: jasmine.createSpy().and.returnValue(of(undefined)),
    };
    users = {
      getCompanyUsers: jasmine.createSpy().and.returnValue(of(members)),
      deleteCompanyUser: jasmine.createSpy().and.returnValue(of(undefined)),
      createCompanyUser: jasmine.createSpy().and.returnValue(of({})),
      setCompanyUserActive: jasmine.createSpy().and.callFake((_c: string, _id: string, active: boolean) => of({ isActive: active })),
    };
    router = { navigate: jasmine.createSpy('navigate') };
    toastr = { success: jasmine.createSpy(), error: jasmine.createSpy() };
    await TestBed.configureTestingModule({
      imports: [ManageCompaniesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: CompanyService, useValue: companies },
        { provide: CompanyUsersService, useValue: users },
        { provide: PeopleService, useValue: { getPeople: () => of([{ personId: 1, name: 'Ana Ruiz', email: 'ana@x.com' }, { personId: 2, name: 'Member 1', email: 'm1@x.com' }]) } },
        { provide: Router, useValue: router },
        { provide: ToastrService, useValue: toastr },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ManageCompaniesComponent);
    await settle();
  }
  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const click = async (t: Element | null) => { (t as HTMLElement).click(); await settle(); };
  const dialogBtn = (text: string) => Array.from(document.querySelectorAll('[role="alertdialog"] button')).find(b => b.textContent!.trim().includes(text))!;

  it('renders one h1 with a single primary Create company button and no bootstrap markup', async () => {
    await setup();
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Manage companies');
    const primary = el().querySelectorAll('[variant="primary"]');
    expect(primary.length).toBe(1);
    expect(primary[0].textContent).toContain('Create company');
    expect(el().querySelector('.card, .btn, .list-group, .row')).toBeNull();
    await click(primary[0]);
    expect(router.navigate).toHaveBeenCalledWith(['/admin/company/new']);
  });

  it('lists companies in a table with labelled row actions and routes to edit', async () => {
    await setup();
    expect(el().querySelector('lz-table-scroll table')).not.toBeNull();
    expect(el().querySelectorAll('tbody tr').length).toBe(2);
    await click(el().querySelector('[aria-label="Edit Company 2"]'));
    expect(router.navigate).toHaveBeenCalledWith(['/admin/company/edit', 'c2']);
  });

  it('manages users: shows members with state chips, toggles and adds people', async () => {
    await setup();
    await click(el().querySelector('[aria-label="Manage users for Company 1"]'));
    expect(users['getCompanyUsers']).toHaveBeenCalledWith('c1');
    const chips = Array.from(el().querySelectorAll('lz-panel lz-status-chip')).map(c => c.textContent!.trim());
    expect(chips).toEqual(['Active', 'Inactive']);
    await click(el().querySelector('[aria-label="Deactivate Member 1"]'));
    expect(users['setCompanyUserActive']).toHaveBeenCalledWith('c1', 'u1', false);
    expect(toastr['success']).toHaveBeenCalledWith('Member 1 deactivated.');
    expect(el().textContent).toContain('Available users (1)');
    await click(el().querySelector('[aria-label="Add Ana Ruiz"]'));
    expect(users['createCompanyUser']).toHaveBeenCalled();
    expect(toastr['success']).toHaveBeenCalledWith('Ana Ruiz added to Company 1.');
  });

  it('deleting a company asks in an alertdialog and only deletes after confirming', async () => {
    await setup();
    await click(el().querySelector('[aria-label="Delete Company 1"]'));
    const dialog = document.querySelector('[role="alertdialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('Delete Company 1?');
    expect(companies['deleteCompany']).not.toHaveBeenCalled();
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    await click(dialogBtn('Delete company'));
    expect(companies['deleteCompany']).toHaveBeenCalledWith('c1');
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(toastr['success']).toHaveBeenCalledWith('Company deleted.');
  });

  it('Cancel and Escape leave the company alone and return focus to the delete button', async () => {
    await setup();
    const trigger = el().querySelector('[aria-label="Delete Company 1"]') as HTMLElement;
    trigger.focus();
    await click(trigger);
    await click(dialogBtn('Cancel'));
    await settle();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await click(trigger);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(companies['deleteCompany']).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it('a failed delete reports the error, keeps the row and refocuses the button', async () => {
    await setup();
    companies['deleteCompany'].and.returnValue(throwError(() => new Error('x')));
    const trigger = el().querySelector('[aria-label="Delete Company 1"]') as HTMLElement;
    trigger.focus();
    await click(trigger);
    await click(dialogBtn('Delete company'));
    await settle();
    expect(toastr['error']).toHaveBeenCalledWith('Could not delete the company.');
    expect(el().querySelectorAll('tbody tr').length).toBe(2);
    expect(document.activeElement).toBe(trigger);
  });

  it('removing a user goes through an alertdialog; failure refocuses, success moves focus to the members heading', async () => {
    await setup();
    await click(el().querySelector('[aria-label="Manage users for Company 1"]'));
    const trigger = el().querySelector('[aria-label="Remove Member 1"]') as HTMLElement;
    trigger.focus();
    await click(trigger);
    expect(users['deleteCompanyUser']).not.toHaveBeenCalled();
    users['deleteCompanyUser'].and.returnValue(throwError(() => new Error('x')));
    await click(dialogBtn('Remove user'));
    await settle();
    expect(toastr['error']).toHaveBeenCalledWith('Could not remove the user.');
    expect(document.activeElement).toBe(trigger);
    users['deleteCompanyUser'].and.returnValue(of(undefined));
    await click(trigger);
    await click(dialogBtn('Remove user'));
    await new Promise(r => setTimeout(r));
    await settle();
    expect(users['deleteCompanyUser']).toHaveBeenCalledWith('c1', 'u1');
    expect(document.activeElement!.id).toBe('mc-members-title');
  });

  it('pages more than 25 companies and clamps after a reload with fewer', async () => {
    await setup(Array.from({ length: 26 }, (_, i) => company(i + 1)));
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(el().querySelectorAll('tbody tr').length).toBe(1);
    companies['getCompanies'].and.returnValue(of(Array.from({ length: 3 }, (_, i) => company(i + 1))));
    fixture.componentInstance.loadCompanies();
    await settle();
    expect(fixture.componentInstance.companyPage).toBe(1);
    expect(el().querySelectorAll('tbody tr').length).toBe(3);
  });

  it('shows an empty state with an add action, and an alert but no empty state when loading failed', async () => {
    await setup([]);
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    await click(el().querySelector('lz-empty-state button'));
    expect(router.navigate).toHaveBeenCalledWith(['/admin/company/new']);
    await setup(throwError(() => new Error('x')));
    expect(el().querySelector('lz-empty-state')).toBeNull();
    expect(el().querySelector('lz-alert[role="alert"]')).not.toBeNull();
  });

  it('keeps row actions at least 48px tall', async () => {
    await setup();
    expect((el().querySelector('[aria-label="Edit Company 1"]') as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect((el().querySelector('[aria-label="Manage users for Company 1"]') as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect(getComputedStyle(el().querySelector('h1')!).fontSize).toBe('26px');
  });
});
