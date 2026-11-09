import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { of, throwError } from 'rxjs';
import { RegistrationComponent } from './registration.component';
import { RegistrationService } from '../../core/services/registration.service';
import { AuthService } from '../../core/services/auth.service';

let afAuthStub: unknown;

// AngularFireAuth is providedIn: 'any', so TestBed providers do not reach a standalone component;
// element-level providers on a host do.
@Component({
  standalone: true,
  imports: [RegistrationComponent],
  providers: [{ provide: AngularFireAuth, useFactory: () => afAuthStub }],
  template: '<app-registration style="display: block" />',
})
class HostComponent {}

describe('RegistrationComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let component: RegistrationComponent;
  let root: HTMLElement;
  let afAuth: { createUserWithEmailAndPassword: jasmine.Spy };
  let registrationService: jasmine.SpyObj<RegistrationService>;
  let firebaseUser: { uid: string; updateProfile: jasmine.Spy; sendEmailVerification: jasmine.Spy; getIdToken: jasmine.Spy; delete: jasmine.Spy };

  const q = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const qa = (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));
  const primaries = () => qa('button[lzButton][variant=primary]');

  function render(width = 1280): void {
    root.style.display = 'block';
    root.style.width = `${width}px`;
    fixture.detectChanges();
  }

  function fillStep1(): void {
    component.userForm.patchValue({ displayName: 'Ana Diaz', email: 'ana@example.com', password: 'secret123' });
    fixture.detectChanges();
  }

  function fillStep2(): void {
    component.companyForm.patchValue({ companyName: 'Acme Corp', companyEmail: 'hello@acme.com' });
    fixture.detectChanges();
  }

  const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

  function submitForm(): void {
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    firebaseUser = {
      uid: 'u1',
      updateProfile: jasmine.createSpy().and.resolveTo(),
      sendEmailVerification: jasmine.createSpy().and.resolveTo(),
      getIdToken: jasmine.createSpy().and.resolveTo('tok'),
      delete: jasmine.createSpy().and.resolveTo(),
    };
    afAuth = { createUserWithEmailAndPassword: jasmine.createSpy().and.resolveTo({ user: firebaseUser }) };
    registrationService = jasmine.createSpyObj('RegistrationService', ['register']);
    registrationService.register.and.returnValue(of({ companyId: 'c1', plan: 'Trial' } as any));

    await TestBed.configureTestingModule({
      imports: [HostComponent, RouterTestingModule],
      providers: [
        { provide: RegistrationService, useValue: registrationService },
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['SetUserData']) },
      ],
    }).compileComponents();
    afAuthStub = afAuth;
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    component = fixture.debugElement.query(By.directive(RegistrationComponent)).componentInstance;
    root = fixture.nativeElement;
    render();
  });

  afterEach(() => sessionStorage.clear());

  it('renders in the wide auth shell with a single h1 and no legacy classes', () => {
    expect(root.querySelector('lz-auth-shell')).toBeTruthy();
    expect(q('lz-auth-shell > div').classList.contains('max-w-2xl')).toBeTrue();
    expect(qa('h1').length).toBe(1);
    expect(q('h1').textContent!.trim()).toBe('Create your Loqzen account');
    expect(qa('.btn, .form-control, .fa, .reg-card').length).toBe(0);
  });

  it('shows step progress as text and exactly one primary button on every step', () => {
    expect(q('[data-step-heading]').textContent).toContain('Step 1 of 3');
    expect(primaries().length).toBe(1);
    expect(primaries()[0].textContent!.trim()).toBe('Next: company info');

    fillStep1();
    component.onNext();
    fixture.detectChanges();
    expect(q('[data-step-heading]').textContent).toContain('Step 2 of 3');
    expect(primaries().length).toBe(1);
    expect(primaries()[0].textContent!.trim()).toBe('Next: confirm');
    const back = qa('button[type=button]').find((b) => b.textContent!.trim() === 'Back')!;
    expect(back.getAttribute('variant')).toBe('secondary');

    fillStep2();
    component.onNext();
    fixture.detectChanges();
    expect(q('[data-step-heading]').textContent).toContain('Step 3 of 3');
    expect(primaries().length).toBe(1);
    expect(primaries()[0].textContent!.trim()).toBe('Create account');
    expect(qa('h1').length).toBe(1);
  });

  it('marks required fields and keeps autocomplete attributes', () => {
    expect(qa('lz-field label span[aria-hidden=true]').length).toBe(3);
    expect(q<HTMLInputElement>('#displayName').autocomplete).toBe('name');
    expect(q<HTMLInputElement>('#email').autocomplete).toBe('email');
    expect(q<HTMLInputElement>('#password').autocomplete).toBe('new-password');
    expect(q<HTMLInputElement>('#password').type).toBe('password');
  });

  it('does not show errors before the user touches a field', () => {
    expect(qa('[role=alert]').length).toBe(0);
    expect(q('#displayName').getAttribute('aria-invalid')).toBeNull();
  });

  it('a failed Next stays on the step, shows lz-field errors wired by aria-describedby and focuses the first invalid field', () => {
    q<HTMLButtonElement>('button[type=submit]').click();
    fixture.detectChanges();
    expect(component.currentStep).toBe(1);
    const errors = qa('lz-field p[role=alert]');
    expect(errors.length).toBe(3);
    for (const id of ['displayName', 'email', 'password']) {
      expect(q('#' + id).getAttribute('aria-invalid')).toBe('true');
      expect(q('#' + id).getAttribute('aria-describedby')).toBe(id + '-error');
      expect(q('#' + id + '-error').textContent!.trim().length).toBeGreaterThan(0);
    }
    expect(document.activeElement).toBe(q('#displayName'));
  });

  it('focuses the first invalid field that is not the first field', () => {
    component.userForm.patchValue({ displayName: 'Ana Diaz', email: 'nope' });
    q<HTMLButtonElement>('button[type=submit]').click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(q('#email'));
    expect(q('#displayName').getAttribute('aria-invalid')).toBeNull();
  });

  it('submitting the form with Enter advances like the Next button, and focus moves to the step heading', () => {
    fillStep1();
    submitForm();
    expect(component.currentStep).toBe(2);
    expect(document.activeElement).toBe(q('[data-step-heading]'));
    expect(q('[data-step-heading]').getAttribute('tabindex')).toBe('-1');
  });

  it('Back returns to the previous step and focuses its heading', () => {
    fillStep1();
    component.onNext();
    fixture.detectChanges();
    qa('button[type=button]').find((b) => b.textContent!.trim() === 'Back')!.click();
    fixture.detectChanges();
    expect(component.currentStep).toBe(1);
    expect(document.activeElement).toBe(q('[data-step-heading]'));
    expect(q<HTMLInputElement>('#email').value).toBe('ana@example.com');
  });

  it('prefills the company email from the account email and validates step 2', () => {
    fillStep1();
    component.onNext();
    fixture.detectChanges();
    expect(q<HTMLInputElement>('#companyEmail').value).toBe('ana@example.com');
    component.companyForm.patchValue({ companyName: '' });
    q<HTMLButtonElement>('button[type=submit]').click();
    fixture.detectChanges();
    expect(component.currentStep).toBe(2);
    expect(q('#companyName-error').textContent).toContain('Company name is required.');
    expect(document.activeElement).toBe(q('#companyName'));
    expect(q('#timeZone').getAttribute('aria-invalid')).toBeNull();
  });

  it('creates the account from the confirm step and goes to verification', async () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fillStep1();
    component.onNext();
    fillStep2();
    component.onNext();
    fixture.detectChanges();
    primaries()[0].click();
    await settle();
    expect(registrationService.register).toHaveBeenCalled();
    expect(sessionStorage.getItem('onboarding_company_id')).toBe('c1');
    expect(navigate).toHaveBeenCalledWith(['/register/verify']);
  });

  it('shows a failed submit in an lz-alert, stays on the confirm step and re-enables the button', async () => {
    registrationService.register.and.returnValue(throwError(() => ({ code: 'x' })));
    spyOn(console, 'error');
    fillStep1();
    component.onNext();
    fillStep2();
    component.onNext();
    fixture.detectChanges();
    primaries()[0].click();
    await settle();
    fixture.detectChanges();
    const alert = q('lz-alert[role=alert]');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain("We couldn't create your account");
    expect(component.currentStep).toBe(3);
    expect(firebaseUser.delete).toHaveBeenCalled();
    expect(primaries()[0].hasAttribute('disabled')).toBeFalse();
  });

  it('maps a known Firebase error to its own message', async () => {
    afAuth.createUserWithEmailAndPassword.and.rejectWith({ code: 'auth/email-already-in-use' });
    spyOn(console, 'error');
    fillStep1();
    component.onNext();
    fillStep2();
    component.onNext();
    fixture.detectChanges();
    primaries()[0].click();
    await settle();
    fixture.detectChanges();
    expect(q('lz-alert[role=alert]').textContent).toContain('This email already has an account');
  });

  it('uses design-system buttons with a filled primary and 48px targets on every step', () => {
    const check = () => {
      const primary = primaries()[0];
      expect(getComputedStyle(primary).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      for (const el of qa('button, input, select, a')) {
        expect(el.getBoundingClientRect().height).toBeGreaterThanOrEqual(47.5, el.outerHTML.slice(0, 60));
      }
    };
    check();
    fillStep1();
    component.onNext();
    fixture.detectChanges();
    check();
    fillStep2();
    component.onNext();
    fixture.detectChanges();
    check();
  });

  for (const width of [360, 768]) {
    it(`has no horizontal overflow at ${width}px on any step, even with long values`, () => {
      render(width);
      const overflow = () => {
        expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
        expect(q('lz-auth-shell > div').scrollWidth).toBeLessThanOrEqual(q('lz-auth-shell > div').clientWidth);
      };
      overflow();
      component.userForm.patchValue({ displayName: 'Ana Diaz', email: 'a'.repeat(60) + '@example.com', password: 'secret123' });
      component.onNext();
      fixture.detectChanges();
      overflow();
      component.companyForm.patchValue({ companyName: 'Very'.repeat(20), companyEmail: 'b'.repeat(60) + '@example.com' });
      component.onNext();
      fixture.detectChanges();
      overflow();
      qa('button').forEach((b) => expect(b.getBoundingClientRect().right).toBeLessThanOrEqual(width + 0.5));
    });
  }

  it('offers the detected time zone when it is not in the fixed list', () => {
    component.detectedTimeZone = 'Pacific/Auckland';
    fillStep1();
    component.onNext();
    fixture.detectChanges();
    const options = qa('#timeZone option').map((o) => o.textContent!.trim());
    expect(options[0]).toBe('Pacific/Auckland');
    expect(options).toContain('Eastern (US)');
  });

  it('links to sign in and to the legal pages with at least 48px targets', () => {
    expect(q('a[href="/auth/sign-in"]').getBoundingClientRect().height).toBeGreaterThanOrEqual(47.5);
    fillStep1();
    component.onNext();
    fillStep2();
    component.onNext();
    fixture.detectChanges();
    const legal = qa('a[target=_blank]');
    expect(legal.length).toBe(2);
    legal.forEach((a) => {
      expect(a.getAttribute('rel')).toBe('noopener');
      expect(a.getBoundingClientRect().height).toBeGreaterThanOrEqual(47.5);
    });
  });
});
