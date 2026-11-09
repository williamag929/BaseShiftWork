import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthModule } from '../auth.module';
import { SignInComponent } from './sign-in.component';
import { AuthService } from '../../../core/services/auth.service';

describe('SignInComponent', () => {
  let fixture: ComponentFixture<SignInComponent>;
  let component: SignInComponent;
  let root: HTMLElement;
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    auth = jasmine.createSpyObj('AuthService', ['SignIn', 'googleSignIn']);
    await TestBed.configureTestingModule({
      imports: [AuthModule, RouterTestingModule],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(SignInComponent);
    component = fixture.componentInstance;
    root = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('renders exactly one h1 reading "Sign in"', () => {
    const h1s = root.querySelectorAll('h1');
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent!.trim()).toBe('Sign in');
  });

  it('shows no alert until there is an error', () => {
    expect(root.querySelector('[role=alert]')).toBeNull();
  });

  it('shows errorMessage in a role=alert region', () => {
    component.errorMessage = 'Incorrect password.';
    fixture.detectChanges();
    const alert = root.querySelector('[role=alert]')!;
    expect(alert.textContent).toContain('Incorrect password.');
  });

  it('disables the submit button while loading', () => {
    const submit = root.querySelector('button[type=submit]') as HTMLButtonElement;
    component.signInForm.setValue({ email: 'a@b.co', password: 'secret' });
    fixture.detectChanges();
    expect(submit.disabled).toBeFalse();
    component.loading = true;
    fixture.detectChanges();
    expect(submit.disabled).toBeTrue();
  });

  it('has exactly one primary button', () => {
    expect(root.querySelectorAll('button[lzButton][variant=primary]').length).toBe(1);
  });

  it('keeps the Google button and forgot-password link in the tab order', () => {
    const google = root.querySelector('button[type=button][lzButton]') as HTMLButtonElement;
    const forgot = root.querySelector('a[href$="/auth/forgot-password"]') as HTMLAnchorElement;
    expect(google).toBeTruthy();
    expect(forgot).toBeTruthy();
    expect(google.getAttribute('tabindex')).not.toBe('-1');
    expect(forgot.getAttribute('tabindex')).not.toBe('-1');
    google.click();
    expect(auth.googleSignIn).toHaveBeenCalled();
  });

  it('renders the Google icon through mat-icon, with no Font Awesome or inline svg', () => {
    expect(root.querySelector('button mat-icon')).toBeTruthy();
    expect(root.querySelector('i.fa, i.fas, i.fab, svg')).toBeNull();
  });

  it('keeps the element ids the form uses and gives targets at least 48px', () => {
    expect(root.querySelector('input#email')).toBeTruthy();
    expect(root.querySelector('input#password')).toBeTruthy();
    const tall = (el: Element) => (el as HTMLElement).getBoundingClientRect().height;
    for (const el of Array.from(
      root.querySelectorAll('input, button, a[href]'),
    )) {
      expect(tall(el)).toBeGreaterThanOrEqual(48);
    }
  });

  it('renders the shell on the new surface, not the old theme', () => {
    const card = root.querySelector('lz-auth-shell > div') as HTMLElement;
    expect(getComputedStyle(card).backgroundColor).toBe('rgb(255, 255, 255)');
    expect(root.querySelector('.auth-container, .auth-box')).toBeNull();
  });
});
