import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { Observable, of, throwError } from 'rxjs';
import { CompanyUsersService } from 'src/app/core/services/company-users.service';
import { selectActiveCompany, selectCompanies } from 'src/app/store/company/company.selectors';
import { CompanyUsersAdminComponent } from './company-users-admin.component';

const user = (i: number, over: any = {}) => ({ companyUserId: `u${i}`, email: `u${i}@x.com`, displayName: `User ${i}`, uid: i % 2 ? 'abc' : 'invite_1', isActive: true, createdAt: new Date(2026, 0, 15), ...over });

describe('CompanyUsersAdminComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<CompanyUsersAdminComponent>;
  let svc: Record<string, jasmine.Spy>;
  let toastr: Record<string, jasmine.Spy>;
  const el = () => fixture.nativeElement as HTMLElement;

  afterEach(() => {
    selectCompanies.clearResult();
    selectActiveCompany.clearResult();
  });

  async function setup(list: any[] | Observable<any[]> = [user(1), user(2, { isActive: false })]) {
    TestBed.resetTestingModule();
    svc = {
      getCompanyUsers: jasmine.createSpy().and.returnValue(Array.isArray(list) ? of(list) : list),
      setCompanyUserActive: jasmine.createSpy().and.callFake((_c: string, _id: string, a: boolean) => of({ isActive: a })),
    };
    toastr = { success: jasmine.createSpy(), error: jasmine.createSpy() };
    await TestBed.configureTestingModule({
      imports: [CompanyUsersAdminComponent],
      providers: [
        provideNoopAnimations(),
        provideMockStore({ selectors: [
          { selector: selectCompanies, value: [{ companyId: 'c1', name: 'MRS' }] },
          { selector: selectActiveCompany, value: { companyId: 'c1', name: 'MRS' } },
        ] }),
        { provide: CompanyUsersService, useValue: svc },
        { provide: ToastrService, useValue: toastr },
      ],
    }).compileComponents();
    TestBed.inject(MockStore).dispatch = jasmine.createSpy('dispatch');
    fixture = TestBed.createComponent(CompanyUsersAdminComponent);
    await settle();
  }
  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const click = async (t: Element | null) => { (t as HTMLElement).click(); await settle(); };

  it('renders one h1, no primary button and a labelled company select with state chips in a scrollable table', async () => {
    await setup();
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Company users');
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(0);
    expect(el().querySelector('label[for="cua-company"]')).not.toBeNull();
    expect(el().querySelector('lz-table-scroll table')).not.toBeNull();
    const chips = Array.from(el().querySelectorAll('tbody lz-status-chip')).map(c => c.textContent!.trim());
    expect(chips).toEqual(['Firebase', 'Active', 'Invite', 'Inactive']);
    expect(el().querySelector('mat-card, mat-table, .badge, .status-chip')).toBeNull();
  });

  it('toggles a user with a labelled icon button and toasts the result', async () => {
    await setup();
    await click(el().querySelector('[aria-label="Deactivate u1@x.com"]'));
    expect(svc['setCompanyUserActive']).toHaveBeenCalledWith('c1', 'u1', false);
    expect(toastr['success']).toHaveBeenCalledWith('User u1@x.com deactivated.');
    svc['setCompanyUserActive'].and.returnValue(throwError(() => new Error('x')));
    await click(el().querySelector('[aria-label="Activate u2@x.com"]'));
    expect(toastr['error']).toHaveBeenCalledWith('Could not update the user status.');
  });

  it('pages more than 25 users and clamps the page when the list shrinks', async () => {
    await setup(Array.from({ length: 26 }, (_, i) => user(i + 1)));
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(el().querySelectorAll('tbody tr').length).toBe(1);
    svc['getCompanyUsers'].and.returnValue(of([user(1), user(2)]));
    await click(Array.from(el().querySelectorAll('button')).find(b => b.textContent!.includes('Refresh'))!);
    expect(fixture.componentInstance.page).toBe(1);
    expect(el().querySelectorAll('tbody tr').length).toBe(2);
  });

  it('shows the empty state only when there are no users and no load error', async () => {
    await setup([]);
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    expect(el().querySelector('lz-alert[role="alert"]')).toBeNull();
    await setup(throwError(() => new Error('x')));
    expect(el().querySelector('lz-empty-state')).toBeNull();
    expect(el().querySelector('lz-alert[role="alert"]')).not.toBeNull();
  });

  it('keeps targets at least 48px and the heading 26px', async () => {
    await setup();
    expect((el().querySelector('[aria-label="Deactivate u1@x.com"]') as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect((el().querySelector('#cua-company') as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect(getComputedStyle(el().querySelector('h1')!).fontSize).toBe('26px');
  });
});
