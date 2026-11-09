import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { VerifyEmailComponent } from './verify-email.component';
import { RegistrationService } from '../../core/services/registration.service';

let afAuthStub: unknown;

// AngularFireAuth is providedIn: 'any'; element-level providers on a host reach the standalone component.
@Component({
  standalone: true,
  imports: [VerifyEmailComponent],
  providers: [{ provide: AngularFireAuth, useFactory: () => afAuthStub }],
  template: '<app-verify-email style="display: block" />',
})
class HostComponent {}

describe('registration VerifyEmailComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let component: VerifyEmailComponent;
  let root: HTMLElement;
  let user: { uid: string; email: string; emailVerified: boolean; reload: jasmine.Spy; sendEmailVerification: jasmine.Spy };
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const qa = (s: string) => Array.from(root.querySelectorAll<HTMLElement>(s));
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

  beforeEach(async () => {
    user = {
      uid: 'u1',
      email: 'ana@example.com',
      emailVerified: false,
      reload: jasmine.createSpy().and.resolveTo(),
      sendEmailVerification: jasmine.createSpy().and.resolveTo(),
    };
    afAuthStub = { currentUser: Promise.resolve(user) };
    await TestBed.configureTestingModule({
      imports: [HostComponent, RouterTestingModule],
      providers: [{ provide: RegistrationService, useValue: jasmine.createSpyObj('RegistrationService', ['patchOnboardingStatus']) }],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    root = fixture.nativeElement;
    fixture.detectChanges();
    component = fixture.debugElement.query(By.directive(VerifyEmailComponent)).componentInstance;
    await settle();
    fixture.detectChanges();
  });

  afterEach(() => component.ngOnDestroy());

  it('renders in the auth shell with one h1, the address and a single primary button', () => {
    expect(qa('h1').length).toBe(1);
    expect(q('h1').textContent!.trim()).toBe('Check your email');
    expect(root.textContent).toContain('ana@example.com');
    expect(qa('button[lzButton][variant=primary]').length).toBe(1);
    expect(q('[role=status]').textContent).toContain('Checking verification status');
  });

  it('resends the email and shows the cooldown as text', async () => {
    q<HTMLButtonElement>('button[variant=primary]').click();
    await settle();
    fixture.detectChanges();
    expect(user.sendEmailVerification).toHaveBeenCalled();
    expect(q<HTMLButtonElement>('button[variant=primary]').textContent).toContain('Resend in 60s');
    expect(q<HTMLButtonElement>('button[variant=primary]').disabled).toBeTrue();
  });

  it('shows a failed resend in an alert', async () => {
    user.sendEmailVerification.and.rejectWith(new Error('boom'));
    q<HTMLButtonElement>('button[variant=primary]').click();
    await settle();
    fixture.detectChanges();
    expect(q('lz-alert').getAttribute('role')).toBe('alert');
    expect(q('lz-alert').textContent).toContain("couldn't resend");
  });

  it('skips to onboarding from a quiet button', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const skip = qa('button').find((b) => b.textContent!.trim() === 'Skip for now')!;
    expect(skip.getAttribute('variant')).toBe('quiet');
    skip.click();
    expect(navigate).toHaveBeenCalledWith(['/onboarding']);
  });

  for (const width of [360, 768]) {
    it(`has no horizontal overflow at ${width}px`, () => {
      root.style.display = 'block';
      root.style.width = `${width}px`;
      fixture.detectChanges();
      expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
      qa('button').forEach((b) => expect(b.getBoundingClientRect().height).toBeGreaterThanOrEqual(47.5));
    });
  }
});
