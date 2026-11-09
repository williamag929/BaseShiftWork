import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
import { CompanyService } from 'src/app/core/services/company.service';
import { CompanyFormComponent } from './company-form.component';

describe('CompanyFormComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<CompanyFormComponent>;
  let service: Record<string, jasmine.Spy>;
  let toastr: { success: jasmine.Spy };
  let navigate: jasmine.Spy;
  const el = () => fixture.nativeElement as HTMLElement;

  async function setup(id: string | null = null) {
    TestBed.resetTestingModule();
    service = {
      getCompany: jasmine.createSpy().and.returnValue(of({ name: 'MRS', address: '1 Main', phoneNumber: '555', email: 'a@b.co', timeZone: 'America/New_York' })),
      updateCompany: jasmine.createSpy().and.returnValue(of({})),
      createCompany: jasmine.createSpy().and.returnValue(of({})),
    };
    toastr = { success: jasmine.createSpy() };
    await TestBed.configureTestingModule({
      imports: [CompanyFormComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: CompanyService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => id } } } },
        { provide: ToastrService, useValue: toastr },
      ],
    }).compileComponents();
    navigate = spyOn(TestBed.inject(Router), 'navigate');
    fixture = TestBed.createComponent(CompanyFormComponent);
    await settle();
  }
  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const fill = async (id: string, value: string) => {
    const i = el().querySelector(`#${id}`) as HTMLInputElement;
    i.value = value;
    i.dispatchEvent(new Event(i.tagName === 'SELECT' ? 'change' : 'input'));
    await settle();
  };

  it('renders one h1, one primary button and required cues on the required fields only', async () => {
    await setup();
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Create company');
    const primary = el().querySelectorAll('[variant="primary"]');
    expect(primary.length).toBe(1);
    expect(primary[0].textContent).toContain('Create company');
    for (const id of ['company-name', 'company-address', 'company-phone', 'company-email', 'company-timezone']) {
      expect(el().querySelector(`label[for="${id}"]`)!.textContent).withContext(id).toContain('*');
    }
    for (const id of ['company-website', 'company-currency', 'company-logo-url', 'company-external-code']) {
      expect(el().querySelector(`label[for="${id}"]`)!.textContent).withContext(id).not.toContain('*');
    }
    expect(el().querySelector('mat-card, mat-form-field')).toBeNull();
  });

  it('keeps Create disabled until valid, then creates with the form values and navigates back', async () => {
    await setup();
    const submit = el().querySelector('[variant="primary"]') as HTMLButtonElement;
    expect(submit.disabled).toBeTrue();
    await fill('company-name', 'MRS');
    await fill('company-address', '1 Main');
    await fill('company-phone', '555');
    await fill('company-email', 'a@b.co');
    await fill('company-timezone', 'America/New_York');
    expect(submit.disabled).toBeFalse();
    submit.click();
    await settle();
    expect(service['createCompany']).toHaveBeenCalled();
    expect(service['createCompany'].calls.mostRecent().args[0].name).toBe('MRS');
    expect(toastr.success).toHaveBeenCalledWith('Company created.');
    expect(navigate).toHaveBeenCalledWith(['/general/manage-companies']);
  });

  it('shows an inline error for an invalid email after touching it', async () => {
    await setup();
    await fill('company-email', 'nope');
    (el().querySelector('#company-email') as HTMLElement).dispatchEvent(new Event('blur'));
    await settle();
    expect(el().querySelector('#company-email-error')!.textContent).toContain('valid email');
  });

  it('edit mode prefills and saves changes, and shows an alert if saving fails', async () => {
    await setup('c1');
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Edit company');
    expect((el().querySelector('#company-name') as HTMLInputElement).value).toBe('MRS');
    const submit = el().querySelector('[variant="primary"]') as HTMLButtonElement;
    expect(submit.textContent).toContain('Save changes');
    service['updateCompany'].and.returnValue(throwError(() => new Error('x')));
    submit.click();
    await settle();
    expect(el().querySelector('lz-alert[role="alert"]')!.textContent).toContain('Could not update the company.');
    expect(navigate).not.toHaveBeenCalled();
    service['updateCompany'].and.returnValue(of({}));
    submit.click();
    await settle();
    expect(toastr.success).toHaveBeenCalledWith('Company updated.');
  });

  it('keeps inputs 48px tall and the heading 26px', async () => {
    await setup();
    expect((el().querySelector('#company-name') as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect(getComputedStyle(el().querySelector('h1')!).fontSize).toBe('26px');
  });
});
