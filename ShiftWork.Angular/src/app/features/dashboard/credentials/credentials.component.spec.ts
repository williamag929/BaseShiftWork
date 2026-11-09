import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { CredentialsComponent } from './credentials.component';
import { CredentialService } from 'src/app/core/services/credential.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { PermissionService } from 'src/app/core/services/permission.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { Credential } from 'src/app/core/models/credential.model';
import { Company } from 'src/app/core/models/company.model';

const MOCK_COMPANY: Company = {
  companyId: 'co-test', name: 'Test Co', address: '1 Main St',
  phoneNumber: '555-0000', email: 'test@test.com', website: 'https://test.com', timeZone: 'UTC'
};

const MOCK_CREDENTIAL: Credential = {
  credentialId: 'c1',
  companyId: 'co-test',
  personId: 1,
  personName: 'Jane Doe',
  name: 'OSHA 30',
  type: 'Certification',
  expiryDate: '2026-12-01T00:00:00Z',
  expiryStatus: 'Valid',
  hasDocument: false,
  status: 'Active',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('CredentialsComponent', () => {
  let component: CredentialsComponent;
  let fixture: ComponentFixture<CredentialsComponent>;
  let store: MockStore;
  let credentialSvc: jasmine.SpyObj<CredentialService>;
  let permSvc: jasmine.SpyObj<PermissionService>;

  beforeEach(async () => {
    credentialSvc = jasmine.createSpyObj('CredentialService', [
      'getCredentials', 'getExpiring', 'createCredential', 'initiateUpload', 'uploadToS3',
      'confirmUpload', 'updateCredential', 'archiveCredential', 'getCredential'
    ]);
    permSvc = jasmine.createSpyObj('PermissionService', ['hasPermission']);
    permSvc.hasPermission.and.returnValue(true);

    credentialSvc.getCredentials.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [CredentialsComponent, NoopAnimationsModule],
      providers: [
        provideMockStore({ initialState: {} }),
        { provide: CredentialService, useValue: credentialSvc },
        { provide: PeopleService, useValue: { getPeople: () => of([]) } },
        { provide: PermissionService, useValue: permSvc },
        { provide: ToastrService, useValue: { success: () => {}, error: () => {}, warning: () => {} } }
      ]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    store.overrideSelector(selectActiveCompany, MOCK_COMPANY);

    fixture = TestBed.createComponent(CredentialsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sets loading=false and populates credentials after successful load', () => {
    credentialSvc.getCredentials.and.returnValue(of([MOCK_CREDENTIAL]));

    fixture.detectChanges();

    expect(component.loading).toBeFalse();
    expect(component.credentials.length).toBe(1);
    expect(component.errorMessage).toBeNull();
  });

  it('sets errorMessage on load failure', () => {
    credentialSvc.getCredentials.and.returnValue(throwError(() => new Error('Network error')));

    fixture.detectChanges();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBeTruthy();
  });

  it('retry() clears error and reloads', () => {
    credentialSvc.getCredentials.and.returnValue(throwError(() => new Error('fail')));
    fixture.detectChanges();
    expect(component.errorMessage).toBeTruthy();

    credentialSvc.getCredentials.and.returnValue(of([]));
    component.retry();

    expect(component.errorMessage).toBeNull();
  });

  it('permission getters reflect permission service', () => {
    permSvc.hasPermission.and.callFake(key => key === 'credentials.create');
    expect(component.canCreate).toBeTrue();
    expect(component.canUpdate).toBeFalse();
    expect(component.canDelete).toBeFalse();
  });

  it('client-side filters credentials by expiry status', () => {
    const expired: Credential = { ...MOCK_CREDENTIAL, credentialId: 'c2', expiryStatus: 'Expired' };
    credentialSvc.getCredentials.and.returnValue(of([MOCK_CREDENTIAL, expired]));
    fixture.detectChanges();
    expect(component.credentials.length).toBe(2);

    component.statusFilter = 'Expired';
    component.loadCredentials();

    expect(component.credentials.length).toBe(1);
    expect(component.credentials[0].credentialId).toBe('c2');
  });

  it('startEdit populates the form and startCreate/cancelForm reset it', () => {
    fixture.detectChanges(); // triggers ngOnInit, which builds the reactive form
    component.startEdit(MOCK_CREDENTIAL);
    expect(component.editing).toBe(MOCK_CREDENTIAL);
    expect(component.form.get('name')?.value).toBe('OSHA 30');

    component.cancelForm();
    expect(component.showForm).toBeFalse();
    expect(component.editing).toBeNull();
  });

  it('archive removes the credential from the list on success', () => {
    component.credentials = [MOCK_CREDENTIAL];
    credentialSvc.archiveCredential.and.returnValue(of(undefined));
    component.activeCompany = MOCK_COMPANY;

    component.archive(MOCK_CREDENTIAL, new Event('click'));

    expect(credentialSvc.archiveCredential).toHaveBeenCalledWith('co-test', 'c1');
    expect(component.credentials.length).toBe(0);
  });

  describe('design system', () => {
    const el = () => fixture.nativeElement as HTMLElement;
    const panel = () => document.querySelector('lz-side-panel [role="dialog"]') as HTMLElement | null;
    const credential = (id: number, overrides: Partial<Credential> = {}): Credential => ({
      ...MOCK_CREDENTIAL, credentialId: `c${id}`, name: `Credential ${id}`, ...overrides,
    });
    const many = (n: number) => Array.from({ length: n }, (_, i) => credential(i + 1));
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const load = async (list: Credential[]) => {
      credentialSvc.getCredentials.and.returnValue(of(list));
      await settle();
    };
    const click = async (target: Element | null) => {
      (target as HTMLElement).click();
      await settle();
    };

    it('renders one h1 via lz-page-header and exactly one primary button', async () => {
      await load([credential(1)]);
      expect(el().querySelectorAll('h1').length).toBe(1);
      expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Credentials');
      const primary = el().querySelectorAll('[variant="primary"]');
      expect(primary.length).toBe(1);
      expect(primary[0].textContent).toContain('Add credential');
      expect(el().querySelector('.cta-btn, .status-chip, .cred-table')).toBeNull();
    });

    it('lists credentials in lz-table-scroll with scoped headers', async () => {
      await load([credential(1)]);
      expect(el().querySelector('lz-table-scroll table')).not.toBeNull();
      el().querySelectorAll('thead th').forEach(th => expect(th.getAttribute('scope')).toBe('col'));
    });

    it('shows expired, expiring and valid as lz-status-chip with text and distinct colors', async () => {
      await load([
        credential(1, { expiryStatus: 'Expired' }),
        credential(2, { expiryStatus: 'ExpiringSoon' }),
        credential(3, { expiryStatus: 'Valid' }),
      ]);
      const chips = Array.from(el().querySelectorAll('tbody lz-status-chip[data-testid="status"]'));
      expect(chips.map(c => c.textContent!.trim())).toEqual(['Expired', 'Expiring soon', 'Valid']);
      const bg = chips.map(c => getComputedStyle(c.firstElementChild as HTMLElement).backgroundColor);
      expect(new Set(bg).size).toBe(3);
    });

    it('shows lz-empty-state and no table when empty', async () => {
      await load([]);
      expect(el().querySelector('lz-empty-state')).not.toBeNull();
      expect(el().querySelector('lz-table-scroll')).toBeNull();
    });

    it('renders no form until the panel opens, then titles it Add credential', async () => {
      await load([credential(1)]);
      expect(document.querySelector('form')).toBeNull();
      await click(el().querySelector('lz-page-header button'));
      expect(panel()!.querySelector('form')).not.toBeNull();
      expect(panel()!.querySelector('h2')!.textContent).toContain('Add credential');
    });

    it('clicking a row opens the panel titled with the credential name', async () => {
      await load([credential(1)]);
      await click(el().querySelector('tbody tr'));
      expect(panel()!.querySelector('h2')!.textContent).toContain('Credential 1');
      expect((panel()!.querySelector('#cred-name') as HTMLInputElement).value).toBe('Credential 1');
    });

    it('closing a dirty panel asks to discard', async () => {
      await load([credential(1)]);
      await click(el().querySelector('lz-page-header button'));
      const input = panel()!.querySelector('#cred-name') as HTMLInputElement;
      input.value = 'New';
      input.dispatchEvent(new Event('input'));
      await settle();
      await click(panel()!.querySelector('[aria-label="Close"]'));
      expect(panel()!.textContent).toContain('Discard your changes?');
    });

    it('renders 25 of 120 rows with lz-pager', async () => {
      await load(many(120));
      expect(el().querySelectorAll('tbody tr').length).toBe(25);
      expect(el().querySelector('lz-pager')!.textContent).toContain('1–25 of 120');
    });

    it('keeps row action targets at 48px', async () => {
      await load([credential(1)]);
      const box = (el().querySelector('[aria-label="Edit Credential 1"]') as HTMLElement).getBoundingClientRect();
      expect(box.width).toBeGreaterThanOrEqual(48);
      expect(box.height).toBeGreaterThanOrEqual(48);
    });

    for (const width of [360, 768]) {
      it(`scrolls the table inside lz-table-scroll without page overflow at ${width}px`, async () => {
        await load(many(3));
        const host = fixture.nativeElement as HTMLElement;
        host.style.display = 'block';
        host.style.width = `${width}px`;
        const scroll = el().querySelector('lz-table-scroll') as HTMLElement;
        expect(getComputedStyle(scroll).overflowX).toBe('auto');
        expect(scroll.clientWidth).toBeLessThanOrEqual(width);
        expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
      });
    }
  });
});
