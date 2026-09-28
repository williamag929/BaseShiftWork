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
});
